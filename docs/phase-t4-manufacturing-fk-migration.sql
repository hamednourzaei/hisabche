-- ============================================================================
-- T4 — the missing foreign keys that made /manufacturing return 500.
--
-- REPORTED SYMPTOM
--   GET api.hisabche.com/api/boms?limit=50         → 500
--   GET api.hisabche.com/api/work-orders?limit=50  → 500
--
-- CAUSE
--   base-schema-migration.sql created these columns WITHOUT a constraint:
--
--     CREATE TABLE work_orders ( ... product_id uuid, bom_id uuid, ... )
--     CREATE TABLE boms        ( ... product_id uuid, ... )
--     CREATE TABLE bom_items   ( ... bom_id uuid, raw_material_id uuid, ... )
--
--   The services ask PostgREST to embed the related product:
--
--     .select('..., product:products(id, name, unit)')
--
--   PostgREST resolves embeds from the FOREIGN KEY graph. With no constraint
--   there is no relationship to follow, so it answers PGRST200, the service
--   wrapped that in DatabaseError, and Fastify returned 500. The entire page
--   died on a missing constraint, not on missing data.
--
-- ⚠️ THIS MIGRATION IS NOT WHAT MAKES THE PAGE LOAD TODAY.
--   The services now fall back to a hand-written, workspace-filtered join when
--   they see PGRST200, so /manufacturing works whether or not this has run.
--   This migration is the real repair: it restores referential integrity and
--   lets PostgREST serve the efficient single-round-trip embed again.
--
-- ---------------------------------------------------------------------------
-- ⚠️ RUN SECTION 1 FIRST AND READ THE OUTPUT.
--
-- Adding a FOREIGN KEY fails if any row points at an id that does not exist.
-- Section 1 REPORTS those rows. It does not delete or rewrite anything — an
-- orphaned work order is a real record of something someone did, and deciding
-- what it means is a business call, not something a migration may guess (this
-- is guardrail 13: report first, never silently repair).
--
-- If section 1 returns all zeros, run section 2 and you are done.
-- If it returns rows, STOP and report them. Do not run section 2 — it will
-- fail on exactly those rows, which is the constraint doing its job.
--
-- ---------------------------------------------------------------------------
-- ADDITIVE AND IDEMPOTENT. No table created, no column dropped, no row
-- changed. Re-runnable: every constraint is added only if absent.
--
-- ROLLBACK / MITIGATION
--   ALTER TABLE boms        DROP CONSTRAINT IF EXISTS boms_product_id_fkey;
--   ALTER TABLE bom_items   DROP CONSTRAINT IF EXISTS bom_items_bom_id_fkey;
--   ALTER TABLE bom_items   DROP CONSTRAINT IF EXISTS bom_items_raw_material_id_fkey;
--   ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_product_id_fkey;
--   ALTER TABLE work_orders DROP CONSTRAINT IF EXISTS work_orders_bom_id_fkey;
--
--   Dropping them returns the database to its state before this file and the
--   API keeps working through the fallback path.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — ORPHAN REPORT.  Run this alone. Expect every count to be 0.
-- ============================================================================

SELECT 'boms.product_id'          AS relationship,
       COUNT(*)                   AS orphan_rows
FROM   boms b
WHERE  b.product_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM products p WHERE p.id = b.product_id)

UNION ALL
SELECT 'bom_items.bom_id',
       COUNT(*)
FROM   bom_items i
WHERE  i.bom_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM boms b WHERE b.id = i.bom_id)

UNION ALL
SELECT 'bom_items.raw_material_id',
       COUNT(*)
FROM   bom_items i
WHERE  i.raw_material_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM products p WHERE p.id = i.raw_material_id)

UNION ALL
SELECT 'work_orders.product_id',
       COUNT(*)
FROM   work_orders w
WHERE  w.product_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM products p WHERE p.id = w.product_id)

UNION ALL
SELECT 'work_orders.bom_id',
       COUNT(*)
FROM   work_orders w
WHERE  w.bom_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM boms b WHERE b.id = w.bom_id);


-- Cross-workspace check. A row referencing a product in ANOTHER workspace is
-- worse than an orphan: it is a tenancy defect, and a FK alone will not catch
-- it because the target id does exist. EXPECT: 0 rows.
SELECT 'boms → products'      AS relationship, b.id AS row_id,
       b.workspace_id AS row_workspace, p.workspace_id AS target_workspace
