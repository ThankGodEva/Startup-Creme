-- ====================================================================
-- StartupCrème Enterprise Database Schema & RLS Security Migration
-- Database Platform: PostgreSQL / Supabase
-- Target Schema: startupcreme
-- Includes: newsletter_subscribers, users, posts, comments,
--           discussion_topics, discussion_topic_votes, discussion_comments,
--           discussion_comment_votes, discussion_polls, poll_options, poll_votes
-- ====================================================================

-- 0. Enable UUID Extension & Create Custom Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS startupcreme;

-- GRANT USAGE ON SCHEMA startupcreme TO API ROLES (anon, authenticated, service_role)
GRANT USAGE ON SCHEMA startupcreme TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL TABLES IN SCHEMA startupcreme TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA startupcreme TO anon, authenticated, service_role, postgres;
GRANT ALL ON ALL ROUTINES IN SCHEMA startupcreme TO anon, authenticated, service_role, postgres;

ALTER DEFAULT PRIVILEGES IN SCHEMA startupcreme GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA startupcreme GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA startupcreme GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 1. Create Custom Enum Types
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
-- 2. NEWSLETTER SUBSCRIBERS TABLE (Both public and startupcreme schemas)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    source TEXT DEFAULT 'footer',
    vertical TEXT DEFAULT 'all',
    locale TEXT DEFAULT 'en-us',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

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

CREATE INDEX IF NOT EXISTS idx_newsletter_email_pub ON public.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON startupcreme.newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON startupcreme.newsletter_subscribers(status);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public newsletter subscription" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow public newsletter subscription insert" ON public.newsletter_subscribers;
CREATE POLICY "Allow public newsletter subscription insert"
    ON public.newsletter_subscribers FOR INSERT
    TO anon, authenticated
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public newsletter subscription update" ON public.newsletter_subscribers;
CREATE POLICY "Allow public newsletter subscription update"
    ON public.newsletter_subscribers FOR UPDATE
    TO anon, authenticated
    USING (TRUE)
    WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Allow public newsletter subscription select" ON public.newsletter_subscribers;
CREATE POLICY "Allow public newsletter subscription select"
    ON public.newsletter_subscribers FOR SELECT
    TO anon, authenticated
    USING (TRUE);

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
-- 3. USERS / PROFILES TABLE (Linked to auth.users)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    reputation INT NOT NULL DEFAULT 100,
    badge TEXT DEFAULT 'Contributor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS startupcreme.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    reputation INT NOT NULL DEFAULT 100,
    badge TEXT DEFAULT 'Contributor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_role_sc ON startupcreme.users(role);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view user profiles" ON public.users;
CREATE POLICY "Public can view user profiles" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own profile" ON public.users;
CREATE POLICY "Users can manage own profile" ON public.users FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Public can view user profiles" ON startupcreme.users;
CREATE POLICY "Public can view user profiles" ON startupcreme.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage own profile" ON startupcreme.users;
CREATE POLICY "Users can manage own profile" ON startupcreme.users FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- --------------------------------------------------------------------
-- 4. POSTS TABLE (Both public and startupcreme schema for compatibility)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'en-us',
    vertical TEXT NOT NULL DEFAULT 'finance',
    title TEXT NOT NULL,
    excerpt TEXT,
    content JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'published',
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS startupcreme.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    locale TEXT NOT NULL DEFAULT 'en-us',
    vertical startupcreme.content_vertical NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content JSONB NOT NULL, -- Stores native Tiptap JSON output
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

    -- Unique constraint for localized topical siloing
    CONSTRAINT unique_locale_vertical_slug UNIQUE (locale, vertical, slug)
);

