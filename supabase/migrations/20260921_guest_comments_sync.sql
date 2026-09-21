-- ====================================================================
-- StartupCrème Database Migration
-- Feature: Guest Comments & Auto-Account Sync
-- Date: 2026-09-21
-- ====================================================================

-- 1. ALTER startupcreme.comments TABLE
-- Make user_id nullable to permit guest commenters
ALTER TABLE startupcreme.comments
    ALTER COLUMN user_id DROP NOT NULL;

-- Add author_email column (nullable, stored privately)
ALTER TABLE startupcreme.comments
    ADD COLUMN IF NOT EXISTS author_email TEXT NULL;

-- Drop old check constraint if it exists to ensure idempotency
ALTER TABLE startupcreme.comments
    DROP CONSTRAINT IF EXISTS check_sc_comments_author;

-- Add CHECK constraint ensuring that if user_id is NULL:
-- both author_name and author_email must be non-empty and validly formatted.
ALTER TABLE startupcreme.comments
    ADD CONSTRAINT check_sc_comments_author CHECK (
        (user_id IS NOT NULL) OR (
            user_id IS NULL AND
            author_name IS NOT NULL AND length(trim(author_name::text)) > 0 AND
            author_email IS NOT NULL AND author_email::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
        )
    );

-- 2. CLEAN UP DUPLICATE INDEXES & ADD EMAIL INDEX
-- Drop redundant/duplicate indexes
DROP INDEX IF EXISTS startupcreme.idx_sc_comments_post_id;
DROP INDEX IF EXISTS startupcreme.idx_sc_comments_user_id;

-- Recreate standard performance indexes cleanly
CREATE INDEX IF NOT EXISTS idx_sc_comments_post_id
    ON startupcreme.comments (post_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sc_comments_user_id
    ON startupcreme.comments (user_id)
    WHERE user_id IS NOT NULL;

-- Create partial index on (LOWER(author_email)) where user_id IS NULL
-- for ultra-fast account syncing when new users register
CREATE INDEX IF NOT EXISTS idx_sc_comments_guest_email
    ON startupcreme.comments (LOWER(author_email))
    WHERE user_id IS NULL;

-- 3. AUTO-SYNC TRIGGER FUNCTION (sync_guest_comments)
-- SECURITY DEFINER function to update guest comments when a new user registers
CREATE OR REPLACE FUNCTION startupcreme.sync_guest_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = startupcreme, public
AS $$
BEGIN
    IF NEW.email IS NOT NULL AND length(trim(NEW.email::text)) > 0 THEN
        UPDATE startupcreme.comments
        SET user_id = NEW.id,
            updated_at = timezone('utc'::text, now())
        WHERE LOWER(author_email) = LOWER(trim(NEW.email::text))
          AND user_id IS NULL;
    END IF;
    RETURN NEW;
END;
$$;

-- Bind trigger to startupcreme.users table on AFTER INSERT
DROP TRIGGER IF EXISTS trigger_sync_guest_comments ON startupcreme.users;
CREATE TRIGGER trigger_sync_guest_comments
    AFTER INSERT ON startupcreme.users
    FOR EACH ROW
    EXECUTE FUNCTION startupcreme.sync_guest_comments();

-- 4. SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE startupcreme.comments ENABLE ROW LEVEL SECURITY;

-- Insert Policy: Allow public & authenticated users to post comments
-- Validates that content, post_id, and either user_id or (author_name + author_email) are supplied
DROP POLICY IF EXISTS "Public and members can insert comments" ON startupcreme.comments;
DROP POLICY IF EXISTS "Anyone can write comments" ON startupcreme.comments;
CREATE POLICY "Public and members can insert comments"
    ON startupcreme.comments FOR INSERT
    WITH CHECK (
        content IS NOT NULL AND length(trim(content::text)) > 0 AND
        post_id IS NOT NULL AND
        (
            (user_id IS NOT NULL) OR
            (user_id IS NULL AND author_name IS NOT NULL AND length(trim(author_name::text)) > 0 AND author_email IS NOT NULL AND length(trim(author_email::text)) > 0)
        )
    );

-- Select Policy: All visitors can view comments
DROP POLICY IF EXISTS "Public visitors can view comments" ON startupcreme.comments;
CREATE POLICY "Public visitors can view comments"
    ON startupcreme.comments FOR SELECT
    USING (true);

-- Public Database VIEW (Privacy Protection)
-- Selects all comment fields EXCEPT author_email so guest emails can never leak
CREATE OR REPLACE VIEW startupcreme.public_comments AS
SELECT
    id,
    post_id,
    user_id,
    author_name,
    author_avatar,
    content,
    created_at,
    updated_at
FROM startupcreme.comments;

-- Grant permissions for public view and comments table
GRANT SELECT ON startupcreme.public_comments TO anon, authenticated, service_role;
GRANT INSERT ON startupcreme.comments TO anon, authenticated, service_role;
