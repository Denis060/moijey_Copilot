const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function seed() {
    const client = await pool.connect();
    try {
        console.log('--- Starting Seed ---');

        // 1. Create Workspace
        const workspaceRes = await client.query(
            "INSERT INTO workspaces (name) VALUES ('MOIJEY Main') ON CONFLICT DO NOTHING RETURNING id"
        );
        const workspaceId = workspaceRes.rows[0]?.id || (await client.query("SELECT id FROM workspaces LIMIT 1")).rows[0].id;
        console.log(`- Workspace initialized: ${workspaceId}`);

        // 2. Roles
        await client.query("INSERT INTO roles (name) VALUES ('admin'), ('manager'), ('sales_rep') ON CONFLICT DO NOTHING");
        console.log('- Roles initialized');

        // 3. Admin User
        const adminEmail = 'admin@moijey.com';
        const hashedPassword = await bcrypt.hash('moijey-admin-2026', 10);
        const adminRoleId = (await client.query("SELECT id FROM roles WHERE name = 'admin'")).rows[0].id;

        await client.query(
            `INSERT INTO users (workspace_id, email, password_hash, role_id) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO NOTHING`,
            [workspaceId, adminEmail, hashedPassword, adminRoleId]
        );
        console.log(`- Default admin created: ${adminEmail} / moijey-admin-2026`);

        console.log('--- Seed Completed Successfully ---');
    } catch (err) {
        console.error('Seed Failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

seed();
