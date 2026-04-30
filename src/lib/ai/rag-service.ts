import { db } from "../db/db-client";
import { vectorService } from "../vector/vector-service";
import { aiService } from "./ai-service";
import { TtlCache } from "@/lib/cache";

// Business facts change rarely — cache per workspace for 5 minutes
const factsCache = new TtlCache<string, string>(5 * 60 * 1000);

const MIN_SIMILARITY_SCORE = 0.2; // Drop chunks with cosine similarity below this
const CHUNK_LIMIT = 10;           // Retrieve up to 10, trim by score before building prompt
const FALLBACK_CHUNKS = 3;        // If nothing passes threshold, include top N as best-effort
const HISTORY_TURNS = 4;          // How many prior message pairs to include for multi-turn context

export interface PriorMessage {
    role: "user" | "assistant";
    content: string;
}

export interface Citation {
    document_id: string;
    title: string;
    content: string;     // The chunk text, surfaced for click-to-verify in the UI
    score: number;       // Cosine similarity (0-1) — higher means stronger match
}

/** Strip the SUGGESTIONS:[...] tail from a prior assistant message so it doesn't leak into new prompts. */
function stripSuggestions(content: string): string {
    return content.replace(/\n*SUGGESTIONS:\s*\[[\s\S]*$/i, "").trim();
}

/** Format prior turns as a transcript the model treats as ongoing context. */
function formatHistory(messages: PriorMessage[]): string {
    if (!messages.length) return "";
    const lines = messages.map(m =>
        m.role === "user"
            ? `Customer: ${m.content.trim()}`
            : `You (the rep): ${stripSuggestions(m.content)}`
    );
    return `PRIOR CONVERSATION (the rep and the same client have been talking — keep continuity, don't repeat earlier answers verbatim):\n${lines.join("\n")}\n`;
}

/** Shared retrieval logic — embed, search, facts, build prompt */
async function buildRagContext(
    query: string,
    workspaceId: string,
    mode: "short" | "detailed",
    history: PriorMessage[] = []
) {
    const [chunks, facts] = await Promise.all([
        vectorService.searchSimilarChunks(query, workspaceId, CHUNK_LIMIT),
        getBusinessFacts(workspaceId),
    ]);
    const aboveThreshold = chunks.filter(c => c.score >= MIN_SIMILARITY_SCORE);
    const relevantChunks = aboveThreshold.length > 0 ? aboveThreshold : chunks.slice(0, FALLBACK_CHUNKS);
    const lowConfidence = aboveThreshold.length === 0 && relevantChunks.length > 0;

    const context = relevantChunks.map(c => `[SOURCE: ${c.title}] ${c.content}`).join("\n\n");
    const citations: Citation[] = relevantChunks.map(c => ({
        document_id: c.document_id,
        title: c.title,
        content: c.content,
        score: c.score,
    }));

    const historyBlock = formatHistory(history);

    const prompt = `
YOU ARE THE MOIJEY SALES REP AI CO-PILOT — a luxury jewelry sales expert whispering in the sales rep's ear.
Your job: give the rep a ready-to-speak response they can deliver directly to the client, word for word.

MOIJEY BUSINESS FACTS:
${facts || "None on file."}

REFERENCE INFORMATION (internal — do NOT quote or mention these sources to the client):
${context || "No relevant information found."}

${historyBlock}CLIENT QUESTION (asked to the sales rep):
${query}

RESPONSE RULES:
1. Write the answer AS IF the sales rep is speaking directly to the client. Use "we", "our", "your" — never "the knowledge base", "our records", "our system", or any internal tool names.
2. Tone: Warm, confident, luxury-professional, but DIRECT. A real Moijey rep does NOT flatter the client or pad their answers. Lead with the answer itself.
3. NEVER open with sycophantic or throat-clearing phrases. BANNED openers include: "That's a great question", "That's an excellent question", "Great question", "Wonderful question", "I'd be delighted to", "I want to ensure", "I'm so glad you asked", "Absolutely!", "Of course!". Just answer.
4. NEVER mention documents, files, sources, databases, or internal references. The client must never know this is AI-generated.
5. Use the reference information to give an accurate, complete answer. Synthesize naturally — do not copy-paste chunks.
6. If information is partial, answer what you can and say "I'll confirm the exact details for you" rather than mentioning limitations.
7. Response length: ${mode === 'short' ? 'Concise — 2 to 3 natural spoken sentences. No filler.' : 'Thorough — cover all relevant aspects in flowing, conversational language. Still no filler.'}
8. NEVER invent specific prices, SKUs, or policies not in the reference information.
9. If the topic is completely absent from the reference information above, reply with exactly: "Let me check with my manager and get right back to you on that." Nothing before it. Nothing after it (other than the SUGGESTIONS line).
10. If a PRIOR CONVERSATION block is present above, treat the new question as a continuation. Resolve pronouns ("it", "that", "this") and short follow-ups ("what about for women?") against the prior turns, and don't restate context the client already gave.
11. After your answer, on a NEW LINE output exactly this (no extra text, always 3 items — phrase as natural follow-up questions a client would ask):
SUGGESTIONS:["<follow-up question 1>","<follow-up question 2>","<follow-up question 3>"]

ANSWER:`;
    console.log(`RAG context: ${aboveThreshold.length}/${chunks.length} chunks passed threshold (using ${relevantChunks.length}${lowConfidence ? " fallback" : ""}, history turns: ${history.length})`);
    return {
        prompt,
        citations,
        lowConfidence,
        model: process.env.COMPLETION_MODEL_ID || "gemini-2.5-flash",
    };
}

export const ragService = {
    /** Non-streaming — returns full answer (kept for scripts/tests) */
    async getAnswer(
        query: string,
        workspaceId: string,
        mode: "short" | "detailed" = "short",
        history: PriorMessage[] = []
    ) {
        const { prompt, citations, lowConfidence, model } = await buildRagContext(query, workspaceId, mode, history);
        const startTime = Date.now();
        const answer = await aiService.generateAnswer(prompt);
        return { answer, citations, lowConfidence, latency_ms: Date.now() - startTime, model };
    },

    /**
     * Streaming — retrieves context synchronously, then streams Gemini tokens.
     * Returns citations + lowConfidence flag upfront, plus an AsyncGenerator of text tokens.
     */
    async getAnswerStream(
        query: string,
        workspaceId: string,
        mode: "short" | "detailed" = "short",
        history: PriorMessage[] = []
    ) {
        const { prompt, citations, lowConfidence, model } = await buildRagContext(query, workspaceId, mode, history);
        const tokenStream = aiService.generateAnswerStream(prompt);
        return { citations, lowConfidence, tokenStream, model };
    },
};

/** Load the last N message-pairs for a conversation, oldest-first, ready to feed back into the prompt. */
export async function loadConversationHistory(conversationId: string, turns: number = HISTORY_TURNS): Promise<PriorMessage[]> {
    if (!conversationId) return [];
    // Pull last 2*turns rows (each turn is one user + one assistant), then reverse to chronological order.
    const res = await db.query(
        `SELECT role, content
         FROM messages
         WHERE conversation_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [conversationId, turns * 2]
    );
    return res.rows
        .reverse()
        .filter((r: any) => r.role === "user" || r.role === "assistant")
        .map((r: any) => ({ role: r.role as "user" | "assistant", content: r.content }));
}

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
