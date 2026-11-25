# Workflow 4 — Product & UX Audit

**Default Profile:** `STANDARD`

## Sequence

1. **`Product Manager` (`hisabche-product-manager`)** maps real shopkeeper workflows across the 67 registered industries (`operational-dna`, `universal-core`) and validates feature composition without vertical silos.
2. **`UX Researcher` (`hisabche-ux-researcher`)** inspects `.claude/ux-audit/` and identifies navigation bottlenecks, redundant hubs/routes, and express-action gaps.
3. **`UI Designer` (`hisabche-ui-designer`)** audits `packages/ui` compliance: shared `DataTable`, `SelectField`, semantic `hsl(var(--color-*))` tokens, single `PageHub`/`HubTabs` + one `SegmentedControl`, and no fake empty states.
4. **`Internationalization Engineer` (`hisabche-i18n-engineer`)** audits `packages/i18n/messages/{fa,af,en}/common.json`, `.claude/DARI-GLOSSARY.md`, `useDateFormat()` Jalali/Gregorian calendars, logical RTL props (`ms-`/`me-`/`start-`), and locale-prefixed navigation.
5. **`Evidence Collector` (`hisabche-evidence-collector`)** records verified UI/i18n test outputs (`packages/ui`, `packages/i18n`, `packages/ui-contract`).

## Required Outputs

- User journey gaps across targeted trades
- UX consolidation & single-hub alignment findings
- Accessibility & RTL layout defects with exact TSX lines
- `fa`/`af`/`en` missing-key or terminology drift list
