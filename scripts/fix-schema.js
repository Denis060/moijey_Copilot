const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function updateSchema() {
    try {
        console.log('Updating schema...');
        await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'moijey-docs';`);
        console.log('Schema updated successfully.');
        await pool.end();
        process.exit(0);
    } catch (error) {
        console.error('Failed to update schema:', error);
        process.exit(1);
    }
}

updateSchema();
