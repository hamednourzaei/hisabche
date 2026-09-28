-- ============================================================================
-- docs/product-images-migration.sql                      (28 Sep 2026)
--
-- PRODUCT IMAGES — up to 8 per product, ordered, each with alt text.
--
--   product_images    one row per image: workspace, product, position 0–7,
--                     alt text, the storage path and its public URL.
--   bucket            `product-images`, PUBLIC read (a catalogue image is
--                     meant to be seen: the storefront and marketplace show
--                     it). jpeg/png/webp/avif, 2 MB. Paths are random UUIDs —
--                     nothing guessable, no workspace or product id in them.
--
-- THE COVER: `products.image_url` stays the one field every existing reader
-- uses (lists, storefront catalogue). The functions below keep it equal to
-- the image in position 0 — set when the first image arrives, moved on
-- reorder, cleared when the last image is removed. Nothing else writes it
-- while a product has images.
--
-- WHY FUNCTIONS: adding, removing and reordering each touch product_images
-- AND products (the cover) — one transaction each (CLAUDE.md rule 4). The
-- 8-image cap is enforced under a lock on the product row, so two uploads at
-- once cannot both be the 8th.
--
-- SAFETY
--   * Additive and idempotent (IF NOT EXISTS, CREATE OR REPLACE, guarded DO).
--   * The one existing object touched: products.image_url is WRITTEN by these
--     functions (no schema change to products).
--   * Every function: SECURITY INVOKER, fixed search_path, EXECUTE for
--     service_role only. Members READ their workspace's rows through RLS.
--
-- ROLLBACK
--   DROP FUNCTION IF EXISTS public.reorder_product_images(uuid, uuid, uuid[]);
--   DROP FUNCTION IF EXISTS public.remove_product_image(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.add_product_image(uuid, uuid, uuid, text, text, text);
--   DROP FUNCTION IF EXISTS public.sync_product_cover(uuid);
--   DROP TABLE IF EXISTS public.product_images;   -- products.image_url keeps its last cover
--   -- Images: empty the bucket in the Storage UI first, then
--   --   DELETE FROM storage.buckets WHERE id = 'product-images';
--   The backend answers PRODUCT_IMAGES_NOT_CONFIGURED (503) while they are absent.
-- ============================================================================

BEGIN;

-- ─── 1. The table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.product_images (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  product_id   uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position     integer NOT NULL CHECK (position BETWEEN 0 AND 7),
  alt_text     text NOT NULL DEFAULT '' CHECK (length(alt_text) <= 200),
  storage_path text NOT NULL UNIQUE,
  url          text NOT NULL CHECK (url ~ '^https?://'),
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Deferred: a reorder moves several rows through each other's positions
  -- inside one statement set; only the end state must be unique.
  CONSTRAINT product_images_position_key UNIQUE (product_id, position) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS product_images_workspace_idx ON public.product_images (workspace_id);

-- ─── 2. The cover (internal) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_product_cover(p_product_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  UPDATE products
     SET image_url = coalesce(
           (SELECT url FROM product_images WHERE product_id = p_product_id ORDER BY position LIMIT 1),
           '')
   WHERE id = p_product_id;
$$;

-- ─── 3. Add ─────────────────────────────────────────────────────────────────
-- The file is already in storage (the backend uploads first). A refusal here
-- leaves an orphan object the backend removes.
CREATE OR REPLACE FUNCTION public.add_product_image(
  p_workspace_id uuid,
  p_product_id   uuid,
  p_user_id      uuid,
  p_path         text,
  p_url          text,
  p_alt_text     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_row   product_images;
BEGIN
  -- The product row is the lock: two uploads at once queue here.
  PERFORM 1 FROM products WHERE id = p_product_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT count(*) INTO v_count FROM product_images WHERE product_id = p_product_id;
  IF v_count >= 8 THEN
    RAISE EXCEPTION 'PRODUCT_IMAGE_LIMIT' USING ERRCODE = '22023';
  END IF;

  INSERT INTO product_images (workspace_id, product_id, position, alt_text, storage_path, url, created_by)
  VALUES (p_workspace_id, p_product_id, v_count, left(coalesce(btrim(p_alt_text), ''), 200),
          p_path, p_url, p_user_id)
  RETURNING * INTO v_row;

  PERFORM sync_product_cover(p_product_id);
  RETURN to_jsonb(v_row);
END
$$;

-- ─── 4. Remove ──────────────────────────────────────────────────────────────
-- Returns the storage path so the backend can delete the object AFTER the row
-- is gone (a missing file is harmless; a row pointing at nothing is not).
CREATE OR REPLACE FUNCTION public.remove_product_image(p_workspace_id uuid, p_image_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product uuid;
  v_path    text;
BEGIN
  SELECT product_id INTO v_product
    FROM product_images WHERE id = p_image_id AND workspace_id = p_workspace_id;
  IF v_product IS NULL THEN
    RAISE EXCEPTION 'PRODUCT_IMAGE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM products WHERE id = v_product FOR UPDATE;

  DELETE FROM product_images WHERE id = p_image_id RETURNING storage_path INTO v_path;

  -- Close the gap: positions stay 0..n-1.
  UPDATE product_images pi
     SET position = ranked.rn - 1
    FROM (SELECT id, row_number() OVER (ORDER BY position) AS rn
            FROM product_images WHERE product_id = v_product) ranked
   WHERE pi.id = ranked.id;

  PERFORM sync_product_cover(v_product);
  RETURN v_path;
END
$$;

-- ─── 5. Reorder ─────────────────────────────────────────────────────────────
-- p_ids must name exactly the product's images, each once — the new order.
CREATE OR REPLACE FUNCTION public.reorder_product_images(
  p_workspace_id uuid,
  p_product_id   uuid,
  p_ids          uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current uuid[];
BEGIN
  PERFORM 1 FROM products WHERE id = p_product_id AND workspace_id = p_workspace_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(array_agg(id ORDER BY id), '{}') INTO v_current
    FROM product_images WHERE product_id = p_product_id;
  IF p_ids IS NULL
     OR cardinality(p_ids) <> cardinality(v_current)
     OR (SELECT array_agg(x ORDER BY x) FROM unnest(p_ids) AS x) IS DISTINCT FROM v_current THEN
    RAISE EXCEPTION 'PRODUCT_IMAGE_ORDER_INVALID' USING ERRCODE = '22023';
  END IF;

  UPDATE product_images pi
     SET position = o.ord - 1
    FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord)
   WHERE pi.id = o.id;

  PERFORM sync_product_cover(p_product_id);
END
$$;

-- ─── 6. Read access (RLS) ───────────────────────────────────────────────────
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS product_images_workspace_read ON product_images;

  IF to_regprocedure('private.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY product_images_workspace_read ON product_images FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT private.auth_workspace_ids()));
  ELSIF to_regprocedure('public.auth_workspace_ids()') IS NOT NULL THEN
    CREATE POLICY product_images_workspace_read ON product_images FOR SELECT TO authenticated
      USING (workspace_id IN (SELECT public.auth_workspace_ids()));
  ELSE
    RAISE NOTICE 'product_images: auth_workspace_ids() not found — RLS on with no read policy (clients read nothing; the backend is unaffected).';
  END IF;
END
$$;

-- ─── 7. Grants ──────────────────────────────────────────────────────────────
-- One by one: rpc-not-callable-by-clients.test.ts reads every REVOKE.
REVOKE ALL ON FUNCTION public.sync_product_cover(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_product_cover(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_product_cover(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.add_product_image(uuid, uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_product_image(uuid, uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_product_image(uuid, uuid, uuid, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.remove_product_image(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_product_image(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_product_image(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.reorder_product_images(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_product_images(uuid, uuid, uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_product_images(uuid, uuid, uuid[]) TO service_role;

GRANT SELECT ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;

-- ─── 8. Public images bucket ────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 2097152,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 2097152,
      allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

COMMIT;
