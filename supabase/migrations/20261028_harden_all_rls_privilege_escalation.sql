-- ====================================================================
-- StartupCrème Enterprise Database Migration: Complete RLS Security Hardening
-- Migration: 20261028_harden_all_rls_privilege_escalation.sql
-- Target Schema: startupcreme
-- Description:
--   Removes all privilege escalation bugs across posts, events, users,
--   startups, jobs, newsletter subscribers, rate snapshots, forum topics,
--   comments, votes, and AI subsystem tables where USING or WITH CHECK
--   was loosely defined as `true` or `auth.uid() IS NOT NULL`.
--
-- Security Rules Enforced:
--   1. Admin-only operations strictly use startupcreme.is_admin(auth.uid()).
--   2. User-owned rows (forum topics/comments, votes, submissions) require
--      auth.uid() = owner column for BOTH USING and WITH CHECK.
--   3. Users CANNOT change their own role column (enforced via RLS and trigger).
--   4. Public SELECT access is strictly restricted to published / approved rows.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Hardened Admin Privilege Function
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION startupcreme.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = startupcreme, public
STABLE
AS $$
    SELECT CASE
        WHEN user_id IS NULL THEN false
        ELSE EXISTS (
            SELECT 1 FROM startupcreme.users
            WHERE id = user_id AND role = 'admin'
        )
    END;
$$;

-- --------------------------------------------------------------------
-- 2. USERS (startupcreme.users): Prevent Role Self-Escalation
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view user profiles" ON startupcreme.users;
DROP POLICY IF EXISTS "Users can manage own profile" ON startupcreme.users;
DROP POLICY IF EXISTS "Admins full access to users" ON startupcreme.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON startupcreme.users;
DROP POLICY IF EXISTS "Users can update own profile" ON startupcreme.users;
DROP POLICY IF EXISTS "Users or admins can delete profile" ON startupcreme.users;

-- Public can view user profiles
CREATE POLICY "Public can view user profiles"
    ON startupcreme.users FOR SELECT
    USING (true);

-- Authenticated users can insert their own profile with role = 'user' (admins can insert any role)
CREATE POLICY "Users can insert own profile"
    ON startupcreme.users FOR INSERT
    WITH CHECK (
        auth.uid() = id AND (
            role = 'user' OR
            startupcreme.is_admin(auth.uid())
        )
    );

-- Authenticated users can update own profile, but CANNOT alter their role column
CREATE POLICY "Users can update own profile"
    ON startupcreme.users FOR UPDATE
    USING (
        auth.uid() = id OR
        startupcreme.is_admin(auth.uid())
    )
    WITH CHECK (
        (auth.uid() = id AND role = (SELECT u.role FROM startupcreme.users u WHERE u.id = auth.uid())) OR
        startupcreme.is_admin(auth.uid())
    );

-- User or admin can delete profile
CREATE POLICY "Users or admins can delete profile"
    ON startupcreme.users FOR DELETE
    USING (
        auth.uid() = id OR
        startupcreme.is_admin(auth.uid())
    );

-- Database trigger to strictly prohibit role escalation
CREATE OR REPLACE FUNCTION startupcreme.prevent_user_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = startupcreme, public
AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF NEW.role IS DISTINCT FROM OLD.role AND NOT startupcreme.is_admin(auth.uid()) THEN
            RAISE EXCEPTION 'Forbidden: Non-admin users cannot alter their role';
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        IF NEW.role = 'admin' AND NOT startupcreme.is_admin(auth.uid()) THEN
            IF auth.uid() IS NOT NULL THEN
                RAISE EXCEPTION 'Forbidden: Only administrators can assign the admin role';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_role_escalation ON startupcreme.users;
CREATE TRIGGER trg_prevent_user_role_escalation
    BEFORE INSERT OR UPDATE ON startupcreme.users
    FOR EACH ROW
    EXECUTE FUNCTION startupcreme.prevent_user_role_escalation();

-- --------------------------------------------------------------------
-- 3. EDITORIAL POSTS (startupcreme.posts): Admin-Only Writes & Drafts
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published posts" ON startupcreme.posts;
DROP POLICY IF EXISTS "Authenticated admins have full CRUD access" ON startupcreme.posts;
DROP POLICY IF EXISTS "Admins can insert posts" ON startupcreme.posts;
DROP POLICY IF EXISTS "Admins can update posts" ON startupcreme.posts;
DROP POLICY IF EXISTS "Admins can delete posts" ON startupcreme.posts;

