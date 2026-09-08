-- ============================================================================
-- PATCH 3 / I1 — three gaps in `leaves`.
--
-- Direct inspection of the live schema against the I1 guardrails found:
--
--   1. `total_days integer` — no half-day leave is expressible
--   2. no `branch_id`      — branch consistency cannot be checked at all
--   3. no `requested_by`   — the actor who ASKED is not separable from the
--                            actor who APPROVED
--
-- ---------------------------------------------------------------------------
-- ⚠️ EVERY CHANGE IS ADDITIVE. `total_days` IS KEPT.
--
-- `total_days` is read by existing code and by any report already built on it.
-- Rewriting its type would change what those reads return mid-flight. The new
-- column sits beside it, the backfill makes them agree today, and the readers
-- move over deliberately — the list is in the summary.
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_duration_half_day_steps;
--   ALTER TABLE leaves DROP COLUMN IF EXISTS duration_units;
--   ALTER TABLE leaves DROP COLUMN IF EXISTS branch_id;
--   ALTER TABLE leaves DROP COLUMN IF EXISTS requested_by;
--
--   `total_days` is untouched throughout, so every existing reader keeps
--   working before, during and after.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Half-day leave.
--
-- ⚠️ THE CHECK IS THE POINT, NOT THE numeric TYPE.
--
-- A bare `numeric` would accept 0.37 of a day, which is not a thing anyone can
-- roster, approve or pay. `duration_units * 2 = trunc(duration_units * 2)` is
-- how «only whole and half days» is expressed in SQL: doubling makes every
-- legal value an integer.
-- ---------------------------------------------------------------------------
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS duration_units numeric(6, 1);

COMMENT ON COLUMN leaves.duration_units IS
  'Patch 3 / I1 - leave length in days, in half-day steps. Replaces total_days, which is integer and cannot express a half day. total_days is kept for backward compatibility; new code reads this.';

-- Backfill: existing rows are whole days, so they are already valid values.
-- Only NULLs are written — a re-run cannot overwrite a half-day somebody has
-- since entered.
UPDATE leaves
   SET duration_units = total_days
 WHERE duration_units IS NULL;

-- Added AFTER the backfill: a CHECK added first would be evaluated against
-- rows that are still NULL, and NOT VALID/VALIDATE is a longer route to the
-- same place for a column this size.
ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_duration_half_day_steps;
ALTER TABLE leaves ADD CONSTRAINT leaves_duration_half_day_steps
  CHECK (
    duration_units IS NULL
    OR (duration_units > 0 AND duration_units * 2 = trunc(duration_units * 2))
  );


-- ---------------------------------------------------------------------------
-- 2. Which branch the leave belongs to.
--
-- ⚠️ THE BACKFILL USES THE ASSIGNMENT THAT WAS ACTIVE ON THE LEAVE'S DATE,
-- NOT TODAY'S PRIMARY.
--
-- `employee_branch_assignments` carries `starts_at` and `ends_at` precisely so
-- that "where did this person work in March" has an answer. Backfilling a
-- March leave with the branch they transferred to in July would state that the
-- leave happened somewhere the person had not started working — a fabricated
-- fact, and exactly the shape guardrail 12 forbids.
--
-- An employee with no assignment covering that date gets NULL. Not a guess.
-- ---------------------------------------------------------------------------
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches (id);

COMMENT ON COLUMN leaves.branch_id IS
  'Patch 3 / I1 - the branch this leave belongs to. NULL where no primary assignment covered the leave date; that is "unknown", never "the default branch".';

UPDATE leaves l
   SET branch_id = a.branch_id
  FROM employee_branch_assignments a
 WHERE l.branch_id IS NULL
   AND a.employee_id = l.employee_id
   AND a.workspace_id = l.workspace_id
   AND a.is_primary
   -- Active on the day the leave started.
   AND a.starts_at <= l.start_date
   AND (a.ends_at IS NULL OR a.ends_at >= l.start_date);

