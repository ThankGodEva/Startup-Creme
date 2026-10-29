-- ==============================================================================
-- OPTIONAL MIGRATION: Drop StartupCrème AI Engine Tables and Types
-- ==============================================================================
-- IMPORTANT:
-- 1. All DROP statements below are deliberately COMMENTED OUT to prevent accidental data loss.
-- 2. Do NOT run this migration unless you explicitly intend to remove legacy AI subsystem data.
-- 3. The 'editorial_idempotency' table is used by the active editorial draft pipeline
--    and MUST NOT be included or dropped.
-- ==============================================================================

-- DROP TABLE IF EXISTS startupcreme.ai_memory CASCADE;
-- DROP TABLE IF EXISTS startupcreme.ai_alerts CASCADE;
-- DROP TABLE IF EXISTS startupcreme.ai_actions CASCADE;
-- DROP TABLE IF EXISTS startupcreme.ai_approvals CASCADE;
-- DROP TABLE IF EXISTS startupcreme.ai_tasks CASCADE;

-- DROP TYPE IF EXISTS startupcreme.ai_policy_level CASCADE;
-- DROP TYPE IF EXISTS startupcreme.ai_task_priority CASCADE;
-- DROP TYPE IF EXISTS startupcreme.ai_task_status CASCADE;
