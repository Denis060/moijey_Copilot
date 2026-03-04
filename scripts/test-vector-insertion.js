const { Client } = require('pg');
require('dotenv').config();

async function test() {
    console.log("--- Vector Insertion Test (JS) ---");
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Create a 768-dimension dummy vector
        const dummyVector = Array(768).fill(0.1);
        const vectorStr = `[${dummyVector.join(",")}]`;

        // 2. Get a workspace
        const wsRes = await client.query("SELECT id FROM workspaces LIMIT 1");
        if (wsRes.rows.length === 0) throw new Error("No workspaces found. Run seed first.");
        const wsId = wsRes.rows[0].id;

        // 3. Create a dummy doc
        const docRes = await client.query(
            "INSERT INTO documents (workspace_id, title, status) VALUES ($1, 'JS Test Doc', 'processing') RETURNING id",
            [wsId]
        );
        const docId = docRes.rows[0].id;

        console.log(`Created test document: ${docId}`);

        try {
            // 4. Insert chunk
            await client.query(
                "INSERT INTO document_chunks (document_id, content, embedding, chunk_index) VALUES ($1, $2, $3, $4)",
                [docId, "JS Test content", vectorStr, 0]
            );
            console.log("✅ DB Vector Insertion SUCCESS (768 dims)");
        } catch (insertErr) {
            console.error("❌ DB Vector Insertion FAILED:");
            console.error(insertErr.message);
        } finally {
            // 5. Cleanup
            await client.query("DELETE FROM documents WHERE id = $1", [docId]);
            console.log("Cleaned up test data.");
        }

    } catch (err) {
        console.error("Test failed:", err.message);
    } finally {
        await client.end();
    }
}

test();
