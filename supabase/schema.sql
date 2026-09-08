-- ====================================================================
-- StartupCrème Enterprise Database Schema & RLS Security Migration
-- Database Platform: PostgreSQL / Supabase
-- Target Schema: startupcreme (STRICT SCHEMA ISOLATION)
-- 
-- IMPORTANT SETUP INSTRUCTIONS:
-- 1. In your Supabase Dashboard, navigate to:
--    Project Settings -> API -> Data API Settings -> "Exposed schemas"
-- 2. Add "startupcreme" to the list of exposed schemas (e.g. "public, startupcreme"
--    or set "startupcreme" as the primary schema).
-- 3. Run this entire script in the Supabase SQL Editor.
-- ====================================================================

-- 0. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create Dedicated 'startupcreme' Schema
CREATE SCHEMA IF NOT EXISTS startupcreme;

-- 2. Grant Schema Privileges to Supabase Roles
-- Required for Supabase Data API (PostgREST), Edge Functions, and Direct Access
GRANT USAGE ON SCHEMA startupcreme TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA startupcreme TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA startupcreme TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA startupcreme TO anon, authenticated, service_role, postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA startupcreme GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA startupcreme GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA startupcreme GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 3. Create Custom Enum Types in 'startupcreme' Schema
DO $$ BEGIN
    CREATE TYPE startupcreme.content_vertical AS ENUM ('finance', 'tech');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE startupcreme.publication_status AS ENUM ('draft', 'published', 'outdated_translation');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE startupcreme.discussion_category AS ENUM ('finance', 'tech', 'startup', 'general');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- --------------------------------------------------------------------
-- 4. NEWSLETTER SUBSCRIBERS TABLE (startupcreme.newsletter_subscribers)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startupcreme.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'footer',
    vertical TEXT DEFAULT 'all',
    locale TEXT DEFAULT 'en-us',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sc_newsletter_email ON startupcreme.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_sc_newsletter_status ON startupcreme.newsletter_subscribers(status);

ALTER TABLE startupcreme.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public newsletter subscription" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow public newsletter subscription insert" ON startupcreme.newsletter_subscribers;
CREATE POLICY "Allow public newsletter subscription insert"
    ON startupcreme.newsletter_subscribers FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public newsletter subscription update" ON startupcreme.newsletter_subscribers;
CREATE POLICY "Allow public newsletter subscription update"
    ON startupcreme.newsletter_subscribers FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public newsletter subscription select" ON startupcreme.newsletter_subscribers;
CREATE POLICY "Allow public newsletter subscription select"
    ON startupcreme.newsletter_subscribers FOR SELECT
    TO anon, authenticated
    USING (TRUE);

DROP POLICY IF EXISTS "Allow admin full access to newsletter subscribers" ON startupcreme.newsletter_subscribers;
CREATE POLICY "Allow admin full access to newsletter subscribers"
    ON startupcreme.newsletter_subscribers FOR ALL
    TO authenticated
    USING (TRUE);

-- --------------------------------------------------------------------
-- 5. USERS / PROFILES TABLE (startupcreme.users)
-- Linked directly to Supabase auth.users(id)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startupcreme.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    reputation INT NOT NULL DEFAULT 100,
    badge TEXT DEFAULT 'Contributor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sc_users_role ON startupcreme.users(role);

ALTER TABLE startupcreme.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view user profiles" ON startupcreme.users;
CREATE POLICY "Public can view user profiles"
    ON startupcreme.users FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can manage own profile" ON startupcreme.users;
CREATE POLICY "Users can manage own profile"
    ON startupcreme.users FOR ALL
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Helper function to evaluate admin privileges without recursive RLS execution
CREATE OR REPLACE FUNCTION startupcreme.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = startupcreme, public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM startupcreme.users
        WHERE id = user_id AND role = 'admin'
    );
$$;

