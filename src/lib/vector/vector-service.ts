import { db } from "../db/db-client";
import { aiService } from "../ai/ai-service";

export interface SearchResult {
    content: string;
    document_id: string;
    title: string;
    score: number;
    metadata: any;
}

export const vectorService = {
    /**
     * Performs a vector similarity search using cosine distance.
     */
    async searchSimilarChunks(query: string, workspaceId: string, limit = 5): Promise<SearchResult[]> {
        const queryEmbedding = await aiService.generateEmbedding(query);
        const vectorStr = `[${queryEmbedding.join(",")}]`;

        const result = await db.query(
            `SELECT 
        dc.content, 
        dc.document_id, 
        d.title,
        (dc.embedding <=> $1::vector) as distance,
        dc.metadata
       FROM document_chunks dc
       JOIN documents d ON dc.document_id = d.id
       WHERE d.workspace_id = $2 AND d.status = 'completed'
       ORDER BY distance ASC
       LIMIT $3`,
            [vectorStr, workspaceId, limit]
        );

        return result.rows.map(row => ({
            content: row.content,
            document_id: row.document_id,
            title: row.title,
            score: 1 - row.distance, // Convert distance to similarity score
            metadata: row.metadata
        }));
    },
};
