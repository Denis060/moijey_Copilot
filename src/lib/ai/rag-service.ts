import { db } from "../db/db-client";
import { vectorService, type ProductMatch } from "../vector/vector-service";
import { aiService } from "./ai-service";
import { TtlCache } from "@/lib/cache";

// Business facts change rarely — cache per workspace for 5 minutes
const factsCache = new TtlCache<string, string>(5 * 60 * 1000);

const MIN_SIMILARITY_SCORE = 0.2; // Drop chunks with cosine similarity below this
const CHUNK_LIMIT = 10;           // Retrieve up to 10, trim by score before building prompt
const FALLBACK_CHUNKS = 3;        // If nothing passes threshold, include top N as best-effort
const HISTORY_TURNS = 2;          // How many prior message pairs to include for multi-turn context
const PRODUCT_LIMIT = 5;          // How many top product matches to retrieve from the live catalog
const MIN_PRODUCT_SCORE = 0.6;    // Cosine similarity floor for a product to surface. History:
                                  //   0.25 → 0.4 (CEO-question noise)
                                  //   0.4  → 0.6 (Andy reported "what month does Emerald represent?"
                                  //               still surfaced product cards because the embedding
                                  //               clipped past 0.4 against jewelry titles containing
                                  //               "emerald"). 0.6 forces a much stronger semantic
                                  //               match before products show up.

/**
 * Heuristic intent gate — only run product search when the question has clear
 * jewelry-shopping signal. Saves an embedding + DB call on policy / FAQ / "who is X"
 * questions, and prevents irrelevant product cards from showing up under unrelated answers.
 *
 * Errors on the side of false positives (run the search) when in doubt; the threshold
 * above filters out weak matches as a second line of defense.
 */
const PRODUCT_INTENT_PATTERNS: RegExp[] = [
    /\b(ring|necklace|bracelet|earring|earrings|pendant|band|mount|mounting|chain|brooch|charm)\b/i,
    /\b(gold|silver|platinum|rhodium|titanium|tungsten)\b/i,
    /\b(diamond|sapphire|emerald|ruby|pearl|gemstone|gem|aquamarine|amethyst|topaz|opal|garnet|moissanite)\b/i,
    /\b(oval|round|princess|cushion|marquise|asscher|radiant|baguette|emerald-cut|pear-cut|heart-cut)\b/i,
    /\b(eternity|halo|solitaire|pave|pavé|bezel|prong|cathedral|trellis|tension)\b/i,
    /\b(carat|ctw|carats|\d+\s*ct\b)\b/i,
    /\$\s*\d/,                                 // any dollar amount: "$5,000", "$5 000", etc.
    /\b(budget|inventory|catalog|collection|in stock|under \$|over \$)\b/i,
];

function hasProductIntent(query: string): boolean {
    return PRODUCT_INTENT_PATTERNS.some(p => p.test(query));
}

export type SuggestedProduct = ProductMatch;

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

/**
 * Output of the retrieval phase. Captures everything that depends ONLY on the
 * current query + workspace, so callers can run this in parallel with anything
 * that depends on the conversation (like history loading).
 */
export interface RetrievedContext {
    citations: Citation[];
    lowConfidence: boolean;
    products: SuggestedProduct[];
    /** Pre-formatted reference block ready to drop into the prompt. */
    contextBlock: string;
    /** Pre-formatted products block (empty string when no matches). */
    productsBlock: string;
    /** Pre-formatted business facts (empty string when none). */
    facts: string;
}

/**
 * Phase 1: do the work that only depends on the user's current question —
 * embed, vector search across chunks + products, load business facts.
 */