-- Public and ordinary authenticated users can ONLY read published posts
CREATE POLICY "Public can view published posts"
    ON startupcreme.posts FOR SELECT
    USING (
        status = 'published' OR
        startupcreme.is_admin(auth.uid())
    );

-- Only admins can create, edit, or delete posts
CREATE POLICY "Admins can insert posts"
    ON startupcreme.posts FOR INSERT
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins can update posts"
    ON startupcreme.posts FOR UPDATE
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins can delete posts"
    ON startupcreme.posts FOR DELETE
    USING (startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 4. EVENTS & GRANTS (startupcreme.events): Admin-Only Writes & Draft Protection
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view events" ON startupcreme.events;
DROP POLICY IF EXISTS "Public can view published events" ON startupcreme.events;
DROP POLICY IF EXISTS "Authenticated users and service role can insert events" ON startupcreme.events;
DROP POLICY IF EXISTS "Authenticated users and service role can update events" ON startupcreme.events;
DROP POLICY IF EXISTS "Authenticated users and service role can delete events" ON startupcreme.events;
DROP POLICY IF EXISTS "Admins can insert events" ON startupcreme.events;
DROP POLICY IF EXISTS "Admins can update events" ON startupcreme.events;
DROP POLICY IF EXISTS "Admins can delete events" ON startupcreme.events;

-- Public can only view events whose linked post is published (or admin)
CREATE POLICY "Public can view published events"
    ON startupcreme.events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM startupcreme.posts p
            WHERE p.id = startupcreme.events.linked_post_id
              AND p.status = 'published'
        )
        OR
        startupcreme.is_admin(auth.uid())
    );

-- Write operations strictly restricted to admins
CREATE POLICY "Admins can insert events"
    ON startupcreme.events FOR INSERT
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins can update events"
    ON startupcreme.events FOR UPDATE
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins can delete events"
    ON startupcreme.events FOR DELETE
    USING (startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 5. ARTICLE COMMENTS (startupcreme.comments): User-Owned Rows
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public visitors can view comments" ON startupcreme.comments;
DROP POLICY IF EXISTS "Public and members can insert comments" ON startupcreme.comments;
DROP POLICY IF EXISTS "Anyone can write comments" ON startupcreme.comments;
DROP POLICY IF EXISTS "Users can manage own comments" ON startupcreme.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON startupcreme.comments;
DROP POLICY IF EXISTS "Users or admins can delete comments" ON startupcreme.comments;

CREATE POLICY "Public visitors can view comments"
    ON startupcreme.comments FOR SELECT
    USING (true);

CREATE POLICY "Public and members can insert comments"
    ON startupcreme.comments FOR INSERT
    WITH CHECK (
        content IS NOT NULL AND length(trim(content::text)) > 0 AND
        post_id IS NOT NULL AND
        (
            (auth.uid() IS NOT NULL AND user_id = auth.uid()) OR
            (auth.uid() IS NULL AND user_id IS NULL AND author_name IS NOT NULL AND length(trim(author_name::text)) > 0 AND author_email IS NOT NULL AND length(trim(author_email::text)) > 0) OR
            startupcreme.is_admin(auth.uid())
        )
    );

CREATE POLICY "Users can update own comments"
    ON startupcreme.comments FOR UPDATE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

CREATE POLICY "Users or admins can delete comments"
    ON startupcreme.comments FOR DELETE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 6. STARTUPS (startupcreme.startups): Submissions & Admin Moderation
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.startups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved startups" ON startupcreme.startups;
DROP POLICY IF EXISTS "Anyone can submit a startup" ON startupcreme.startups;
DROP POLICY IF EXISTS "Authenticated users can submit a startup" ON startupcreme.startups;
DROP POLICY IF EXISTS "Admins can manage startups" ON startupcreme.startups;
DROP POLICY IF EXISTS "Users can submit startups" ON startupcreme.startups;
DROP POLICY IF EXISTS "Users or admins can update startups" ON startupcreme.startups;
DROP POLICY IF EXISTS "Users or admins can delete startups" ON startupcreme.startups;

-- Public can only view approved startups; owners can view own submission; admin can view all
CREATE POLICY "Public can view approved startups"
    ON startupcreme.startups FOR SELECT
    USING (
        is_approved = true OR
        (auth.uid() IS NOT NULL AND (submitted_by = auth.uid() OR startupcreme.is_admin(auth.uid())))
    );

-- Authenticated users can submit a startup: must set submitted_by = auth.uid() and is_approved = false (unless admin)
CREATE POLICY "Users can submit startups"
    ON startupcreme.startups FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            (submitted_by = auth.uid() AND is_approved = false) OR
            startupcreme.is_admin(auth.uid())
        )
    );

