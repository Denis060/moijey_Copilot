const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function check() {
    try {
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'");
        console.log("COLUMNS:", res.rows.map(r => r.column_name));
        process.exit(0);
    } catch (err) {
        console.error("CHECK FAIL:", err);
        process.exit(1);
    }
}
check();
