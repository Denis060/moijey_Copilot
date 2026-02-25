const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function testAuth() {
    const email = 'admin@moijey.com';
    const plainPassword = 'moijey-admin-2026';

    console.log(`Diagnostic: Testing auth for ${email}...`);

    try {
        const res = await pool.query(
            `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = $1`,
            [email]
        );

        if (res.rows.length === 0) {
            console.error('❌ User NOT FOUND in database.');
            return;
        }

        const user = res.rows[0];
        console.log('✅ User found. Hashed password in DB:', user.password_hash);

        const match = await bcrypt.compare(plainPassword, user.password_hash);

        if (match) {
            console.log('✅ PASSWORD MATCH SUCCESS!');
        } else {
            console.error('❌ PASSWORD MATCH FAILURE.');
            console.log('Recalculating hash for moijey-admin-2026 to compare...');
            const newHash = await bcrypt.hash(plainPassword, 10);
            console.log('New hash (sample):', newHash);
        }
    } catch (err) {
        console.error('❌ Database error:', err.message);
    } finally {
        await pool.end();
    }
}

testAuth();
