-- ============================================
-- Per-customer task outcomes (CRM)
-- Run manually against the Supabase/Postgres database.
--
-- A task targets many customers, but until now only the task as a whole had a
-- status. An employee who called eight of ten customers had no way to record
-- which two were unreachable, and the person who created the task could not
-- see it. This adds one column holding the per-customer result.
--
-- Shape of `customer_outcomes` (jsonb array, one entry per customer touched):
--   [{
--      "customerId":  "uuid",
--      "outcome":     "done" | "failed",
--      "recordedAt":  "2026-08-16T09:30:00.000Z",
--      "recordedBy":  "employee" | "owner",
--      "note":        "شماره خاموش بود"     -- required when outcome = failed
--   }]
--
-- Absent entry means "not attempted yet" — deliberately distinct from a
-- recorded failure, so progress counts stay honest.
--
-- Until this migration is run, the backend falls back gracefully (the same
-- 42703 "undefined column" catch used in docs/task-assignment-migration.sql).
-- ============================================

alter table interactions
  add column if not exists customer_outcomes jsonb not null default '[]'::jsonb;

-- Subject autocomplete reads the distinct subjects a user has already typed;
-- without this the lookup is a sequential scan of every interaction they own.
create index if not exists interactions_user_subject_idx
  on interactions (user_id, subject);
