-- ====================================================================
-- StartupCrème Schema Migration: Restrict Events Read Access by Linked Post Status
-- Target Schema: startupcreme
-- ====================================================================

-- 1. Ensure opportunity_type enums contain all supported values
DO $$ BEGIN
    ALTER TYPE public.opportunity_type ADD VALUE IF NOT EXISTS 'fellowship';
    ALTER TYPE public.opportunity_type ADD VALUE IF NOT EXISTS 'incubator';
    ALTER TYPE startupcreme.opportunity_type ADD VALUE IF NOT EXISTS 'fellowship';
    ALTER TYPE startupcreme.opportunity_type ADD VALUE IF NOT EXISTS 'incubator';
EXCEPTION
    WHEN duplicate_object OR undefined_object THEN null;
END $$;

-- 2. Ensure RLS is enabled on startupcreme.events
ALTER TABLE startupcreme.events ENABLE ROW LEVEL SECURITY;

-- 2. Drop legacy open SELECT policies
DROP POLICY IF EXISTS "Public can view events" ON startupcreme.events;
DROP POLICY IF EXISTS "Public can view published events" ON startupcreme.events;

-- 3. Create strict RLS SELECT policy:
-- Anonymous/public users can ONLY select events whose linked post has status = 'published'.
-- Authenticated admins retain full read access to all rows.
CREATE POLICY "Public can view published events"
  ON startupcreme.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM startupcreme.posts p
      WHERE p.id = startupcreme.events.linked_post_id
        AND p.status = 'published'
    )
    OR
    (auth.uid() IS NOT NULL AND startupcreme.is_admin(auth.uid()))
  );

-- 4. Grant appropriate table permissions
GRANT SELECT ON TABLE startupcreme.events TO anon, authenticated, service_role;