CREATE INDEX IF NOT EXISTS idx_posts_vertical_locale ON startupcreme.posts (vertical, locale, status);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON startupcreme.posts (slug);
CREATE INDEX IF NOT EXISTS idx_posts_updated_at ON startupcreme.posts (updated_at DESC);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published posts" ON public.posts;
CREATE POLICY "Public can view published posts" ON public.posts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users CRUD posts" ON public.posts;
CREATE POLICY "Authenticated users CRUD posts" ON public.posts FOR ALL USING (true);

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
-- 5. ARTICLE COMMENTS TABLE
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL,
    user_id UUID,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS startupcreme.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL,
    user_id UUID,
    author_name TEXT NOT NULL,
    author_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON startupcreme.comments (post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON startupcreme.comments (user_id);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public visitors can view comments" ON public.comments;
CREATE POLICY "Public visitors can view comments" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can write comments" ON public.comments;
CREATE POLICY "Anyone can write comments" ON public.comments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public visitors can view comments" ON startupcreme.comments;
CREATE POLICY "Public visitors can view comments"
    ON startupcreme.comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Only authenticated users can write comments" ON startupcreme.comments;
CREATE POLICY "Only authenticated users can write comments"
    ON startupcreme.comments FOR ALL
    USING (true)
    WITH CHECK (true);

-- --------------------------------------------------------------------
-- 6. DISCUSSION FORUM DATABASE TABLES
-- --------------------------------------------------------------------

-- 6.1 Discussion Topics
CREATE TABLE IF NOT EXISTS public.discussion_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    user_id UUID,
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

CREATE TABLE IF NOT EXISTS startupcreme.discussion_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category startupcreme.discussion_category NOT NULL DEFAULT 'general',
    user_id UUID,
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

-- 6.2 Topic Votes (Independent Up & Down Votes)
CREATE TABLE IF NOT EXISTS startupcreme.discussion_topic_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id UUID NOT NULL REFERENCES startupcreme.discussion_topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES startupcreme.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_topic_user_vote_type UNIQUE (topic_id, user_id, vote_type)
);

-- 6.3 Discussion Comments
CREATE TABLE IF NOT EXISTS public.discussion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id TEXT NOT NULL,
    parent_id TEXT,
    user_id UUID,
    author_name TEXT NOT NULL,
    author_handle TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS startupcreme.discussion_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_id TEXT NOT NULL,
    parent_id TEXT,
    user_id UUID,
    author_name TEXT NOT NULL,
    author_handle TEXT,
    author_avatar TEXT,
    content TEXT NOT NULL,
    upvotes INT NOT NULL DEFAULT 0,
    downvotes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6.4 Comment Votes
CREATE TABLE IF NOT EXISTS startupcreme.discussion_comment_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES startupcreme.discussion_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES startupcreme.users(id) ON DELETE CASCADE,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_comment_user_vote_type UNIQUE (comment_id, user_id, vote_type)
);

-- 6.5 Discussion Polls, Options & Poll Votes
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
    CONSTRAINT unique_poll_user_vote UNIQUE (poll_id, user_id)
);

-- 6.6 Indexes for Discussion Forum Tables
CREATE INDEX IF NOT EXISTS idx_discussion_topics_category ON startupcreme.discussion_topics (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_slug ON startupcreme.discussion_topics (slug);
CREATE INDEX IF NOT EXISTS idx_discussion_topics_user ON startupcreme.discussion_topics (user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_topic_votes ON startupcreme.discussion_topic_votes (topic_id, vote_type);
CREATE INDEX IF NOT EXISTS idx_discussion_comments_topic ON startupcreme.discussion_comments (topic_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_discussion_comment_votes ON startupcreme.discussion_comment_votes (comment_id, vote_type);

-- 6.7 RLS Policies for Discussion Forum Tables
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
-- 7. AUTOMATIC USER PROFILE SYNCHRONIZATION TRIGGER
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION startupcreme.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    user_avatar TEXT;
BEGIN
    user_role := COALESCE(NEW.raw_user_meta_data->>'role', CASE WHEN NEW.email = 'chibuezethankgod07@gmail.com' THEN 'admin' ELSE 'user' END);
    user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    user_avatar := COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://picsum.photos/seed/' || NEW.id || '/100/100');

    INSERT INTO public.users (id, email, full_name, avatar_url, role)
    VALUES (NEW.id, NEW.email, user_name, user_avatar, user_role)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        avatar_url = EXCLUDED.avatar_url;

    INSERT INTO startupcreme.users (id, email, full_name, avatar_url, role)
    VALUES (NEW.id, NEW.email, user_name, user_avatar, user_role)
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        avatar_url = EXCLUDED.avatar_url;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION startupcreme.handle_new_user();

-- --------------------------------------------------------------------
-- 8. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGERS
-- --------------------------------------------------------------------
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

-- --------------------------------------------------------------------
-- 9. TOPIC VOTES SYNCHRONIZATION TRIGGER
-- --------------------------------------------------------------------
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
