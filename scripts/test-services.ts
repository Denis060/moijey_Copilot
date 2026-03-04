import { db } from "../src/lib/db/db-client";
import { storageService } from "../src/lib/storage";
import { aiService } from "../src/lib/ai/ai-service";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env
dotenv.config({ path: resolve(__dirname, "../.env") });

async function runTest() {
    console.log("--- MOIJEY SERVICE TEST ---");

    try {
        // 1. Test Database
        console.log("\n1. Testing Database Connection...");
        const dbRes = await db.query("SELECT NOW()");
        console.log("✅ DB Connected:", dbRes.rows[0].now);

        // 2. Test Storage (Supabase)
        console.log("\n2. Testing Supabase Storage...");
        const testBuffer = Buffer.from("Service check " + Date.now());
        const testPath = `test/connection-check-${Date.now()}.txt`;
        const storageRes = await storageService.uploadFile(testBuffer, testPath, "text/plain");
        console.log("✅ Storage Upload Success:", storageRes.path);

        await storageService.deleteFile(testPath);
        console.log("✅ Storage Delete Success");

        // 3. Test AI (Gemini)
        console.log("\n3. Testing Gemini AI (Embeddings)...");
        const embedding = await aiService.generateEmbedding("Hello world");
        console.log("✅ Gemini Embedding Success. Vector length:", embedding.length);

        // 4. Test DB Insertion (Vector)
        console.log("\n4. Testing DB Insertion (Vector)...");
        const vectorStr = `[${embedding.join(",")}]`;
        const testDocId = "00000000-0000-0000-0000-000000000000"; // Dummy but needs to exist if constraint is on

        // Let's create a dummy doc first to avoid FK error
        const wsRes = await db.query("SELECT id FROM workspaces LIMIT 1");
        const wsId = wsRes.rows[0].id;
        const docRes = await db.query(
            "INSERT INTO documents (workspace_id, title, status) VALUES ($1, 'Test Doc', 'processing') RETURNING id",
            [wsId]
        );
        const docId = docRes.rows[0].id;

        try {
            await db.query(
                "INSERT INTO document_chunks (document_id, content, embedding, chunk_index) VALUES ($1, $2, $3, $4)",
                [docId, "Test content", vectorStr, 0]
            );
            console.log("✅ DB Vector Insertion Success");
        } finally {
            // Clean up
            await db.query("DELETE FROM documents WHERE id = $1", [docId]);
        }

        console.log("\n--- ALL SERVICES OK ---");
    } catch (error: any) {
        console.error("\n❌ TEST FAILED:");
        console.error(error.message);
        if (error.stack) console.error(error.stack);
        process.exit(1);
    } finally {
        await db.pool.end();
    }
}

runTest();
