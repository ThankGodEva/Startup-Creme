-- ====================================================================
-- StartupCrème Growth & Product Expansion Modules Migration
-- Modules:
--   Module 2: The Startup & FinTech Directory (startupcreme.startups)
--   Module 3: Macro & Cloud Rate Trackers (startupcreme.rate_snapshots)
--   Module 4: Niche Remote Startup Job & Fractional Talent Board (startupcreme.jobs)
-- ====================================================================

CREATE SCHEMA IF NOT EXISTS startupcreme;

-- 1. MODULE 2: Startup & FinTech Directory Schema (startupcreme.startups)
DO $$ BEGIN
    CREATE TYPE startupcreme.startup_stage AS ENUM ('idea', 'mvp', 'seed', 'series_a', 'bootstrapped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.startup_stage AS ENUM ('idea', 'mvp', 'seed', 'series_a', 'bootstrapped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS startupcreme.startups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tagline text NOT NULL,
  description text NOT NULL,
  website_url text NOT NULL,
  logo_url text NULL,
  stage startupcreme.startup_stage NOT NULL DEFAULT 'mvp',
  vertical text NOT NULL, -- e.g., 'FinTech', 'AI', 'EdTech'
  tech_stack text[] NOT NULL DEFAULT '{}', -- e.g., ['React Router', 'Supabase', 'Tailwind']
  submitted_by uuid REFERENCES startupcreme.users(id) ON DELETE SET NULL,
  is_approved boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_startups_vertical ON startupcreme.startups (vertical) WHERE is_approved = true;
CREATE INDEX IF NOT EXISTS idx_startups_stage ON startupcreme.startups (stage) WHERE is_approved = true;

ALTER TABLE startupcreme.startups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved startups" ON startupcreme.startups;
CREATE POLICY "Public can view approved startups"
  ON startupcreme.startups FOR SELECT
  USING (is_approved = true OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can submit a startup" ON startupcreme.startups;
DROP POLICY IF EXISTS "Authenticated users can submit a startup" ON startupcreme.startups;
CREATE POLICY "Authenticated users can submit a startup"
  ON startupcreme.startups FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage startups" ON startupcreme.startups;
CREATE POLICY "Admins can manage startups"
  ON startupcreme.startups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 2. MODULE 3: Macro & Cloud Rate Trackers Schema (startupcreme.rate_snapshots)
CREATE TABLE IF NOT EXISTS startupcreme.rate_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('central_bank', 'cloud_pricing', 'combined')),
  source text NOT NULL DEFAULT 'n8n_webhook',
  central_bank_rates jsonb NOT NULL DEFAULT '[]'::jsonb,
  cloud_pricing_index jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_snapshots_recorded_at ON startupcreme.rate_snapshots (recorded_at DESC);

ALTER TABLE startupcreme.rate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read rate snapshots" ON startupcreme.rate_snapshots;
CREATE POLICY "Public can read rate snapshots"
  ON startupcreme.rate_snapshots FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service and webhooks can insert rate snapshots" ON startupcreme.rate_snapshots;
CREATE POLICY "Service and webhooks can insert rate snapshots"
  ON startupcreme.rate_snapshots FOR INSERT
  TO anon, authenticated, service_role
  WITH CHECK (true);

-- 3. MODULE 4: Niche Remote Startup Job & Fractional Talent Board (startupcreme.jobs)
CREATE TABLE IF NOT EXISTS startupcreme.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  company_name text NOT NULL,
  company_logo text NULL,
  location text NOT NULL, -- e.g., "Remote (Global)" or "Remote (Africa)"
  job_type text NOT NULL, -- e.g., "Full-time", "Contract", "Fractional"
  category text NOT NULL, -- e.g., "Engineering", "Finance", "Leadership"
  apply_url text NOT NULL,
  salary_range text NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE startupcreme.jobs ALTER COLUMN is_active SET DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_jobs_category ON startupcreme.jobs (category) WHERE is_active = true;

ALTER TABLE startupcreme.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active jobs" ON startupcreme.jobs;
CREATE POLICY "Public can view active jobs"
  ON startupcreme.jobs FOR SELECT
  USING (is_active = true OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can post a job" ON startupcreme.jobs;
DROP POLICY IF EXISTS "Authenticated users can post a job" ON startupcreme.jobs;
CREATE POLICY "Authenticated users can post a job"
  ON startupcreme.jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage jobs" ON startupcreme.jobs;
CREATE POLICY "Authenticated users can manage jobs"
  ON startupcreme.jobs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Clean up any previously seeded mock startups and jobs
DELETE FROM startupcreme.startups
WHERE slug IN (
  'paystack-treasury',
  'kora-quant',
  'vortex-inference',
  'moniepoint-ledger',
  'termii-omni',
  'lazer-edtech'
);

DELETE FROM startupcreme.jobs
WHERE title IN (
  'Fractional CFO (Series A & B SaaS)',
  'Staff Distributed Systems Engineer (Rust / Go)',
  'Principal Cloud FinOps Architect',
  'Senior Quantitative Financial Modeler',
  'Fractional CTO & AI Infrastructure Advisor',
  'Lead Full-Stack Engineer (React Router 7 + Supabase)'
);

GRANT ALL ON TABLE startupcreme.startups TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE startupcreme.rate_snapshots TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE startupcreme.jobs TO anon, authenticated, service_role, postgres;
