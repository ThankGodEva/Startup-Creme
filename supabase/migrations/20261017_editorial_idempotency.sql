-- ====================================================================
-- StartupCrème Schema Migration: Editorial Ingestion Idempotency Reference Table
-- Target Schema: startupcreme
-- Purpose: Track external n8n editorial draft submissions and guarantee
--          safe, idempotent replay without storing operational data in posts.
-- ====================================================================

CREATE TABLE IF NOT EXISTS startupcreme.editorial_idempotency (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    idempotency_key TEXT UNIQUE NOT NULL,
    request_fingerprint TEXT NOT NULL,
    post_id UUID REFERENCES startupcreme.posts(id) ON DELETE CASCADE NOT NULL,
    workflow_id TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sc_editorial_idempotency_key 
    ON startupcreme.editorial_idempotency(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_sc_editorial_idempotency_post_id 
    ON startupcreme.editorial_idempotency(post_id);

ALTER TABLE startupcreme.editorial_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to editorial_idempotency" 
    ON startupcreme.editorial_idempotency;

CREATE POLICY "Service role full access to editorial_idempotency" 
    ON startupcreme.editorial_idempotency FOR ALL 
    TO service_role 
    USING (true) 
    WITH CHECK (true);
