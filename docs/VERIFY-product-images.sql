-- ============================================================================
-- docs/VERIFY-product-images.sql — run AFTER docs/product-images-migration.sql.
-- Every row must say true. Read-only.
-- ============================================================================

SELECT 'table product_images exists' AS check,
       to_regclass('public.product_images') IS NOT NULL AS ok
UNION ALL
SELECT 'RLS enabled on product_images',
       coalesce((SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.product_images')), false)
UNION ALL
SELECT 'read policy exists',
       EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_images'
                AND policyname = 'product_images_workspace_read')
UNION ALL
SELECT 'position unique per product (deferrable)',
       EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_images_position_key' AND condeferrable)
UNION ALL
SELECT 'position limited to 0–7',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'product_images' AND c.contype = 'c'
                  AND pg_get_constraintdef(c.oid) ILIKE '%position%7%')
UNION ALL
SELECT 'product deleted → its images go (FK cascade)',
       EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'product_images' AND c.contype = 'f' AND c.confdeltype = 'c')
UNION ALL
SELECT 'function ' || f || ' exists', to_regprocedure(f) IS NOT NULL
  FROM unnest(ARRAY[
    'public.sync_product_cover(uuid)',
    'public.add_product_image(uuid, uuid, uuid, text, text, text)',
    'public.remove_product_image(uuid, uuid)',
    'public.reorder_product_images(uuid, uuid, uuid[])'
  ]) AS f
UNION ALL
SELECT 'clients cannot execute ' || f,
       NOT has_function_privilege('authenticated', to_regprocedure(f), 'EXECUTE')
       AND NOT has_function_privilege('anon', to_regprocedure(f), 'EXECUTE')
  FROM unnest(ARRAY[
    'public.sync_product_cover(uuid)',
    'public.add_product_image(uuid, uuid, uuid, text, text, text)',
    'public.remove_product_image(uuid, uuid)',
    'public.reorder_product_images(uuid, uuid, uuid[])'
  ]) AS f
UNION ALL
SELECT 'fixed search_path on ' || p.proname,
       coalesce(array_to_string(p.proconfig, ',') LIKE '%search_path=public, pg_temp%', false)
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('sync_product_cover', 'add_product_image', 'remove_product_image', 'reorder_product_images')
UNION ALL
SELECT 'bucket product-images is public with the 2 MB image limit',
       EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'product-images' AND public
                AND file_size_limit = 2097152
                AND allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
UNION ALL
SELECT 'no product has more than 8 images',
       NOT EXISTS (SELECT 1 FROM public.product_images GROUP BY product_id HAVING count(*) > 8)
UNION ALL
SELECT 'every cover equals its first image',
       NOT EXISTS (
         SELECT 1 FROM public.products p
           JOIN public.product_images i ON i.product_id = p.id AND i.position = 0
          WHERE p.image_url IS DISTINCT FROM i.url);