async function retrieve(query: string, workspaceId: string): Promise<RetrievedContext> {
    // Intent gate: skip product search entirely when the query has no jewelry-shopping signal.
    // Saves an embedding API call + a vector scan, and stops irrelevant product cards from
    // appearing under non-product answers (e.g., "who is our CEO?", "warranty policy").
    const productIntent = hasProductIntent(query);
    const productsPromise = productIntent
        ? vectorService.searchSimilarProducts(query, PRODUCT_LIMIT).catch(err => {
            console.error("Product search failed (continuing without products):", err.message);
            return [];
        })
        : Promise.resolve([]);

    const [chunks, facts, products] = await Promise.all([
        vectorService.searchSimilarChunks(query, workspaceId, CHUNK_LIMIT),
        getBusinessFacts(workspaceId),
        productsPromise,
    ]);
    const aboveThreshold = chunks.filter(c => c.score >= MIN_SIMILARITY_SCORE);
    const relevantChunks = aboveThreshold.length > 0 ? aboveThreshold : chunks.slice(0, FALLBACK_CHUNKS);
    const lowConfidence = aboveThreshold.length === 0 && relevantChunks.length > 0;

    const contextBlock = relevantChunks.map(c => `[SOURCE: ${c.title}] ${c.content}`).join("\n\n");

    // Dedupe citations by document_id so the UI shows one badge per source document.
    const byDoc = new Map<string, Citation>();
    for (const c of relevantChunks) {
        const existing = byDoc.get(c.document_id);
        if (!existing || c.score > existing.score) {
            byDoc.set(c.document_id, {
                document_id: c.document_id,
                title: c.title,
                content: c.content,
                score: c.score,
            });
        }
    }
    const citations: Citation[] = [...byDoc.values()].sort((a, b) => b.score - a.score);

    const relevantProducts = products.filter(p => p.score >= MIN_PRODUCT_SCORE);
    const productsBlock = relevantProducts.length
        ? `\nMATCHING PRODUCTS (live inventory — these are real items the rep can recommend; cite by name, NEVER paste the URL):\n${relevantProducts.map((p, i) => {
            const attrs = [p.diamond_shape, p.metal, p.style].filter(Boolean).join(", ");
            const priceTxt = p.price_display || (p.price ? `$${p.price.toLocaleString()}` : "price on request");
            return `${i + 1}. ${p.title} — ${priceTxt}${attrs ? ` (${attrs})` : ""}`;
        }).join("\n")}\n`
        : "";

    console.log(`RAG retrieve: ${aboveThreshold.length}/${chunks.length} chunks passed threshold (using ${relevantChunks.length}${lowConfidence ? " fallback" : ""}, products: ${relevantProducts.length}/${products.length}${productIntent ? "" : " — skipped (no shopping intent)"})`);

    return {
        citations,
        lowConfidence,
        products: relevantProducts,
        contextBlock,
        productsBlock,
        facts,
    };
}

/**
 * Phase 2: assemble the prompt from already-retrieved context + history + the
 * current query. Pure string assembly, no I/O.
 */
function buildPromptFromContext(
    query: string,
    retrieved: RetrievedContext,
    history: PriorMessage[],
    mode: "short" | "detailed",
): string {
    const historyBlock = formatHistory(history);
    return `
YOU ARE THE MOIJEY SALES REP AI CO-PILOT — a luxury jewelry sales expert whispering in the sales rep's ear.
Your job: give the rep a ready-to-speak response they can deliver directly to the client, word for word.

MOIJEY BUSINESS FACTS:
${retrieved.facts || "None on file."}

REFERENCE INFORMATION (internal — do NOT quote or mention these sources to the client):
${retrieved.contextBlock || "No relevant information found."}
${retrieved.productsBlock}
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
11. If a MATCHING PRODUCTS block is present above, the rep CAN naturally mention these specific items by name and price when relevant. Pick the best fits, don't list all of them. Never invent a product not in that list. Never paste URLs into your answer — the UI shows the rep cards alongside.
12. After your answer, on a NEW LINE output exactly this (no extra text, always 3 items — phrase as natural follow-up questions a client would ask):
SUGGESTIONS:["<follow-up question 1>","<follow-up question 2>","<follow-up question 3>"]

ANSWER:`;
}

const COMPLETION_MODEL = process.env.COMPLETION_MODEL_ID || "gemini-2.5-flash";

export const ragService = {
    /** Phase 1 (exposed): do the retrieval work that only needs the current query. */
    retrieve,

    /**
     * Phase 2 (streaming): given pre-retrieved context + history, build the prompt and
     * start streaming. Returns citations / products / lowConfidence flags upfront for the UI,
     * plus an AsyncGenerator of text tokens.
     */
    streamFromContext(
        query: string,
        retrieved: RetrievedContext,
        history: PriorMessage[],
        mode: "short" | "detailed" = "short",
    ) {
        const prompt = buildPromptFromContext(query, retrieved, history, mode);
        const tokenStream = aiService.generateAnswerStream(prompt);
        return {
            citations: retrieved.citations,
            lowConfidence: retrieved.lowConfidence,
            products: retrieved.products,
            tokenStream,
            model: COMPLETION_MODEL,
        };
    },

    /** Convenience wrapper: retrieve + stream in one call. Used by scripts/tests. */
    async getAnswerStream(
        query: string,
        workspaceId: string,
        mode: "short" | "detailed" = "short",
        history: PriorMessage[] = []
    ) {
        const retrieved = await retrieve(query, workspaceId);
        return ragService.streamFromContext(query, retrieved, history, mode);
    },

    /** Non-streaming convenience wrapper, kept for scripts/tests. */
    async getAnswer(
        query: string,
        workspaceId: string,
        mode: "short" | "detailed" = "short",
        history: PriorMessage[] = []
    ) {
        const retrieved = await retrieve(query, workspaceId);
        const prompt = buildPromptFromContext(query, retrieved, history, mode);
        const startTime = Date.now();
        const answer = await aiService.generateAnswer(prompt);
        return {
            answer,
            citations: retrieved.citations,
            lowConfidence: retrieved.lowConfidence,
            products: retrieved.products,
            latency_ms: Date.now() - startTime,
            model: COMPLETION_MODEL,
        };
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