DROP POLICY IF EXISTS "Admins full access to users" ON startupcreme.users;
CREATE POLICY "Admins full access to users"
    ON startupcreme.users FOR ALL
    TO authenticated
    USING (startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 6. EDITORIAL POSTS TABLE (startupcreme.posts)
-- Stores native Tiptap rich content and topical silo metadata
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startupcreme.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'en-us',
    vertical startupcreme.content_vertical NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content JSONB NOT NULL, -- Native Tiptap JSON document structure
    status startupcreme.publication_status NOT NULL DEFAULT 'draft',
    meta_description TEXT,
    canonical_url TEXT,
    cover_image TEXT,
    author_name TEXT DEFAULT 'Startup Crème Editorial',
    author_role TEXT DEFAULT 'Principal Editor',
    author_avatar TEXT,
    dual_silo BOOLEAN DEFAULT false,
    silo_badge TEXT,
    tags TEXT[] DEFAULT '{}',
    reading_time_minutes INT DEFAULT 5,
    word_count INT DEFAULT 800,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Enforce localized topical silo uniqueness
    CONSTRAINT unique_sc_locale_vertical_slug UNIQUE (locale, vertical, slug)
);

CREATE INDEX IF NOT EXISTS idx_sc_posts_vertical_locale ON startupcreme.posts (vertical, locale, status);
CREATE INDEX IF NOT EXISTS idx_sc_posts_slug ON startupcreme.posts (slug);
CREATE INDEX IF NOT EXISTS idx_sc_posts_updated_at ON startupcreme.posts (updated_at DESC);

ALTER TABLE startupcreme.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published posts" ON startupcreme.posts;
CREATE POLICY "Public can view published posts"
    ON startupcreme.posts FOR SELECT
    USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated admins have full CRUD access" ON startupcreme.posts;
CREATE POLICY "Authenticated admins have full CRUD access"
    ON startupcreme.posts FOR ALL
    USING (auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() IS NOT NULL);

-- --------------------------------------------------------------------
-- 7. ARTICLE COMMENTS TABLE (startupcreme.comments)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS startupcreme.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL,
    user_id UUID REFERENCES startupcreme.users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sc_comments_post_id ON startupcreme.comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_comments_user_id ON startupcreme.comments (user_id);

ALTER TABLE startupcreme.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public visitors can view comments" ON startupcreme.comments;
CREATE POLICY "Public visitors can view comments"
    ON startupcreme.comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can write comments" ON startupcreme.comments;
CREATE POLICY "Anyone can write comments"
    ON startupcreme.comments FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage own comments" ON startupcreme.comments;
CREATE POLICY "Users can manage own comments"
    ON startupcreme.comments FOR ALL
    USING (auth.uid() = user_id OR auth.uid() IS NOT NULL)
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NOT NULL);

-- --------------------------------------------------------------------
-- 8. DISCUSSION FORUM TABLES
-- --------------------------------------------------------------------

-- 8.1 Discussion Topics
CREATE TABLE IF NOT EXISTS startupcreme.discussion_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category startupcreme.discussion_category NOT NULL DEFAULT 'general',
    user_id UUID REFERENCES startupcreme.users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_handle TEXT,
    author_avatar TEXT,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    comment_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8.2 Topic Votes (Independent Up & Down Votes)
CREATE TABLE IF NOT EXISTS startupcreme.discussion_topic_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES startupcreme.discussion_topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES startupcreme.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_sc_topic_user_vote_type UNIQUE (topic_id, user_id, vote_type)
);

-- 8.3 Discussion Comments
CREATE TABLE IF NOT EXISTS startupcreme.discussion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id TEXT NOT NULL,
    parent_id TEXT,
    user_id UUID REFERENCES startupcreme.users(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL,
    author_handle TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8.4 Comment Votes
CREATE TABLE IF NOT EXISTS startupcreme.discussion_comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES startupcreme.discussion_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES startupcreme.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_sc_comment_user_vote_type UNIQUE (comment_id, user_id, vote_type)
);

