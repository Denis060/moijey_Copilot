const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    console.log("--- Fixing Vector Dimension: vector(3072) → vector(768) ---");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("1. Dropping existing index...");
        await client.query("DROP INDEX IF EXISTS idx_document_chunks_embedding");

        console.log("2. Clearing any existing chunk data (dimension mismatch means all chunks are invalid)...");
        await client.query("DELETE FROM document_chunks");

        console.log("3. Altering column type to vector(768)...");
        await client.query("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(768) USING NULL");

        console.log("4. Recreating IVFFlat index for vector(768)...");
        await client.query(
            "CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
        );

        // Also reset any documents that failed processing so they can be re-ingested
        console.log("5. Resetting failed documents to 'pending' for re-ingestion...");
        await client.query("UPDATE documents SET status = 'pending' WHERE status = 'failed'");

        console.log("✅ Migration complete: DB now expects 768-dimension vectors (gemini-embedding-001).");

        const verifyRes = await client.query(
            "SELECT atttypmod FROM pg_attribute WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding'"
        );
        const typmod = verifyRes.rows[0]?.atttypmod;
        // pgvector stores dim+4 in atttypmod
        console.log(`Verified dimension in DB: ${typmod - 4} (atttypmod = ${typmod})`);

    } catch (err) {
        console.error("❌ Migration FAILED:");
        console.error(err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
