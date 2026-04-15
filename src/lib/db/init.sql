-- Database initialization for MOIJEY Sales Rep AI Co-Pilot
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces for multi-tenant readiness
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role definitions
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL -- 'admin', 'manager', 'sales_rep'
);

INSERT INTO roles (name) VALUES ('admin'), ('manager'), ('sales_rep') ON CONFLICT DO NOTHING;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents storage metadata
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    title TEXT NOT NULL,
    file_path TEXT, -- External blob storage link
    content_type TEXT,
    category TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    metadata JSONB DEFAULT '{}',
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with vector embeddings
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(3072), -- gemini-embedding-001 produces 3072-dim vectors
    chunk_index INTEGER,
    metadata JSONB DEFAULT '{}', -- Store page numbers, section titles, etc.
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business Facts (structured knowledge)
CREATE TABLE business_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    category TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workspace_id, key)
);

-- Conversation history
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    workspace_id UUID REFERENCES workspaces(id),
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]', -- Array of {doc_id, chunk_id, title, page}
    latency_ms INTEGER,
    model_used TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved responses for Sales Reps
CREATE TABLE saved_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    title TEXT,
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logging for security and compliance
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id),
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL, -- 'UPLOAD_DOC', 'DELETE_DOC', 'ASK_QUESTION', etc.
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products inventory for recommendation engine
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT UNIQUE NOT NULL, -- from Excel
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
    tags TEXT[], -- array of tags
    target_gender TEXT,
    notes_internal TEXT,
    embedding vector(3072), -- for semantic search
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recommendation requests for audit trail
CREATE TABLE recommendation_requests (
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
    matched_products JSONB DEFAULT '[]', -- array of product IDs
    email_draft TEXT,
    email_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
-- NOTE: ivfflat/hnsw indexes cap at 2000 dims; gemini-embedding-001 produces 3072, so no index here.
-- Sequential scan is acceptable for small knowledge bases.
CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX idx_products_shape ON products(diamond_shape);
CREATE INDEX idx_products_metal ON products(metal);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_stock ON products(in_stock);
CREATE INDEX idx_recommendation_user ON recommendation_requests(user_id);