-- Owners can edit their own submission (resets/keeps is_approved = false); admins can update/approve any
CREATE POLICY "Users or admins can update startups"
    ON startupcreme.startups FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND (submitted_by = auth.uid() OR startupcreme.is_admin(auth.uid()))
    )
    WITH CHECK (
        startupcreme.is_admin(auth.uid()) OR
        (auth.uid() IS NOT NULL AND submitted_by = auth.uid() AND is_approved = false)
    );

-- Owners can delete their own submission; admins can delete any
CREATE POLICY "Users or admins can delete startups"
    ON startupcreme.startups FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND (submitted_by = auth.uid() OR startupcreme.is_admin(auth.uid()))
    );

-- --------------------------------------------------------------------
-- 7. JOBS (startupcreme.jobs): Submissions & Admin Moderation
-- --------------------------------------------------------------------
DO $$ BEGIN
    ALTER TABLE startupcreme.jobs ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES startupcreme.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

ALTER TABLE startupcreme.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active jobs" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Anyone can post a job" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Authenticated users can post a job" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Authenticated users can manage jobs" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Users can post a job" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Users or admins can update jobs" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Users or admins can delete jobs" ON startupcreme.jobs;

-- Public can only view active jobs; owners can view own submission; admin can view all
CREATE POLICY "Public can view active jobs"
    ON startupcreme.jobs FOR SELECT
    USING (
        is_active = true OR
        (auth.uid() IS NOT NULL AND ((submitted_by IS NOT NULL AND submitted_by = auth.uid()) OR startupcreme.is_admin(auth.uid())))
    );

-- Authenticated users can post a job: must set submitted_by = auth.uid() and is_active = false (unless admin)
CREATE POLICY "Users can post a job"
    ON startupcreme.jobs FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            (submitted_by = auth.uid() AND is_active = false) OR
            startupcreme.is_admin(auth.uid())
        )
    );

-- Owners can edit their job (resets/keeps is_active = false); admins can update/activate any
CREATE POLICY "Users or admins can update jobs"
    ON startupcreme.jobs FOR UPDATE
    USING (
        auth.uid() IS NOT NULL AND ((submitted_by IS NOT NULL AND submitted_by = auth.uid()) OR startupcreme.is_admin(auth.uid()))
    )
    WITH CHECK (
        startupcreme.is_admin(auth.uid()) OR
        (auth.uid() IS NOT NULL AND submitted_by = auth.uid() AND is_active = false)
    );

-- Owners can delete their job; admins can delete any
CREATE POLICY "Users or admins can delete jobs"
    ON startupcreme.jobs FOR DELETE
    USING (
        auth.uid() IS NOT NULL AND ((submitted_by IS NOT NULL AND submitted_by = auth.uid()) OR startupcreme.is_admin(auth.uid()))
    );

-- --------------------------------------------------------------------
-- 8. NEWSLETTER SUBSCRIBERS (startupcreme.newsletter_subscribers)
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public newsletter subscription" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow public newsletter subscription insert" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow public newsletter subscription update" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow public newsletter subscription select" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Allow admin full access to newsletter subscribers" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Only admins can select newsletter subscribers" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Only admins can update newsletter subscribers" ON startupcreme.newsletter_subscribers;
DROP POLICY IF EXISTS "Only admins can delete newsletter subscribers" ON startupcreme.newsletter_subscribers;

-- Public can subscribe (INSERT only)
CREATE POLICY "Allow public newsletter subscription insert"
    ON startupcreme.newsletter_subscribers FOR INSERT
    TO anon, authenticated
    WITH CHECK (email IS NOT NULL AND length(trim(email)) > 3);

