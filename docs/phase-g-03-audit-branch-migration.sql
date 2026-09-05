-- ============================================================================
-- docs/phase-g-03-audit-branch-migration.sql
--
-- PHASE G · G4 — the audit trail becomes branch-aware, and workspace-readable.
--
-- ---------------------------------------------------------------------------
-- WHAT IS ACTUALLY THERE (discovery, before this changes anything)
--
-- TWO datasets exist, and the architecture is right that they must stay two:
--
--   `activities`   USER ACTIVITY, for the interface. workspace_id NOT NULL,
--                  actor_id, entity, action, title, is_read, is_pinned. This is
--                  what /activities renders today and it works.
--
--   `audit_logs`   THE AUDIT TRAIL. user_id, action, entity_type, entity_id,
--                  old_data, new_data, ip_address, user_agent.
--
-- ⚠️ `audit_logs` has TWO gaps that G4 runs into:
--
--   1. NO `branch_id`. "Which branch issued this invoice, and who" cannot be
--      asked. That is the filter G4 names explicitly.
--
--   2. `workspace_id` EXISTS (added by live-reconciliation-migration.sql) but
--      `AuditService.log()` NEVER WRITES IT. Every row inserted since then has
--      it NULL.
--
-- That second one is why every read of `audit_logs` today runs behind
-- `platformAdminGuard` — the table cannot be filtered by workspace because the
-- column is empty, so it is treated as a platform-support surface and
-- `tenancy-static-guard.test.ts` documents the exclusion.
--
-- A member-facing audit tab needs the column populated. This file makes the
-- schema ready; the service change makes new rows carry it.
--
-- ---------------------------------------------------------------------------
-- ⚠️ WHAT THIS FILE DOES **NOT** DO — read before expecting a full tab
--
-- It does not invent history. Rows written before today have no workspace and
-- no branch, and there is no honest way to derive them:
--
--   · `user_id` cannot resolve a workspace for anyone who belongs to more than
--     one — and guessing would file one business's audit trail under another's,
--     which is the worst possible place to guess.
--   · The entity may since have been deleted, moved, or had its branch changed.
--
-- Section 3 backfills ONLY where the answer is unambiguous, and leaves the rest
-- NULL. §12 of the phase brief: unknown stays Unknown, never fabricated.
--
-- ---------------------------------------------------------------------------
-- ROLLBACK / MITIGATION
--
-- Additive only — two nullable columns, two indexes, no constraint that can
-- refuse an existing row. To undo:
--
--   DROP INDEX IF EXISTS audit_logs_workspace_branch_idx;
--   DROP INDEX IF EXISTS audit_logs_workspace_entity_idx;
--   ALTER TABLE audit_logs DROP COLUMN IF EXISTS branch_id;
--   ALTER TABLE activities DROP COLUMN IF EXISTS branch_id;
--
-- Dropping the columns loses the branch attribution recorded since the deploy.
-- Nothing else depends on them.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ============================================================================
-- PRE-MIGRATION VERIFICATION — run first, keep the output.
-- ============================================================================
--
-- P1. How much history is there, and how much of it has a workspace?
--     Expect: `with_workspace` at or near 0 — that is the gap described above.
--
--   SELECT COUNT(*)                                        AS total,
--          COUNT(workspace_id)                             AS with_workspace,
--          MIN(created_at)                                 AS earliest,
--          MAX(created_at)                                 AS latest
--   FROM audit_logs;
--
-- P2. What actually writes audit rows today? (entity types seen)
--
--   SELECT entity_type, action, COUNT(*)
--   FROM audit_logs GROUP BY entity_type, action ORDER BY 3 DESC LIMIT 20;
--
-- P3. Do the columns already exist? A re-run should report 1 for each.
--
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE table_schema='public' AND column_name='branch_id'
--     AND table_name IN ('audit_logs','activities');
--
-- P4. How many audit rows COULD get a workspace from an unambiguous user?
--     This is the ceiling on what section 3 can backfill.
--
--   SELECT COUNT(*) FROM audit_logs a
--   WHERE a.workspace_id IS NULL
--     AND EXISTS (
--       SELECT 1 FROM workspace_members m
--       WHERE m.user_id = a.user_id
--       GROUP BY m.user_id HAVING COUNT(DISTINCT m.workspace_id) = 1
--     );
--
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. The branch dimension, on BOTH datasets
--
-- The architecture asks for it on each, and for the same reason: "who did this,
-- and at which shop" is the question a multi-branch owner actually asks, and
-- neither table could answer it.
--
-- ⚠️ EXPLICIT COLUMNS, not a key inside `metadata`. A branch buried in JSONB
-- cannot be indexed usefully, cannot be foreign-keyed, and every reader has to
-- agree on the key name — which is how two readers end up disagreeing.
-- ---------------------------------------------------------------------------

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS branch_id uuid;

