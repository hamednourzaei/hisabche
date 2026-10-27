-- ═══════════════════════════════════════════════════════════════════════════
-- custom-units-02 — let the server remove a unit the business named itself
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE REQUEST (27 Oct 2026). The dashboard shows «۱ دستگاه لندکروز = ۴۰٬۰۰۰٬۰۰۰
-- افغانی» and the owner could not remove it: custom-units-01 granted the server
-- SELECT, INSERT and UPDATE only ("it never deletes").
--
-- WHAT THIS DOES. Grants DELETE on public.custom_unit_rates to service_role —
-- nothing else. The table is only a display/conversion list (no invoice,
-- payment or ledger line is ever kept in a custom unit), so removing a unit
-- loses no accounting data. The server deletes by (workspace_id, name).
--
-- Additive and re-runnable.
--
-- ROLLBACK / MITIGATION:
--   REVOKE DELETE ON public.custom_unit_rates FROM service_role;
--   Without this grant the endpoint answers UNITS_DELETE_NOT_ENABLED (409)
--   and the button shows that message; nothing else is affected.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

GRANT DELETE ON public.custom_unit_rates TO service_role;

COMMIT;
