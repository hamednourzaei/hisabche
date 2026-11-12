-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
-- Verify V61 B.2.21 translations jsonb column on products

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'translations';
