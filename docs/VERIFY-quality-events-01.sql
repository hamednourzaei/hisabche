-- ============================================================================
-- docs/VERIFY-quality-events-01.sql
-- Post-migration verification for V60 Slice 11 (`quality-events-01-migration.sql`)
-- Status: Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- ============================================================================

SELECT
  (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('quality_events', 'warranty_claims')) AS table_count,
  (SELECT count(*) FROM information_schema.triggers WHERE trigger_schema = 'public' AND event_object_table = 'quality_events' AND trigger_name = 'quality_events_no_update_delete') AS immutable_trigger_count,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('quality_events', 'warranty_claims') AND c.relrowsecurity = true) AS rls_enabled_count;
