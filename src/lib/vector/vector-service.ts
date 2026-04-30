import { db } from "../db/db-client";
import { aiService } from "../ai/ai-service";

export interface SearchResult {
    content: string;
    document_id: string;
    title: string;
    score: number;
    metadata: any;
}

export interface ProductMatch {
    id: string;
    product_id: string;
    title: string;
    price: number | null;
    price_display: string | null;
    image_url: string | null;
    shopify_url: string | null;
    diamond_shape: string | null;
    metal: string | null;
    style: string | null;
    description_short: string | null;
    score: number;
}

export const vectorService = {
    /**
     * Performs a vector similarity search over knowledge document chunks.
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

    /**
     * Vector similarity search over the products catalog.
     * Returns the top N in-stock products whose embedding is closest to the query.
     * Products with NULL embedding are skipped (catalog hasn't been embedded yet).
     */
    async searchSimilarProducts(query: string, limit = 5): Promise<ProductMatch[]> {
        const queryEmbedding = await aiService.generateEmbedding(query);
        const vectorStr = `[${queryEmbedding.join(",")}]`;

        const result = await db.query(
            `SELECT id, product_id, title, price, price_display, image_url, shopify_url,
                    diamond_shape, metal, style, description_short,
                    (embedding <=> $1::vector) AS distance
             FROM products
             WHERE in_stock = true AND embedding IS NOT NULL
             ORDER BY distance ASC
             LIMIT $2`,
            [vectorStr, limit]
        );

        return result.rows.map(row => ({
            id: row.id,
            product_id: row.product_id,
            title: row.title,
            price: row.price !== null ? Number(row.price) : null,
            price_display: row.price_display,
            image_url: row.image_url,
            shopify_url: row.shopify_url,
            diamond_shape: row.diamond_shape,
            metal: row.metal,
            style: row.style,
            description_short: row.description_short,
            score: 1 - row.distance,
        }));
    },
};