CREATE INDEX IF NOT EXISTS leaves_branch_idx ON leaves (branch_id) WHERE branch_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 3. Who asked, separately from who approved.
--
-- ⚠️ THE ACTOR MODEL IS THE AUTH USER, NOT `employees.id` — VERIFIED, NOT
-- ASSUMED.
--
-- `human-resources.service.ts` writes `user_id: ctx.userId` on create and
-- `approved_by: ctx.userId` on approval. Both are auth user ids. So
-- `requested_by` is the same kind of value as `approved_by`, and `user_id` on
-- an existing row IS the creator — which makes the backfill exact rather than
-- a guess.
-- ---------------------------------------------------------------------------
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS requested_by uuid;

COMMENT ON COLUMN leaves.requested_by IS
  'Patch 3 / I1 - the auth user who requested the leave. Same actor model as approved_by. Separated from it so "the person who asked also approved it" is a question the data can answer.';

-- `user_id` is written from ctx.userId at creation and never updated, so it is
-- the requester on every existing row.
UPDATE leaves
   SET requested_by = user_id
 WHERE requested_by IS NULL
   AND user_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. All three columns exist.  EXPECT: 3 rows
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_name = 'leaves'
  AND  column_name IN ('duration_units', 'branch_id', 'requested_by')
ORDER  BY column_name;

-- 2. ⚠️ duration_units AGREES WITH total_days ON EVERY EXISTING ROW.
--    EXPECT: 0. Anything else means the backfill did not do what it claims,
--    and the two numbers now disagree about the same leave.
SELECT COUNT(*) AS rows_where_they_disagree
FROM   leaves
WHERE  duration_units IS NOT NULL
  AND  duration_units <> total_days;

-- 3. Every duration is a legal half-day step.  EXPECT: 0
SELECT COUNT(*) AS illegal_durations
FROM   leaves
WHERE  duration_units IS NOT NULL
  AND  (duration_units <= 0 OR duration_units * 2 <> trunc(duration_units * 2));

-- 4. How much of the branch backfill landed, and how much is honestly unknown.
--    No expected value — this is a REPORT. A high null count is not a failure;
--    it means those employees had no primary assignment covering the leave
--    date, which is a real state and must not be filled with a guess.
SELECT COUNT(*)                                      AS total_leaves,
       COUNT(branch_id)                              AS branch_known,
       COUNT(*) - COUNT(branch_id)                   AS branch_unknown
FROM   leaves;

-- 5. ⚠️ NO LEAVE WAS GIVEN A BRANCH THE EMPLOYEE WAS NOT IN ON THAT DATE.
--    EXPECT: 0. This is the check that the backfill respected history rather
--    than stamping today's branch onto old rows.
SELECT COUNT(*) AS leaves_with_impossible_branch
FROM   leaves l
WHERE  l.branch_id IS NOT NULL
  AND  NOT EXISTS (
         SELECT 1 FROM employee_branch_assignments a
          WHERE a.employee_id = l.employee_id
            AND a.branch_id   = l.branch_id
            AND a.starts_at  <= l.start_date
            AND (a.ends_at IS NULL OR a.ends_at >= l.start_date)
       );

-- 6. requested_by is populated wherever user_id was.  EXPECT: 0
SELECT COUNT(*) AS rows_missing_requester
FROM   leaves
WHERE  requested_by IS NULL AND user_id IS NOT NULL;

-- 7. ⚠️ HOW OFTEN THE SAME PERSON ASKED AND APPROVED.
--    A REPORT, not a failure. This is the question the column was added to
--    make answerable, and the answer on historical data is worth seeing
--    before any rule is built on it.
SELECT COUNT(*) AS self_approved
FROM   leaves
WHERE  requested_by IS NOT NULL
  AND  approved_by IS NOT NULL
  AND  requested_by = approved_by;

-- 8. `total_days` is untouched.  EXPECT: the same count as before the run.
SELECT COUNT(*) AS rows_with_total_days FROM leaves WHERE total_days IS NOT NULL;
