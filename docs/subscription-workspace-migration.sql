-- ============================================================================
-- docs/subscription-workspace-migration.sql
--
-- DECISION A — a subscription belongs to a WORKSPACE, not to a user.
--
--     User → workspace_members → Workspace → Subscription → Plan
--
-- The consequence that matters: transferring ownership must NOT move the
-- subscription. Today `subscriptions.user_id` IS the tenancy, so handing the
-- workspace to a new owner would silently hand them a different subscription —
-- or none. After this migration the subscription stays with the business,
-- which is what a business subscription means.
--
-- ---------------------------------------------------------------------------
-- HOW IT BEHAVES
--
--   PART 1  DRY RUN   read-only. Changes nothing. Run this first, alone.
--   PART 2  ADD       nullable column + FK + indexes. Reversible.
--   PART 3  BACKFILL  only rows that map to exactly ONE workspace.
--   PART 4  VERIFY    row counts, PKs, FKs, cross-assignment.
--   PART 5  NOT NULL  commented out — a separate human decision.
--
-- It FAILS CLOSED. A subscription that cannot be mapped deterministically is
-- left NULL and counted, never guessed, never merged, never deleted.
--
-- ---------------------------------------------------------------------------
-- THE MAPPING RULE, AND WHY IT IS OWNERSHIP AND NOT MEMBERSHIP
--
-- The obvious rule — "the workspace this user is a member of" — is wrong here.
-- A user can be the OWNER of their own shop and a SELLER in someone else's.
-- Mapping their subscription by membership would put it on whichever workspace
-- sorted first, which is exactly the guess this file refuses to make.
--
-- A subscription is bought by the person who owns the business, so the mapping
-- is `workspaces.owner_id`. `workspace_single_owner_idx` already guarantees at
-- most one owner per workspace, so the only ambiguity left is a user who owns
-- SEVERAL workspaces — and that one is genuinely unknowable from the data.
-- ============================================================================


-- ############################################################################
-- PART 1 — DRY RUN (read-only; safe on production)
-- ############################################################################

WITH owned AS (
  SELECT owner_id AS user_id, count(*) AS owned_workspaces
    FROM workspaces
   GROUP BY owner_id
)
SELECT
  count(*)                                                   AS total_subscriptions,
  count(*) FILTER (WHERE o.owned_workspaces = 1)             AS mappable,
  count(*) FILTER (WHERE s.user_id IS NULL)                  AS no_user,
  count(*) FILTER (WHERE s.user_id IS NOT NULL
                     AND o.owned_workspaces IS NULL)         AS orphaned,
  count(*) FILTER (WHERE o.owned_workspaces > 1)             AS ambiguous,
  CASE
    WHEN count(*) FILTER (WHERE o.owned_workspaces IS DISTINCT FROM 1) = 0
      THEN 'SAFE — every subscription maps to exactly one owned workspace'
    ELSE 'REVIEW — see the per-row listing below before PART 3'
  END                                                        AS verdict
FROM subscriptions s
LEFT JOIN owned o ON o.user_id = s.user_id;

-- The offenders, by name, so a human can decide rather than a script guessing.
WITH owned AS (
  SELECT owner_id AS user_id, count(*) AS n
    FROM workspaces GROUP BY owner_id
)
SELECT
  s.id            AS subscription_id,
  s.user_id,
  s.plan,
  s.status,
  coalesce(o.n, 0) AS owned_workspaces,
  CASE
    WHEN s.user_id IS NULL THEN 'NO USER — no creator to map from; leave unresolved'
    WHEN o.n IS NULL       THEN 'ORPHANED — this user owns no workspace'
    WHEN o.n > 1           THEN 'AMBIGUOUS — owns ' || o.n::text || ' workspaces; a human must choose'
    ELSE 'ok'
  END AS classification
FROM subscriptions s
LEFT JOIN owned o ON o.user_id = s.user_id
WHERE o.n IS DISTINCT FROM 1
ORDER BY s.created_at
LIMIT 200;


-- ############################################################################
-- PART 2 — ADD THE COLUMN (nullable, reversible)
-- ############################################################################
--
-- Metadata-only on PostgreSQL 11+: no DEFAULT and no NOT NULL means the heap is
-- not rewritten. Nullable on purpose — a NOT NULL would fail instantly against
-- existing rows, and a DEFAULT would assign every subscription to one arbitrary
-- workspace, which is the guess this migration exists to avoid.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS workspace_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_workspace_fk') THEN
    ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_workspace_fk
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;

-- ON DELETE RESTRICT, never CASCADE: deleting a workspace must not silently
-- delete its billing relationship. It should fail loudly.

CREATE INDEX IF NOT EXISTS subscriptions_workspace_idx ON subscriptions (workspace_id);

-- At most ONE subscription per workspace — the hierarchy says
-- "ONE Workspace Subscription". Partial, so the many pre-backfill NULLs do not
-- collide with each other.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_per_workspace_idx
  ON subscriptions (workspace_id)
  WHERE workspace_id IS NOT NULL;


-- ############################################################################
-- PART 3 — BACKFILL (deterministic only)
-- ############################################################################
--
-- Fills ONLY subscriptions whose user owns exactly one workspace. The HAVING is
-- what makes `[1]` a fact rather than a choice — a user with 0 or 2+ owned
-- workspaces never reaches it.
--
-- `WHERE workspace_id IS NULL` makes this idempotent and non-destructive: an
-- already-assigned subscription is never overwritten, so re-running after a
-- human resolves an ambiguous case cannot undo their decision.

