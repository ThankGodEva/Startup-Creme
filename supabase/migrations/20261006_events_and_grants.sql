-- ====================================================================
-- StartupCrème Schema Migration: Events, Grants, Accelerators & n8n Ingestion
-- Target Schema: startupcreme
-- ====================================================================

-- 1. Create opportunity_type enum in both public and startupcreme schemas
DO $$ BEGIN
    CREATE TYPE public.opportunity_type AS ENUM (
        'grant',
        'accelerator',
        'fellowship',
        'incubator',
        'pitch_competition',
        'hackathon',
        'conference',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE startupcreme.opportunity_type AS ENUM (
        'grant',
        'accelerator',
        'fellowship',
        'incubator',
        'pitch_competition',
        'hackathon',
        'conference',
        'general'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Ensure startupcreme.posts table exists with exact constraints and indexes
CREATE TABLE IF NOT EXISTS startupcreme.posts (
  id uuid not null default gen_random_uuid (),
  slug text not null,
  locale text not null default 'en-us'::text,
  vertical startupcreme.content_vertical not null,
  title text not null,
  excerpt text null,
  content jsonb not null,
  status startupcreme.publication_status not null default 'draft'::startupcreme.publication_status,
  meta_description text null,
  canonical_url text null,
  cover_image text null,
  author_name text null default 'Startup Crème Editorial'::text,
  author_role text null default 'Principal Editor'::text,
  author_avatar text null,
  dual_silo boolean null default false,
  silo_badge text null,
  tags text[] null default '{}'::text[],
  reading_time_minutes integer null default 5,
  word_count integer null default 800,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  updated_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint posts_pkey primary key (id)
);

-- Ensure unique_locale_vertical_slug constraint
DO $$ BEGIN
    ALTER TABLE startupcreme.posts ADD CONSTRAINT unique_locale_vertical_slug UNIQUE (locale, vertical, slug);
EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_vertical_locale on startupcreme.posts using btree (vertical, locale, status);
CREATE INDEX IF NOT EXISTS idx_posts_slug on startupcreme.posts using btree (slug);
CREATE INDEX IF NOT EXISTS idx_posts_updated_at on startupcreme.posts using btree (updated_at desc);

CREATE INDEX IF NOT EXISTS idx_sc_posts_vertical_locale on startupcreme.posts using btree (vertical, locale, status);
CREATE INDEX IF NOT EXISTS idx_sc_posts_slug on startupcreme.posts using btree (slug);
CREATE INDEX IF NOT EXISTS idx_sc_posts_updated_at on startupcreme.posts using btree (updated_at desc);

-- Trigger for updated_at on posts
DO $$ BEGIN
    CREATE TRIGGER update_posts_updated_at BEFORE
    UPDATE ON startupcreme.posts FOR EACH ROW
    EXECUTE FUNCTION startupcreme.update_updated_at_column ();
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Create startupcreme.events table
CREATE TABLE IF NOT EXISTS startupcreme.events (
  id uuid not null default gen_random_uuid (),
  title text not null,
  slug text not null,
  description text not null,
  opportunity_type public.opportunity_type not null,
  funding_amount text null,
  location text not null,
  deadline_date timestamp with time zone not null,
  application_url text not null,
  linked_post_id uuid null,
  created_at timestamp with time zone not null default timezone ('utc'::text, now()),
  constraint events_pkey primary key (id),
  constraint events_application_url_key unique (application_url),
  constraint events_slug_key unique (slug),
  constraint events_linked_post_id_fkey foreign KEY (linked_post_id) references startupcreme.posts (id) on delete set null
);

CREATE INDEX IF NOT EXISTS idx_events_deadline on startupcreme.events using btree (deadline_date);
CREATE INDEX IF NOT EXISTS idx_events_opportunity_type on startupcreme.events using btree (opportunity_type);

-- 4. Enable Row Level Security & Access Policies
ALTER TABLE startupcreme.events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view events" ON startupcreme.events;
CREATE POLICY "Public can view events"
  ON startupcreme.events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users and service role can insert events" ON startupcreme.events;
CREATE POLICY "Authenticated users and service role can insert events"
  ON startupcreme.events FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users and service role can update events" ON startupcreme.events;
CREATE POLICY "Authenticated users and service role can update events"
  ON startupcreme.events FOR UPDATE
  TO authenticated, service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users and service role can delete events" ON startupcreme.events;
CREATE POLICY "Authenticated users and service role can delete events"
  ON startupcreme.events FOR DELETE
  TO authenticated, service_role
  USING (true);

GRANT ALL ON TABLE startupcreme.events TO anon, authenticated, service_role, postgres;
