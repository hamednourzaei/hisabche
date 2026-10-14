-- ═══════════════════════════════════════════════════════════════════════════
-- custom-units-01 — a unit the business names itself, priced in its books
-- currency
-- ═══════════════════════════════════════════════════════════════════════════
--
-- THE REQUEST (live audit #82, 14 Oct). A goldsmith, a money changer, a car
-- dealer each convert in units the currency list does not have: «یک ماشین»,
-- «یک بسته»… The rate panel could only quote the 25 codes of
-- `currencyCodeSchema`.
--
-- WHAT THIS IS — AND IS NOT. A named unit and how many books-currency units it
-- is worth ON A DAY, for converting and showing a figure. It is NOT a
-- currency: no invoice, payment or ledger line is ever kept in it (the books
-- stay in a real currency; gold and silver already exist as XAU/XAG grams).
--
--   custom_unit_rates (workspace_id, name, base_per_unit, rate_date)
--     · one quote per (business, unit name, day) — a later save that day
--       replaces it, like exchange_rates
--     · base_per_unit > 0, name 1–40 characters
--
-- Additive and re-runnable.
--
-- ROLLBACK / MITIGATION (only this feature's own table):
--   DROP TABLE IF EXISTS public.custom_unit_rates;
--   The server answers «not configured» without it; nothing else reads it.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.custom_unit_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,
  name          text NOT NULL,
  base_per_unit numeric(20, 6) NOT NULL,
  rate_date     date NOT NULL,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT custom_unit_rates_name_length
    CHECK (name IS NOT NULL AND char_length(btrim(name)) BETWEEN 1 AND 40),
  CONSTRAINT custom_unit_rates_positive
    CHECK (base_per_unit IS NOT NULL AND base_per_unit > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS custom_unit_rates_one_per_day
  ON public.custom_unit_rates (workspace_id, name, rate_date);

COMMENT ON TABLE public.custom_unit_rates IS
  'A unit a business names itself (a car, a bundle) and its worth in the books currency on a day. For converting and showing only — never a currency of a document.';

-- Supabase gives every new table ALL to anon, authenticated and service_role.
-- Only the server (service_role) reads and writes it, and it never deletes.
ALTER TABLE public.custom_unit_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.custom_unit_rates FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.custom_unit_rates TO service_role;

COMMIT;
