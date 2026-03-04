import { db } from "../db/db-client";
import { vectorService } from "../vector/vector-service";
import { aiService } from "./ai-service";
import { TtlCache } from "@/lib/cache";

// Business facts change rarely — cache per workspace for 5 minutes
const factsCache = new TtlCache<string, string>(5 * 60 * 1000);

const MIN_SIMILARITY_SCORE = 0.2; // Drop chunks with cosine similarity below this
const CHUNK_LIMIT = 10;           // Retrieve up to 10, trim by score before building prompt
const FALLBACK_CHUNKS = 3;        // If nothing passes threshold, include top N as best-effort

/** Shared retrieval logic — embed, search, facts, build prompt */
async function buildRagContext(query: string, workspaceId: string, mode: "short" | "detailed") {
    const [chunks, facts] = await Promise.all([
        vectorService.searchSimilarChunks(query, workspaceId, CHUNK_LIMIT),
        getBusinessFacts(workspaceId),
    ]);
    const aboveThreshold = chunks.filter(c => c.score >= MIN_SIMILARITY_SCORE);
    const relevantChunks = aboveThreshold.length > 0 ? aboveThreshold : chunks.slice(0, FALLBACK_CHUNKS);
    const context = relevantChunks.map(c => `[SOURCE: ${c.title}] ${c.content}`).join("\n\n");
    const citations = relevantChunks.map(c => ({ document_id: c.document_id, title: c.title }));
    const prompt = `
YOU ARE THE MOIJEY SALES REP AI CO-PILOT — a luxury jewelry sales expert whispering in the sales rep's ear.
Your job: give the rep a ready-to-speak response they can deliver directly to the client, word for word.

MOIJEY BUSINESS FACTS:
${facts || "None on file."}

REFERENCE INFORMATION (internal — do NOT quote or mention these sources to the client):
${context || "No relevant information found."}

CLIENT QUESTION (asked to the sales rep):
${query}

RESPONSE RULES:
1. Write the answer AS IF the sales rep is speaking directly to the client. Use "we", "our", "your" — never "the knowledge base", "our records", "our system", or any internal tool names.
2. Tone: Warm, confident, luxury-professional. The client should feel like they are in a high-end boutique.
3. NEVER mention documents, files, sources, databases, or internal references. The client must never know this is AI-generated.
4. Use the reference information to give an accurate, complete answer. Synthesize naturally — do not copy-paste chunks.
5. If information is partial, answer what you can and say "I'll confirm the exact details for you" rather than mentioning limitations.
6. Response length: ${mode === 'short' ? 'Concise — 2 to 3 natural spoken sentences.' : 'Thorough — cover all relevant aspects in flowing, conversational language.'}
7. NEVER invent specific prices, SKUs, or policies not in the reference information.
8. ONLY say "I don't have that detail on hand — let me check with my manager for you." if the topic is completely absent from the reference information above.
9. After your answer, on a NEW LINE output exactly this (no extra text, always 3 items — phrase as natural follow-up questions a client would ask):
SUGGESTIONS:["<follow-up question 1>","<follow-up question 2>","<follow-up question 3>"]

ANSWER:`;
    console.log(`RAG context: ${aboveThreshold.length}/${chunks.length} chunks passed threshold (using ${relevantChunks.length}${aboveThreshold.length === 0 ? " fallback" : ""})`);
    return { prompt, citations, model: process.env.COMPLETION_MODEL_ID || "gemini-2.5-flash" };
}

export const ragService = {
    /** Non-streaming — returns full answer (kept for scripts/tests) */
    async getAnswer(query: string, workspaceId: string, mode: "short" | "detailed" = "short") {
        const { prompt, citations, model } = await buildRagContext(query, workspaceId, mode);
        const startTime = Date.now();
        const answer = await aiService.generateAnswer(prompt);
        return { answer, citations, latency_ms: Date.now() - startTime, model };
    },

    /**
     * Streaming — retrieves context synchronously, then streams Gemini tokens.
     * Returns citations upfront + an AsyncGenerator of text tokens.
     */
    async getAnswerStream(query: string, workspaceId: string, mode: "short" | "detailed" = "short") {
        const { prompt, citations, model } = await buildRagContext(query, workspaceId, mode);
        const tokenStream = aiService.generateAnswerStream(prompt);
        return { citations, tokenStream, model };
    },
};

async function getBusinessFacts(workspaceId: string): Promise<string> {
    const cached = factsCache.get(workspaceId);
    if (cached !== undefined) return cached;

    const res = await db.query(
        "SELECT key, value FROM business_facts WHERE workspace_id = $1",
        [workspaceId]
    );
    const facts = res.rows.map((f: { key: string; value: string }) => `${f.key}: ${f.value}`).join("\n");
    factsCache.set(workspaceId, facts);
    return facts;
}

/** Invalidate facts cache after create/update/delete so next request gets fresh data */
export function invalidateFactsCache(workspaceId: string): void {
    factsCache.delete(workspaceId);
}
