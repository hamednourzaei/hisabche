-- docs/VERIFY-till-bank-transfer.sql
-- Post-migration verification query generated — PENDING HUMAN CONFIRMATION
SELECT 'movement kind check accepts transfers' AS check,
       pg_get_constraintdef(oid) LIKE '%transfer_to_bank%' AND pg_get_constraintdef(oid) LIKE '%transfer_from_bank%' AS ok
FROM pg_constraint WHERE conname = 'pos_cash_movements_kind_check'
UNION ALL
SELECT 'every transfer movement has its journal entry',
       NOT EXISTS (
         SELECT 1 FROM public.pos_cash_movements m
         WHERE m.kind IN ('transfer_to_bank', 'transfer_from_bank')
           AND NOT EXISTS (SELECT 1 FROM public.journal_entries j
                           WHERE j.workspace_id = m.workspace_id
                             AND j.source_type = 'till_transfer' AND j.source_id = m.id)
       );
