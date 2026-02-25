const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
    connectionString: process.env.DATABASE_URL,
});

async function migrate() {
    try {
        await client.connect();
        console.log("Connected to Supabase. Running migration...");

        await client.query(`
            ALTER TABLE documents 
            ADD COLUMN IF NOT EXISTS total_chunks INTEGER,
            ADD COLUMN IF NOT EXISTS processed_chunks INTEGER DEFAULT 0;
        `);

        console.log("Migration successful: Progress columns added to 'documents' table.");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

migrate();