COMMENT ON TABLE audit_logs IS
  'THE AUDIT TRAIL — append-only evidence of what changed, for compliance and investigation. Distinct from `activities`, which is the interface''s feed and may be read, pinned and archived by the user. These two must NOT be merged: one answers "what happened to me lately", the other "prove what happened to this record". Phase G (G4).';

COMMENT ON COLUMN audit_logs.branch_id IS
  'Which branch the change happened at. NULL means unknown — either the row predates G4, or the action has no branch (a workspace-level setting). Never guessed.';

COMMENT ON COLUMN audit_logs.workspace_id IS
  'Tenancy boundary. NULL on rows written before G4, because AuditService.log() did not set it — which is why every read of this table ran behind platformAdminGuard. New rows carry it, and the member-facing read filters on it.';

COMMENT ON TABLE activities IS
  'USER ACTIVITY — the interface''s feed. Read/pinned/archived state belongs to the person looking at it. NOT the audit trail: see audit_logs. Phase G (G4).';

COMMENT ON COLUMN activities.branch_id IS
  'Which branch the activity happened at. NULL means unknown or not branch-specific.';

-- ---------------------------------------------------------------------------
-- 2. Indexes for the reads G4 names
--
-- "Invoices issued at branch X, by actor Y" is a workspace + entity_type +
-- branch + actor filter with a date sort. Workspace leads every index, because
-- it leads every query — it is the security boundary, so no read omits it.
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS audit_logs_workspace_branch_idx
  ON audit_logs (workspace_id, branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_workspace_entity_idx
  ON audit_logs (workspace_id, entity_type, created_at DESC);

-- The record-history panel: "every change to THIS invoice".
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_workspace_actor_idx
  ON audit_logs (workspace_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activities_workspace_branch_idx
  ON activities (workspace_id, branch_id, created_at DESC);

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_branch_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches (id) NOT VALID;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_branch_id_fkey;
ALTER TABLE activities ADD CONSTRAINT activities_branch_id_fkey
  FOREIGN KEY (branch_id) REFERENCES branches (id) NOT VALID;

-- ---------------------------------------------------------------------------
-- 3. Backfill — ONLY where the answer is unambiguous
--
-- Two passes, both conservative. Anything they cannot resolve stays NULL and is
-- reported by the post-migration query, rather than being guessed.
-- ---------------------------------------------------------------------------

-- 3a. Workspace, from an actor who belongs to exactly ONE workspace.
--
--     A user in two workspaces is skipped: assigning their audit rows to
--     either one would file one business's evidence under another's, and an
--     audit trail that is wrong about WHOSE it is has negative value.
WITH sole_membership AS (
  SELECT user_id, (array_agg(DISTINCT workspace_id))[1] AS workspace_id
  FROM   workspace_members
  GROUP  BY user_id
  HAVING COUNT(DISTINCT workspace_id) = 1
)
UPDATE audit_logs a
SET    workspace_id = m.workspace_id
FROM   sole_membership m
WHERE  a.workspace_id IS NULL
  AND  a.user_id = m.user_id;

-- 3b. Branch, from the entity the row is about — invoices and payments only.
--
--     ⚠️ This is the CURRENT branch of the document, not necessarily the branch
--     it was at when the audited change happened. For a document that has since
--     been moved between branches, it is wrong.
--
--     It is applied anyway, and only to these two types, because: a document's
--     branch is not something this product lets anyone change today, so the two
--     are the same in practice; and both are matched by `entity_id`, so a row
--     about a deleted document simply stays NULL rather than picking up
--     someone else's branch.
--
--     If document-level branch transfer is ever added, this backfill becomes a
--     guess and the rows it wrote should be re-examined.
UPDATE audit_logs a
SET    branch_id = i.branch_id
FROM   invoices i
WHERE  a.branch_id IS NULL
  AND  a.entity_type = 'invoice'
  AND  a.entity_id = i.id
  AND  a.workspace_id = i.workspace_id
  AND  i.branch_id IS NOT NULL;

UPDATE audit_logs a
SET    branch_id = p.branch_id
FROM   payments p
WHERE  a.branch_id IS NULL
  AND  a.entity_type = 'payment'
  AND  a.entity_id = p.id
  AND  a.workspace_id = p.workspace_id
  AND  p.branch_id IS NOT NULL;

-- Same two, for the activity feed.
UPDATE activities act
SET    branch_id = i.branch_id
FROM   invoices i
WHERE  act.branch_id IS NULL
  AND  act.entity_type = 'invoice'
  AND  act.entity_id = i.id
  AND  act.workspace_id = i.workspace_id
  AND  i.branch_id IS NOT NULL;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================
--
-- V1. Shape. Expect branch_id on both tables and the five indexes.
--
--   SELECT table_name, column_name, is_nullable FROM information_schema.columns
--   WHERE table_schema='public' AND column_name IN ('branch_id','workspace_id')
--     AND table_name IN ('audit_logs','activities')
--   ORDER BY table_name, column_name;
--
--   SELECT indexname FROM pg_indexes
--   WHERE tablename IN ('audit_logs','activities') AND indexname LIKE '%branch%';
--
-- V2. What the backfill could and could not resolve. NOT an error — this is the
--     honest measure of how much history predates the columns.
--
--   SELECT COUNT(*)                       AS total,
--          COUNT(workspace_id)            AS with_workspace,
--          COUNT(branch_id)               AS with_branch,
--          COUNT(*) - COUNT(workspace_id) AS unknown_workspace
--   FROM audit_logs;
--
-- V3. ⚠️ No audit row was filed under a workspace its actor does not belong to.
--     MUST BE EMPTY. A non-empty result means the backfill crossed a tenancy
--     boundary and those rows must be reset to NULL before anyone trusts the
--     member-facing tab.
--
--   SELECT a.id, a.user_id, a.workspace_id
--   FROM   audit_logs a
--   WHERE  a.workspace_id IS NOT NULL
--     AND  NOT EXISTS (
--       SELECT 1 FROM workspace_members m
--       WHERE  m.user_id = a.user_id AND m.workspace_id = a.workspace_id
--     );
--
-- V4. No branch was attributed from another workspace's document.
--     MUST BE EMPTY.
--
--   SELECT a.id, a.branch_id, b.workspace_id AS branch_workspace, a.workspace_id
--   FROM   audit_logs a
--   JOIN   branches b ON b.id = a.branch_id
--   WHERE  a.workspace_id IS DISTINCT FROM b.workspace_id;
--
-- V5. The filter G4 asks for, on real data: invoices by branch and actor.
--
--   SELECT a.branch_id, a.user_id, COUNT(*)
--   FROM   audit_logs a
--   WHERE  a.workspace_id = '<workspace uuid>' AND a.entity_type = 'invoice'
--   GROUP  BY a.branch_id, a.user_id
--   ORDER  BY 3 DESC;
