-- ═══════════════════════════════════════════════════════════════════════════
-- FINDING — what the attendance tables look like right now
-- ═══════════════════════════════════════════════════════════════════════════
--
-- READ-ONLY. One statement. Run it BEFORE attendance-devices-01 and send the
-- output: it shows whether the two failed runs left anything behind (they
-- should not have — each ran inside one transaction), and which of the
-- attendance migrations are in place.
-- ═══════════════════════════════════════════════════════════════════════════

WITH wanted (name, belongs_to) AS (
  VALUES
    ('attendance_devices',             'attendance-workforce (older) — must stay as it is'),
    ('attendance_device_events',       'attendance-workforce (older) — must stay as it is'),
    ('attendance_links',               'attendance-self-01'),
    ('attendance_submissions',         'attendance-self-01'),
    ('attendance_terminals',           'attendance-devices-01'),
    ('attendance_terminal_identities', 'attendance-devices-01'),
    ('attendance_terminal_events',     'attendance-devices-01'),
    ('attendance_phone_keys',          'attendance-02'),
    ('work_shifts',                    'work-shifts-01'),
    ('shift_assignments',              'shift-assignments-01')
)
SELECT w.name AS "table",
       w.belongs_to,
       to_regclass('public.' || w.name) IS NOT NULL AS present,
       (SELECT COUNT(*) FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = w.name) AS columns,
       (SELECT string_agg(c.column_name, ', ' ORDER BY c.ordinal_position)
          FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = w.name
           AND c.column_name IN ('key_hash', 'payload_hash', 'work_day', 'ends_next_day',
                                 'require_unlock', 'source', 'time_zone')) AS telling_columns
  FROM wanted w
UNION ALL
SELECT 'attendance (the sheet)', 'base schema', true,
       (SELECT COUNT(*) FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = 'attendance'),
       (SELECT string_agg(c.column_name, ', ' ORDER BY c.ordinal_position)
          FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = 'attendance'
           AND c.column_name IN ('source', 'ends_next_day'))
ORDER BY 2, 1;
