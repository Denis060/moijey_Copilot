const { db } = require('./src/lib/db/db-client');

async function updateSchema() {
    try {
        console.log('Updating schema...');
        await db.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'moijey-docs';`);
        console.log('Schema updated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Failed to update schema:', error);
        process.exit(1);
    }
}

updateSchema();
