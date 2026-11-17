# V72 Privacy & Regulated Domains (S9 · D4)

## What is true in code today

- Regulated domains (`HEALTH_RECORDS`, `PRESCRIPTION`, `FINANCIAL_KYC`, `FOOD_SAFETY`) exist only as an
  Operational DNA axis (`regulatedDomainEnum`, `packages/validation/src/schemas/operational-dna.ts`) and as a
  visible setup gap. **No table stores medical, prescription, KYC or food-safety records**, so there is
  nothing to gate yet.
- No sensitive field was added to the CRM / customer tables by V72 (D4 default kept).

## Correction (16 Nov 2026)

The first V72 pass added `isRegulatedDomainAccessAllowed`, which checked four capabilities
(`health.records.read`, …) that do not exist in the permission model (`packages/auth-core/src/permissions.ts`)
and was called by nothing but its own test. A guard with no caller and no grantable capability is UI theater;
it was removed together with its test.

## NEEDS_OWNER_DECISION

1. Will Hisabche store clinical / prescription / KYC records at all? Default: **no** (keep them out).
2. If yes: which roles may read them, and what retention applies? The store must be a separate table with
   its own capability in `auth-core`, denied by default, before any field is collected.
3. Statutory rules (health authority, data protection) are not invented here.
