-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'overhead_policies') AS policies_table_ok,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'overhead_allocation_runs') AS runs_table_ok;