-- SELECT, UPDATE, DELETE strictly restricted to admins
CREATE POLICY "Only admins can select newsletter subscribers"
    ON startupcreme.newsletter_subscribers FOR SELECT
    USING (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Only admins can update newsletter subscribers"
    ON startupcreme.newsletter_subscribers FOR UPDATE
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete newsletter subscribers"
    ON startupcreme.newsletter_subscribers FOR DELETE
    USING (startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 9. RATE SNAPSHOTS (startupcreme.rate_snapshots): Admin-Only Writes
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.rate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read rate snapshots" ON startupcreme.rate_snapshots;
DROP POLICY IF EXISTS "Service and webhooks can insert rate snapshots" ON startupcreme.rate_snapshots;
DROP POLICY IF EXISTS "Admins can insert rate snapshots" ON startupcreme.rate_snapshots;
DROP POLICY IF EXISTS "Admins can update rate snapshots" ON startupcreme.rate_snapshots;
DROP POLICY IF EXISTS "Admins can delete rate snapshots" ON startupcreme.rate_snapshots;

CREATE POLICY "Public can read rate snapshots"
    ON startupcreme.rate_snapshots FOR SELECT
    USING (true);

CREATE POLICY "Admins can insert rate snapshots"
    ON startupcreme.rate_snapshots FOR INSERT
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins can update rate snapshots"
    ON startupcreme.rate_snapshots FOR UPDATE
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins can delete rate snapshots"
    ON startupcreme.rate_snapshots FOR DELETE
    USING (startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 10. FORUM TOPICS, COMMENTS, POLLS & VOTES
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.discussion_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_topic_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_comment_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.discussion_poll_votes ENABLE ROW LEVEL SECURITY;

-- Topics
DROP POLICY IF EXISTS "Public can view discussion topics" ON startupcreme.discussion_topics;
DROP POLICY IF EXISTS "Users can create discussion topics" ON startupcreme.discussion_topics;
DROP POLICY IF EXISTS "Users can edit own discussion topics" ON startupcreme.discussion_topics;
DROP POLICY IF EXISTS "Users can delete own discussion topics" ON startupcreme.discussion_topics;

CREATE POLICY "Public can view discussion topics"
    ON startupcreme.discussion_topics FOR SELECT
    USING (true);

CREATE POLICY "Users can create discussion topics"
    ON startupcreme.discussion_topics FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can edit own discussion topics"
    ON startupcreme.discussion_topics FOR UPDATE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

CREATE POLICY "Users can delete own discussion topics"
    ON startupcreme.discussion_topics FOR DELETE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

-- Discussion Comments
DROP POLICY IF EXISTS "Public can view discussion comments" ON startupcreme.discussion_comments;
DROP POLICY IF EXISTS "Users can create discussion comments" ON startupcreme.discussion_comments;
DROP POLICY IF EXISTS "Users can edit own comments" ON startupcreme.discussion_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON startupcreme.discussion_comments;

CREATE POLICY "Public can view discussion comments"
    ON startupcreme.discussion_comments FOR SELECT
    USING (true);

CREATE POLICY "Users can create discussion comments"
    ON startupcreme.discussion_comments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can edit own comments"
    ON startupcreme.discussion_comments FOR UPDATE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()))
    WITH CHECK (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

CREATE POLICY "Users can delete own comments"
    ON startupcreme.discussion_comments FOR DELETE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

-- Topic Votes
DROP POLICY IF EXISTS "Public can view topic votes" ON startupcreme.discussion_topic_votes;
DROP POLICY IF EXISTS "Users can vote on topics" ON startupcreme.discussion_topic_votes;
DROP POLICY IF EXISTS "Users can remove topic votes" ON startupcreme.discussion_topic_votes;

CREATE POLICY "Public can view topic votes"
    ON startupcreme.discussion_topic_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can vote on topics"
    ON startupcreme.discussion_topic_votes FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can remove topic votes"
    ON startupcreme.discussion_topic_votes FOR DELETE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

-- Comment Votes
DROP POLICY IF EXISTS "Public can view comment votes" ON startupcreme.discussion_comment_votes;
DROP POLICY IF EXISTS "Users can vote on comments" ON startupcreme.discussion_comment_votes;
DROP POLICY IF EXISTS "Users can remove comment votes" ON startupcreme.discussion_comment_votes;

CREATE POLICY "Public can view comment votes"
    ON startupcreme.discussion_comment_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can vote on comments"
    ON startupcreme.discussion_comment_votes FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can remove comment votes"
    ON startupcreme.discussion_comment_votes FOR DELETE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

-- Polls & Poll Options
DROP POLICY IF EXISTS "Public can view polls" ON startupcreme.discussion_polls;
DROP POLICY IF EXISTS "Public can view poll options" ON startupcreme.discussion_poll_options;
DROP POLICY IF EXISTS "Public can view poll votes" ON startupcreme.discussion_poll_votes;
DROP POLICY IF EXISTS "Users can vote on polls" ON startupcreme.discussion_poll_votes;
DROP POLICY IF EXISTS "Users can remove poll votes" ON startupcreme.discussion_poll_votes;
DROP POLICY IF EXISTS "Admins or owners can manage polls" ON startupcreme.discussion_polls;
DROP POLICY IF EXISTS "Admins or owners can manage poll options" ON startupcreme.discussion_poll_options;

CREATE POLICY "Public can view polls"
    ON startupcreme.discussion_polls FOR SELECT
    USING (true);

CREATE POLICY "Admins or owners can manage polls"
    ON startupcreme.discussion_polls FOR ALL
    USING (
        startupcreme.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM startupcreme.discussion_topics dt
            WHERE dt.id = startupcreme.discussion_polls.topic_id
              AND dt.user_id = auth.uid()
        )
    )
    WITH CHECK (
        startupcreme.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM startupcreme.discussion_topics dt
            WHERE dt.id = startupcreme.discussion_polls.topic_id
              AND dt.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view poll options"
    ON startupcreme.discussion_poll_options FOR SELECT
    USING (true);

CREATE POLICY "Admins or owners can manage poll options"
    ON startupcreme.discussion_poll_options FOR ALL
    USING (
        startupcreme.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM startupcreme.discussion_polls dp
            JOIN startupcreme.discussion_topics dt ON dt.id = dp.topic_id
            WHERE dp.id = startupcreme.discussion_poll_options.poll_id
              AND dt.user_id = auth.uid()
        )
    )
    WITH CHECK (
        startupcreme.is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM startupcreme.discussion_polls dp
            JOIN startupcreme.discussion_topics dt ON dt.id = dp.topic_id
            WHERE dp.id = startupcreme.discussion_poll_options.poll_id
              AND dt.user_id = auth.uid()
        )
    );

