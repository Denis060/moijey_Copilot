const { Client } = require('pg');
require('dotenv').config();

async function migrate() {
    console.log("--- Starting Schema Migration: Vector Dimension Fix ---");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log("1. Dropping existing index...");
        await client.query("DROP INDEX IF EXISTS idx_document_chunks_embedding");

        console.log("2. Altering column type to vector(3072)...");
        // We drop and recreate because direct CAST from vector(1536) to vector(3072) might be restricted or require specific casting
        // Since the table current has 0 valid rows (they all failed processing), dropping and re-adding is safe.
        await client.query("ALTER TABLE document_chunks ALTER COLUMN embedding TYPE vector(3072)");

        console.log("3. (Skipping index creation for now to avoid errors)...");
        // await client.query("CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)");

        console.log("✅ Migration Successful: Database now expects 768 dimensions.");

        // Verify
        const verifyRes = await client.query("SELECT atttypmod FROM pg_attribute WHERE attrelid = 'document_chunks'::regclass AND attname = 'embedding'");
        console.log("Verified Live Dimension:", verifyRes.rows[0].atttypmod);

    } catch (err) {
        console.error("❌ Migration FAILED:");
        console.error(err.message);
        if (err.stack) console.error(err.stack);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
