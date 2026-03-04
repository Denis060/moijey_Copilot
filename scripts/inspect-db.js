const { Client } = require('pg');
require('dotenv').config();

async function inspect() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT id, title, status, processed_chunks, total_chunks, created_at 
            FROM documents 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        console.log("--- Latest Documents ---");
        console.table(res.rows);

        // Check for any chunks
        const chunks = await client.query("SELECT COUNT(*) FROM document_chunks");
        console.log("Total chunks in DB:", chunks.rows[0].count);

    } catch (err) {
        console.error("Inspection failed:", err);
    } finally {
        await client.end();
    }
}
inspect();
