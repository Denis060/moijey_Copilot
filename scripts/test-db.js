const { Client } = require('pg');
require('dotenv').config();

async function testConnection() {
    const variations = [
        { name: 'Direct', url: process.env.DATABASE_URL },
        { name: 'Pooled', url: "postgresql://postgres.gqjdlkdayhwohgzfjhxx:FinancialFreedom%402025@aws-0-us-east-1.pooler.supabase.com:6543/postgres" },
    ];

    for (const v of variations) {
        console.log(`Testing ${v.name}...`);
        const client = new Client({ connectionString: v.url, ssl: { rejectUnauthorized: false } });
        try {
            await client.connect();
            console.log(`✅ ${v.name} Success!`);
            const res = await client.query('SELECT current_user, current_database()');
            console.log('User/DB:', res.rows[0]);
            await client.end();
            return; // Stop if any works
        } catch (err) {
            console.error(`❌ ${v.name} Failed:`, err.message);
        }
    }
}

testConnection();