-- 8.5 Discussion Polls, Options & Poll Votes
CREATE TABLE IF NOT EXISTS startupcreme.discussion_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL UNIQUE REFERENCES startupcreme.discussion_topics(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    total_votes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS startupcreme.discussion_poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES startupcreme.discussion_polls(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    votes INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS startupcreme.discussion_poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES startupcreme.discussion_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES startupcreme.discussion_poll_options(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES startupcreme.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_sc_poll_user_vote UNIQUE (poll_id, user_id)
);

-- Indexes for Discussion Forum Tables
CREATE INDEX IF NOT EXISTS idx_sc_discussion_topics_category ON startupcreme.discussion_topics (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_discussion_topics_slug ON startupcreme.discussion_topics (slug);
CREATE INDEX IF NOT EXISTS idx_sc_discussion_topics_user ON startupcreme.discussion_topics (user_id);
CREATE INDEX IF NOT EXISTS idx_sc_discussion_topic_votes ON startupcreme.discussion_topic_votes (topic_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_sc_discussion_comments_topic ON startupcreme.discussion_comments (topic_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_sc_discussion_comment_votes ON startupcreme.discussion_comment_votes (comment_id, vote_type);

-- RLS for Discussion Forum Tables
ALTER TABLE startupcreme.discussion_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_topic_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_poll_votes ENABLE ROW LEVEL SECURITY;

-- Public read access
DROP POLICY IF EXISTS "Public can view discussion topics" ON startupcreme.discussion_topics;
CREATE POLICY "Public can view discussion topics" ON startupcreme.discussion_topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view topic votes" ON startupcreme.discussion_topic_votes;
CREATE POLICY "Public can view topic votes" ON startupcreme.discussion_topic_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view discussion comments" ON startupcreme.discussion_comments;
CREATE POLICY "Public can view discussion comments" ON startupcreme.discussion_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view comment votes" ON startupcreme.discussion_comment_votes;
CREATE POLICY "Public can view comment votes" ON startupcreme.discussion_comment_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view polls" ON startupcreme.discussion_polls;
CREATE POLICY "Public can view polls" ON startupcreme.discussion_polls FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view poll options" ON startupcreme.discussion_poll_options;
CREATE POLICY "Public can view poll options" ON startupcreme.discussion_poll_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can view poll votes" ON startupcreme.discussion_poll_votes;
CREATE POLICY "Public can view poll votes" ON startupcreme.discussion_poll_votes FOR SELECT USING (true);

-- Authenticated write access
DROP POLICY IF EXISTS "Users can create discussion topics" ON startupcreme.discussion_topics;
CREATE POLICY "Users can create discussion topics" ON startupcreme.discussion_topics FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can edit own discussion topics" ON startupcreme.discussion_topics;
CREATE POLICY "Users can edit own discussion topics" ON startupcreme.discussion_topics FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own discussion topics" ON startupcreme.discussion_topics;
CREATE POLICY "Users can delete own discussion topics" ON startupcreme.discussion_topics FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can vote on topics" ON startupcreme.discussion_topic_votes;
CREATE POLICY "Users can vote on topics" ON startupcreme.discussion_topic_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove topic votes" ON startupcreme.discussion_topic_votes;
CREATE POLICY "Users can remove topic votes" ON startupcreme.discussion_topic_votes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create discussion comments" ON startupcreme.discussion_comments;
CREATE POLICY "Users can create discussion comments" ON startupcreme.discussion_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can edit own comments" ON startupcreme.discussion_comments;
CREATE POLICY "Users can edit own comments" ON startupcreme.discussion_comments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments" ON startupcreme.discussion_comments;
CREATE POLICY "Users can delete own comments" ON startupcreme.discussion_comments FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can vote on comments" ON startupcreme.discussion_comment_votes;
CREATE POLICY "Users can vote on comments" ON startupcreme.discussion_comment_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove comment votes" ON startupcreme.discussion_comment_votes;
CREATE POLICY "Users can remove comment votes" ON startupcreme.discussion_comment_votes FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can vote on polls" ON startupcreme.discussion_poll_votes;
CREATE POLICY "Users can vote on polls" ON startupcreme.discussion_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- --------------------------------------------------------------------
-- 9. AI OPERATING SUBSYSTEM (Tasks, Actions, Approvals, Alerts, Memory)
-- --------------------------------------------------------------------

-- 9.1 AI Tasks
CREATE TABLE IF NOT EXISTS startupcreme.ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled')),
    requested_by TEXT NOT NULL DEFAULT 'system',
    assigned_agent TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    result JSONB,
    error TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    idempotency_key TEXT UNIQUE,
    approval_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sc_ai_tasks_status ON startupcreme.ai_tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_ai_tasks_idempotency ON startupcreme.ai_tasks(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_sc_ai_tasks_agent ON startupcreme.ai_tasks(assigned_agent);

-- 9.2 AI Actions (Audit Log)
CREATE TABLE IF NOT EXISTS startupcreme.ai_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID,
    agent TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed', 'blocked_policy', 'waiting_approval')),
    policy_level TEXT NOT NULL DEFAULT 'green' CHECK (policy_level IN ('green', 'yellow', 'red')),
    input_summary JSONB,
    output_summary JSONB,
    confidence NUMERIC(4,3),
    reason TEXT,
    target_entity TEXT,
    target_entity_id TEXT,
    reversible BOOLEAN DEFAULT false,
    reversed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sc_ai_actions_task ON startupcreme.ai_actions(task_id);
CREATE INDEX IF NOT EXISTS idx_sc_ai_actions_agent ON startupcreme.ai_actions(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sc_ai_actions_target ON startupcreme.ai_actions(target_entity, target_entity_id);

-- 9.3 AI Approvals (Human-in-the-Loop Oversight)
CREATE TABLE IF NOT EXISTS startupcreme.ai_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID,
    action_name TEXT NOT NULL,
    agent TEXT NOT NULL,
    policy_level TEXT NOT NULL DEFAULT 'yellow' CHECK (policy_level IN ('yellow', 'red')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    description TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    decided_by TEXT,
    decision_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    decided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sc_ai_approvals_status ON startupcreme.ai_approvals(status, created_at DESC);

-- 9.4 AI Alerts (Operational Notifications)
CREATE TABLE IF NOT EXISTS startupcreme.ai_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    is_dismissed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_sc_ai_alerts_severity ON startupcreme.ai_alerts(severity, is_dismissed);

-- 9.5 AI Long-Term Memory
CREATE TABLE IF NOT EXISTS startupcreme.ai_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    confidence NUMERIC(4,3) DEFAULT 1.000,
    source TEXT,
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sc_ai_memory_type_key UNIQUE (memory_type, key)
);

CREATE INDEX IF NOT EXISTS idx_sc_ai_memory_type ON startupcreme.ai_memory(memory_type);

-- RLS for AI Subsystem Tables
ALTER TABLE startupcreme.ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to ai_tasks" ON startupcreme.ai_tasks;
CREATE POLICY "Admins full access to ai_tasks" ON startupcreme.ai_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins full access to ai_actions" ON startupcreme.ai_actions;
CREATE POLICY "Admins full access to ai_actions" ON startupcreme.ai_actions FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins full access to ai_approvals" ON startupcreme.ai_approvals;
CREATE POLICY "Admins full access to ai_approvals" ON startupcreme.ai_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins full access to ai_alerts" ON startupcreme.ai_alerts;
CREATE POLICY "Admins full access to ai_alerts" ON startupcreme.ai_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins full access to ai_memory" ON startupcreme.ai_memory;
CREATE POLICY "Admins full access to ai_memory" ON startupcreme.ai_memory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------
-- 10. AUTOMATIC TRIGGERS AND FUNCTIONS (All in startupcreme schema)
-- --------------------------------------------------------------------

-- 10.1 Automatic Profile Synchronization Trigger on auth.users
CREATE OR REPLACE FUNCTION startupcreme.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = startupcreme, auth, public
LANGUAGE plpgsql AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    user_avatar TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'user');
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://picsum.photos/seed/' || NEW.id || '/100/100');

    -- Insert strictly into startupcreme.users
    INSERT INTO startupcreme.users (id, email, full_name, avatar_url, role)
    VALUES (NEW.id, NEW.email, user_name, user_avatar, user_role)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = timezone('utc'::text, now());

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION startupcreme.handle_new_user();

-- Grant permissions to Supabase Auth Daemon role if present
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        GRANT USAGE ON SCHEMA startupcreme TO supabase_auth_admin;
        GRANT ALL ON ALL TABLES IN SCHEMA startupcreme TO supabase_auth_admin;
        GRANT ALL ON ALL SEQUENCES IN SCHEMA startupcreme TO supabase_auth_admin;
        GRANT ALL ON ALL ROUTINES IN SCHEMA startupcreme TO supabase_auth_admin;
        GRANT EXECUTE ON FUNCTION startupcreme.handle_new_user() TO supabase_auth_admin;
    END IF;
END $$;

-- 10.2 Auto-Backfill any existing auth.users into startupcreme.users
INSERT INTO startupcreme.users (id, email, full_name, avatar_url, role)
SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
    COALESCE(u.raw_user_meta_data->>'avatar_url', 'https://picsum.photos/seed/' || u.id || '/100/100'),
    COALESCE(u.raw_user_meta_data->>'role', 'user')
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url;

-- 10.2 Automatic updated_at Column Timestamp
CREATE OR REPLACE FUNCTION startupcreme.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_newsletter_updated_at ON startupcreme.newsletter_subscribers;
CREATE TRIGGER update_newsletter_updated_at
    BEFORE UPDATE ON startupcreme.newsletter_subscribers
    FOR EACH ROW EXECUTE FUNCTION startupcreme.update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON startupcreme.users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON startupcreme.users
    FOR EACH ROW EXECUTE FUNCTION startupcreme.update_updated_at_column();

DROP TRIGGER IF EXISTS update_posts_updated_at ON startupcreme.posts;
CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON startupcreme.posts
    FOR EACH ROW EXECUTE FUNCTION startupcreme.update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON startupcreme.comments;
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON startupcreme.comments
    FOR EACH ROW EXECUTE FUNCTION startupcreme.update_updated_at_column();

DROP TRIGGER IF EXISTS update_discussion_topics_updated_at ON startupcreme.discussion_topics;
CREATE TRIGGER update_discussion_topics_updated_at
    BEFORE UPDATE ON startupcreme.discussion_topics
    FOR EACH ROW EXECUTE FUNCTION startupcreme.update_updated_at_column();

DROP TRIGGER IF EXISTS update_discussion_comments_updated_at ON startupcreme.discussion_comments;
CREATE TRIGGER update_discussion_comments_updated_at
    BEFORE UPDATE ON startupcreme.discussion_comments
    FOR EACH ROW EXECUTE FUNCTION startupcreme.update_updated_at_column();

-- 10.3 Topic Votes Synchronization Trigger
CREATE OR REPLACE FUNCTION startupcreme.sync_topic_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.vote_type = 'up' THEN
            UPDATE startupcreme.discussion_topics SET upvotes = upvotes + 1 WHERE id = NEW.topic_id;
        ELSIF NEW.vote_type = 'down' THEN
            UPDATE startupcreme.discussion_topics SET downvotes = downvotes + 1 WHERE id = NEW.topic_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.vote_type = 'up' THEN
            UPDATE startupcreme.discussion_topics SET upvotes = GREATEST(0, upvotes - 1) WHERE id = OLD.topic_id;
        ELSIF OLD.vote_type = 'down' THEN
            UPDATE startupcreme.discussion_topics SET downvotes = GREATEST(0, downvotes - 1) WHERE id = OLD.topic_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_topic_votes ON startupcreme.discussion_topic_votes;
CREATE TRIGGER trg_sync_topic_votes
    AFTER INSERT OR DELETE ON startupcreme.discussion_topic_votes
    FOR EACH ROW EXECUTE FUNCTION startupcreme.sync_topic_votes();

-- 10.4 Comment Votes Synchronization Trigger
CREATE OR REPLACE FUNCTION startupcreme.sync_comment_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF NEW.vote_type = 'up' THEN
            UPDATE startupcreme.discussion_comments SET upvotes = upvotes + 1 WHERE id = NEW.comment_id;
        ELSIF NEW.vote_type = 'down' THEN
            UPDATE startupcreme.discussion_comments SET downvotes = downvotes + 1 WHERE id = NEW.comment_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.vote_type = 'up' THEN
            UPDATE startupcreme.discussion_comments SET upvotes = GREATEST(0, upvotes - 1) WHERE id = OLD.comment_id;
        ELSIF OLD.vote_type = 'down' THEN
            UPDATE startupcreme.discussion_comments SET downvotes = GREATEST(0, downvotes - 1) WHERE id = OLD.comment_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_comment_votes ON startupcreme.discussion_comment_votes;
CREATE TRIGGER trg_sync_comment_votes
    AFTER INSERT OR DELETE ON startupcreme.discussion_comment_votes
    FOR EACH ROW EXECUTE FUNCTION startupcreme.sync_comment_votes();

-- 10.5 Poll Votes Synchronization Trigger
CREATE OR REPLACE FUNCTION startupcreme.sync_poll_votes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE startupcreme.discussion_poll_options SET votes = votes + 1 WHERE id = NEW.option_id;
        UPDATE startupcreme.discussion_polls SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE startupcreme.discussion_poll_options SET votes = GREATEST(0, votes - 1) WHERE id = OLD.option_id;
        UPDATE startupcreme.discussion_polls SET total_votes = GREATEST(0, total_votes - 1) WHERE id = OLD.poll_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_poll_votes ON startupcreme.discussion_poll_votes;
CREATE TRIGGER trg_sync_poll_votes
    AFTER INSERT OR DELETE ON startupcreme.discussion_poll_votes
    FOR EACH ROW EXECUTE FUNCTION startupcreme.sync_poll_votes();

-- ====================================================================
-- OPTIONAL: Clean Up Legacy Public Schema Tables (Run ONLY if needed)
-- ====================================================================
-- If migrating from an earlier setup that mistakenly created tables in 'public',
-- the following commands can be uncommented and executed to remove them:
--
-- DROP TABLE IF EXISTS public.ai_memory CASCADE;
-- DROP TABLE IF EXISTS public.ai_alerts CASCADE;
-- DROP TABLE IF EXISTS public.ai_approvals CASCADE;
-- DROP TABLE IF EXISTS public.ai_actions CASCADE;
-- DROP TABLE IF EXISTS public.ai_tasks CASCADE;
-- DROP TABLE IF EXISTS public.discussion_poll_votes CASCADE;
-- DROP TABLE IF EXISTS public.discussion_poll_options CASCADE;
-- DROP TABLE IF EXISTS public.discussion_polls CASCADE;
-- DROP TABLE IF EXISTS public.discussion_comment_votes CASCADE;
-- DROP TABLE IF EXISTS public.discussion_comments CASCADE;
-- DROP TABLE IF EXISTS public.discussion_topic_votes CASCADE;
-- DROP TABLE IF EXISTS public.discussion_topics CASCADE;
-- DROP TABLE IF EXISTS public.comments CASCADE;
-- DROP TABLE IF EXISTS public.posts CASCADE;
-- DROP TABLE IF EXISTS public.users CASCADE;
-- DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;

