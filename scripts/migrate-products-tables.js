// One-shot migration: adds products + recommendation_requests tables and their
// indexes if they don't already exist. Safe to re-run.
const { Client } = require('pg');
require('dotenv').config();

const SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    category TEXT,
    price DECIMAL(12, 2),
    price_display TEXT,
    in_stock BOOLEAN DEFAULT true,
    shopify_product_id TEXT,
    shopify_url TEXT,
    image_url TEXT,
    diamond_shape TEXT,
    metal TEXT,
    style TEXT,
    description_short TEXT,
    tags TEXT[],
    target_gender TEXT,
    notes_internal TEXT,
    embedding vector(3072),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    workspace_id UUID REFERENCES workspaces(id),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    budget_min DECIMAL(12, 2),
    budget_max DECIMAL(12, 2),
    product_type TEXT,
    diamond_shape TEXT,
    metal TEXT,
    style TEXT,
    timeline TEXT,
    notes TEXT,
    matched_products JSONB DEFAULT '[]',
    email_draft TEXT,
    email_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_shape ON products(diamond_shape);
CREATE INDEX IF NOT EXISTS idx_products_metal ON products(metal);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(in_stock);
CREATE INDEX IF NOT EXISTS idx_recommendation_user ON recommendation_requests(user_id);
`;

(async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    try {
        await client.query(SQL);
        const r = await client.query(`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN ('products', 'recommendation_requests')
            ORDER BY table_name
        `);
        console.log("Tables present:", r.rows.map(x => x.table_name).join(", "));
        const idx = await client.query(`
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND indexname LIKE 'idx_products_%' OR indexname = 'idx_recommendation_user'
            ORDER BY indexname
        `);
        console.log("Indexes:", idx.rows.map(x => x.indexname).join(", "));
        console.log("Migration complete.");
    } catch (err) {
        console.error("Migration failed:", err.message);
        process.exitCode = 1;
    } finally {
        await client.end();
    }
})();