CREATE POLICY "Public can view poll votes"
    ON startupcreme.discussion_poll_votes FOR SELECT
    USING (true);

CREATE POLICY "Users can vote on polls"
    ON startupcreme.discussion_poll_votes FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Users can remove poll votes"
    ON startupcreme.discussion_poll_votes FOR DELETE
    USING (auth.uid() = user_id OR startupcreme.is_admin(auth.uid()));

-- --------------------------------------------------------------------
-- 11. AI SUBSYSTEM TABLES: Admin-Only Access
-- --------------------------------------------------------------------
ALTER TABLE startupcreme.ai_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE startupcreme.ai_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access to ai_tasks" ON startupcreme.ai_tasks;
DROP POLICY IF EXISTS "Admins full access to ai_actions" ON startupcreme.ai_actions;
DROP POLICY IF EXISTS "Admins full access to ai_approvals" ON startupcreme.ai_approvals;
DROP POLICY IF EXISTS "Admins full access to ai_alerts" ON startupcreme.ai_alerts;
DROP POLICY IF EXISTS "Admins full access to ai_memory" ON startupcreme.ai_memory;

CREATE POLICY "Admins full access to ai_tasks"
    ON startupcreme.ai_tasks FOR ALL
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins full access to ai_actions"
    ON startupcreme.ai_actions FOR ALL
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins full access to ai_approvals"
    ON startupcreme.ai_approvals FOR ALL
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins full access to ai_alerts"
    ON startupcreme.ai_alerts FOR ALL
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));

CREATE POLICY "Admins full access to ai_memory"
    ON startupcreme.ai_memory FOR ALL
    USING (startupcreme.is_admin(auth.uid()))
    WITH CHECK (startupcreme.is_admin(auth.uid()));
