import { db } from "../db/db-client";
import { vectorService } from "../vector/vector-service";
import { aiService } from "./ai-service";

export const ragService = {
    /**
     * Main RAG logic: Retrieve, Augment, Generate.
     */
    async getAnswer(query: string, workspaceId: string, mode: "short" | "detailed" = "short") {
        // 1. Retrieve Knowledge Chunks
        const chunks = await vectorService.searchSimilarChunks(query, workspaceId, 8);

        // 2. Retrieve Business Facts
        const factsRes = await db.query(
            "SELECT key, value FROM business_facts WHERE workspace_id = $1",
            [workspaceId]
        );
        const facts = factsRes.rows.map(f => `${f.key}: ${f.value}`).join("\n");

        // 3. Compose Prompt
        const context = chunks.map(c => `[SOURCE: ${c.title}] ${c.content}`).join("\n\n");

        const prompt = `
YOU ARE THE MOIJEY SALES REP AI CO-PILOT.
Goal: Provide accurate, luxury-professional answers based ON ONLY the provided context and facts.

BUSINESS FACTS:
${facts}

KNOWLEDGE BASE CONTEXT:
${context}

USER QUESTION:
${query}

GUIDELINES:
- Tone: Luxury-professional, confident, respectful.
- Citations: You MUST mention the source title at the end of the sentence or paragraph if you used info from it.
- Mode: ${mode === 'short' ? 'Provide a concise 1-2 sentence answer.' : 'Provide a detailed, helpful explanation.'}
- If the answer is NOT in the context or facts, say: "I don't have enough information in the MOIJEY knowledge base to answer that. Please escalate."
- NEVER invent policies or pricing.

ANSWER:`;

        // 4. Generate
        const startTime = Date.now();
        console.log(`RAG: Generating answer for query: "${query}" using model: ${process.env.COMPLETION_MODEL_ID || "gemini-1.5-pro"}`);
        const answer = await aiService.generateAnswer(prompt);
        const latency = Date.now() - startTime;

        console.log(`RAG: Answer generated in ${latency}ms`);

        return {
            answer,
            citations: chunks.map(c => ({ document_id: c.document_id, title: c.title })),
            latency_ms: latency,
            model: process.env.COMPLETION_MODEL_ID || "gemini-1.5-pro"
        };
    }
};