FROM   boms b JOIN products p ON p.id = b.product_id
WHERE  b.workspace_id IS DISTINCT FROM p.workspace_id

UNION ALL
SELECT 'work_orders → products', w.id, w.workspace_id, p.workspace_id
FROM   work_orders w JOIN products p ON p.id = w.product_id
WHERE  w.workspace_id IS DISTINCT FROM p.workspace_id

UNION ALL
SELECT 'bom_items → products', i.id, i.workspace_id, p.workspace_id
FROM   bom_items i JOIN products p ON p.id = i.raw_material_id
WHERE  i.workspace_id IS DISTINCT FROM p.workspace_id;


-- ============================================================================
-- SECTION 2 — THE CONSTRAINTS.  Run only after section 1 reports all zeros.
--
-- ON DELETE choices, each deliberate:
--
--   RESTRICT on a product referenced by a BOM or a work order. Deleting a
--   product that a bill of materials is built from must FAIL loudly. Cascading
--   would silently delete the recipe; SET NULL would leave a work order that
--   no longer says what it was making.
--
--   CASCADE on bom_items.bom_id. A line of a bill of materials has no meaning
--   without its bill — it is a child, not a record in its own right.
--
--   SET NULL on work_orders.bom_id. The work order stands on its own: it
--   records that goods were made. Losing the recipe it was based on does not
--   unmake them, and destroying that history to tidy up a reference would be
--   destroying the evidence of a real production run.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'boms_product_id_fkey') THEN
    ALTER TABLE boms
      ADD CONSTRAINT boms_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bom_items_bom_id_fkey') THEN
    ALTER TABLE bom_items
      ADD CONSTRAINT bom_items_bom_id_fkey
      FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bom_items_raw_material_id_fkey') THEN
    ALTER TABLE bom_items
      ADD CONSTRAINT bom_items_raw_material_id_fkey
      FOREIGN KEY (raw_material_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_product_id_fkey') THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_bom_id_fkey') THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_bom_id_fkey
      FOREIGN KEY (bom_id) REFERENCES boms(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Supporting indexes. A FK is not indexed automatically on the referencing
-- side, and every one of these columns is filtered on by the queries above.
CREATE INDEX IF NOT EXISTS boms_product_id_idx        ON boms (product_id);
CREATE INDEX IF NOT EXISTS bom_items_bom_id_idx       ON bom_items (bom_id);
CREATE INDEX IF NOT EXISTS bom_items_raw_material_idx ON bom_items (raw_material_id);
CREATE INDEX IF NOT EXISTS work_orders_product_id_idx ON work_orders (product_id);
CREATE INDEX IF NOT EXISTS work_orders_bom_id_idx     ON work_orders (bom_id);

COMMIT;

-- PostgREST caches the schema. The new relationships are invisible to the API
-- until it reloads — without this the embeds still answer PGRST200 and the
-- migration looks like it did nothing.
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- POST-MIGRATION VERIFICATION — PENDING HUMAN CONFIRMATION
-- ============================================================================

-- 1. All five constraints exist.  EXPECT: 5 rows
SELECT conname, conrelid::regclass AS on_table, confrelid::regclass AS references
FROM   pg_constraint
WHERE  conname IN (
         'boms_product_id_fkey',
         'bom_items_bom_id_fkey',
         'bom_items_raw_material_id_fkey',
         'work_orders_product_id_fkey',
         'work_orders_bom_id_fkey'
       )
ORDER  BY conname;

-- 2. Every constraint is VALIDATED — a NOT VALID one does not create the
--    relationship PostgREST needs.  EXPECT: convalidated = true on all 5
SELECT conname, convalidated
FROM   pg_constraint
WHERE  conname LIKE 'boms_%_fkey'
    OR conname LIKE 'bom_items_%_fkey'
    OR conname LIKE 'work_orders_%_fkey';

-- 3. The orphan report is still clean after the fact.  EXPECT: 0
SELECT COUNT(*) AS remaining_orphans
FROM   work_orders w
WHERE  w.product_id IS NOT NULL
  AND  NOT EXISTS (SELECT 1 FROM products p WHERE p.id = w.product_id);
