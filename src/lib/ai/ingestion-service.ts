import { db } from "../db/db-client";
import { aiService } from "./ai-service";
import { CHUNK_CONFIG } from "../constants";
import _ from "lodash";

export interface ProcessingSource {
    documentId: string;
    text: string;
}

export const ingestionService = {
    /**
     * Chunks text content into smaller pieces for embedding.
     */
    chunkText(text: string, size = CHUNK_CONFIG.SIZE, overlap = CHUNK_CONFIG.OVERLAP): string[] {
        const words = text.split(/\s+/);
        const chunks: string[] = [];

        for (let i = 0; i < words.length; i += size - overlap) {
            const chunk = words.slice(i, i + size).join(" ");
            if (chunk.trim()) chunks.push(chunk);
            if (i + size >= words.length) break;
        }

        return chunks;
    },

    /**
     * Processes a document: chunks, embeds, and stores in DB.
     */
    async processDocument(documentId: string, text: string) {
        try {
            // 1. Mark as processing and chunk
            await db.query("UPDATE documents SET status = 'processing' WHERE id = $1", [documentId]);
            const chunks = this.chunkText(text);

            // 2. Set total chunks for progress tracking
            await db.query(
                "UPDATE documents SET total_chunks = $1, processed_chunks = 0 WHERE id = $2",
                [chunks.length, documentId]
            );

            // 3. Embed & Store with rate-limit friendly loop
            for (let i = 0; i < chunks.length; i++) {
                const content = chunks[i];
                const embedding = await aiService.generateEmbedding(content);

                const vectorStr = `[${embedding.join(",")}]`;

                await db.query(
                    `INSERT INTO document_chunks (document_id, content, embedding, chunk_index) 
                     VALUES ($1, $2, $3, $4)`,
                    [documentId, content, vectorStr, i]
                );

                // Update progress every chunk (or every N chunks for efficiency)
                await db.query(
                    "UPDATE documents SET processed_chunks = $1 WHERE id = $2",
                    [i + 1, documentId]
                );

                // For very large files, a tiny sleep prevents Gemini API 429s
                if (chunks.length > 100) {
                    await new Promise(r => setTimeout(r, 50));
                }
            }

            // 4. Mark as completed
            await db.query("UPDATE documents SET status = 'completed' WHERE id = $1", [documentId]);

            return { success: true, chunkCount: chunks.length };
        } catch (error) {
            console.error("Ingestion Error:", error);
            await db.query("UPDATE documents SET status = 'failed' WHERE id = $1", [documentId]);
            throw error;
        }
    },
};
