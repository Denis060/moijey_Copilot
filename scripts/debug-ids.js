const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function debugIds() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to DB");
        const res = await client.query('SELECT id, title, workspace_id FROM documents LIMIT 10');
        console.log("Documents Found:");
        console.table(res.rows);
    } catch (e) {
        console.error("DB Error:", e.message);
    } finally {
        await client.end();
    }
}

debugIds();
