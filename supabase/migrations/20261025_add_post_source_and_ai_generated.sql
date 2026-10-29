-- Migration: Add founders-mindset vertical enum, source tracking, and AI generation metadata to posts
-- Date: 2026-10-25

-- 1. Add 'founders-mindset' to content_vertical enum if not already present
ALTER TYPE startupcreme.content_vertical ADD VALUE IF NOT EXISTS 'founders-mindset';

-- 2. Add source_url, source_name, ai_generated, and hide_ai_disclosure columns to startupcreme.posts
ALTER TABLE startupcreme.posts
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hide_ai_disclosure boolean NOT NULL DEFAULT false;

-- 3. Comments documenting new provenance and disclosure columns
COMMENT ON COLUMN startupcreme.posts.source_url IS 'Optional canonical source URL (must be HTTPS) where the editorial draft or opportunity originated';
COMMENT ON COLUMN startupcreme.posts.source_name IS 'Optional readable attribution name for the source organization or publication';
COMMENT ON COLUMN startupcreme.posts.ai_generated IS 'Flag indicating if the post draft was synthesized or assisted by AI workflows';
COMMENT ON COLUMN startupcreme.posts.hide_ai_disclosure IS 'Admin preference to suppress public AI-assisted disclosure badge on published article';