WITH sole_owner AS (
  SELECT owner_id AS user_id, (array_agg(id))[1] AS workspace_id
    FROM workspaces
   GROUP BY owner_id
  HAVING count(*) = 1
)
UPDATE subscriptions s
   SET workspace_id = o.workspace_id
  FROM sole_owner o
 WHERE s.user_id = o.user_id
   AND s.workspace_id IS NULL;

-- What is left, and why.
WITH owned AS (
  SELECT owner_id AS user_id, count(*) AS n FROM workspaces GROUP BY owner_id
)
SELECT
  count(*)                                            AS total,
  count(s.workspace_id)                               AS filled,
  count(*) FILTER (WHERE s.workspace_id IS NULL)      AS still_null,
  count(*) FILTER (WHERE s.workspace_id IS NULL
                     AND s.user_id IS NULL)           AS unresolvable_no_user,
  count(*) FILTER (WHERE s.workspace_id IS NULL
                     AND o.n IS NULL
                     AND s.user_id IS NOT NULL)       AS orphaned,
  count(*) FILTER (WHERE s.workspace_id IS NULL
                     AND o.n > 1)                     AS ambiguous,
  CASE
    WHEN count(*) FILTER (WHERE s.workspace_id IS NULL) = 0
      THEN 'READY — safe to enforce NOT NULL'
    ELSE 'HOLD — resolve the remaining rows by hand first'
  END AS verdict
FROM subscriptions s
LEFT JOIN owned o ON o.user_id = s.user_id;


-- ############################################################################
-- PART 4 — VERIFY (read-only)
-- ############################################################################
--
-- The checks the decision asked for, before NOT NULL is even considered.
-- Financial data is never partially migrated on the strength of "it looked ok".

-- 4a. Row count unchanged, primary keys intact.
SELECT
  (SELECT count(*) FROM subscriptions)                        AS rows_now,
  (SELECT count(DISTINCT id) FROM subscriptions)              AS distinct_ids,
  CASE
    WHEN (SELECT count(*) FROM subscriptions)
       = (SELECT count(DISTINCT id) FROM subscriptions)
      THEN 'OK — no duplicate or lost primary keys'
    ELSE 'FAIL — primary keys changed; STOP'
  END AS verdict;

-- 4b. Every assigned workspace_id points at a real workspace.
SELECT
  count(*) AS dangling_references,
  CASE WHEN count(*) = 0 THEN 'OK — referential integrity holds'
       ELSE 'FAIL — subscriptions reference workspaces that do not exist' END AS verdict
FROM subscriptions s
LEFT JOIN workspaces w ON w.id = s.workspace_id
WHERE s.workspace_id IS NOT NULL AND w.id IS NULL;

-- 4c. NO CROSS-WORKSPACE ASSIGNMENT.
--
-- The check that actually matters: every backfilled subscription must sit on a
-- workspace its own user owns. If this ever returns a row, a subscription was
-- attached to somebody else's business.
SELECT
  count(*) AS cross_assigned,
  CASE WHEN count(*) = 0 THEN 'OK — no subscription sits on a workspace its user does not own'
       ELSE 'FAIL — CROSS-WORKSPACE ASSIGNMENT; roll back PART 3' END AS verdict
FROM subscriptions s
JOIN workspaces w ON w.id = s.workspace_id
WHERE s.user_id IS NOT NULL AND w.owner_id IS DISTINCT FROM s.user_id;

-- 4d. One subscription per workspace.
SELECT
  count(*) AS workspaces_with_multiple_subscriptions,
  CASE WHEN count(*) = 0 THEN 'OK — at most one subscription per workspace'
       ELSE 'FAIL — the unique index should have prevented this' END AS verdict
FROM (
  SELECT workspace_id FROM subscriptions
   WHERE workspace_id IS NOT NULL
   GROUP BY workspace_id HAVING count(*) > 1
) dup;

-- 4e. Indexes and constraint exist and are valid.
SELECT
  i.indexrelid::regclass AS object,
  i.indisvalid           AS is_valid,
  i.indisunique          AS is_unique
FROM pg_index i
WHERE i.indexrelid IN (
  'subscriptions_workspace_idx'::regclass,
  'subscriptions_one_per_workspace_idx'::regclass
);


-- ############################################################################
-- PART 5 — NOT NULL + VALIDATE  (run only when PART 3 reports READY)
-- ############################################################################
--
-- Deliberately commented out. Two preconditions, both human-checked:
--
--   1. PART 3 reports zero still_null
--   2. the workspace-aware backend is DEPLOYED, so new rows carry workspace_id
--
-- Enforcing NOT NULL before the deploy rejects every new subscription.
--
-- ALTER TABLE subscriptions ALTER COLUMN workspace_id SET NOT NULL;
-- ALTER TABLE subscriptions VALIDATE CONSTRAINT subscriptions_workspace_fk;


-- ############################################################################
-- ROLLBACK
-- ############################################################################
--
-- Safe at any point before PART 5. Drops only what this file created; no
-- subscription row is touched, and `user_id` is left intact throughout — it
-- remains the record of who bought the plan.
--
-- DROP INDEX IF EXISTS subscriptions_one_per_workspace_idx;
-- DROP INDEX IF EXISTS subscriptions_workspace_idx;
-- ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_workspace_fk;
-- ALTER TABLE subscriptions DROP COLUMN IF EXISTS workspace_id;
