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
YOU ARE THE MOIJEY SALES REP AI CO-PILOT — an expert luxury jewelry sales assistant.
Your role is to help sales reps answer client questions accurately using MOIJEY's knowledge base.

BUSINESS FACTS:
${facts || "None on file."}

KNOWLEDGE BASE CONTEXT (retrieved excerpts — may be partial or mid-sentence):
${context || "No relevant knowledge base entries found."}

USER QUESTION:
${query}

RESPONSE RULES:
1. Tone: Luxury-professional, confident, warm. Never casual or generic.
2. Use the knowledge base context to synthesize a complete, helpful answer even if excerpts are partial.
3. If context covers the topic partially, answer what you can and clearly note what would need confirmation.
4. Citations: Reference the source document name inline when you use information from it.
5. Response length: ${mode === 'short' ? 'Concise — 1 to 3 sentences maximum.' : 'Detailed and thorough — cover all relevant aspects.'}
6. NEVER invent specific prices, SKUs, or policies not mentioned in the context.
7. ONLY escalate with "I don't have enough information in the MOIJEY knowledge base to answer that — please escalate to your manager." if the topic is completely absent from both the context and facts above.

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
