// ============================================
// scripts/industry/sellable-criteria.mjs
//
// V64 §2 defines «sellable» as NINE things, each one proven by running
// something. V65 checked five of them and printed SELLABLE from that subset.
// This file is the single declaration of all nine, so the generator cannot
// quietly check a subset again.
//
// KINDS OF PROOF
//   global            one test file that proves the property for every industry
//                     (the property itself is not industry-specific)
//   industry-in-file  a table test: the file must pass AND name this industry
//   mapped            the industry's own acceptance suite, with a declared tag
//   artifact          results recorded by a real run in acceptance-results.json
//
// A VETO can only BLOCK, never satisfy. That asymmetry is deliberate: a source
// check must not be able to make an industry sellable on its own.
//
//   ✓ a criterion is met only by a test that RAN and passed (this commit)
//   ✓ a source needle can only add a missing-evidence code
// ============================================

import {
  INDUSTRY_ACCEPTANCE_TESTS,
  JOURNEY_SHARDS,
  industryJourneyTestOf,
} from './coverage-data.mjs'

/**
 * The nine criteria of V64 §2, in the order a business meets them.
 * `null`/empty evidence lists are not placeholders — they are the measured
 * statement that no such proof exists in this repository yet.
 */
export const CRITERIA = [
  {
    code: 'WORKSPACE_JOURNEY',
    section: '2.1',
    title: 'signup → workspace (workspace_create_with_owner) → books currency stored',
    kind: 'global',
    files: ['backend/src/__tests__/workspace-journey-http.test.ts'],
  },
  {
    code: 'ONBOARDING_JOURNEY',
    section: '2.2',
    title:
      'onboarding: questions match the model, DNA from every selected trade, primary trade stated by the user',
    kind: 'global',
    files: [
      'packages/validation/src/__tests__/dna-multi-industry.test.ts',
      'packages/ui/src/__tests__/operating-profile-wiring.test.ts',
    ],
    vetoes: ['PRIMARY_INDUSTRY_NOT_ASKED'],
  },
  {
    code: 'FIRST_VALUE_JOURNEY',
    section: '2.3',
    title:
      'first value: checklist from DNA, every step opens a page that is unlocked for this business',
    kind: 'industry-in-file',
    file: 'packages/validation/src/__tests__/first-value.test.ts',
  },
  {
    code: 'DAILY_OPERATIONS_JOURNEY',
    section: '2.4',
    title: "daily operations: the industry's own document → payment → stock/resource → ledger",
    kind: 'mapped',
    tag: 'operations',
  },
  {
    code: 'REPORTING_PROOF',
    section: '2.5',
    title:
      'reporting: profit with an explicit unknown, party balance by currency, stock or capacity',
    kind: 'mapped',
    tag: 'reporting',
  },
  {
    code: 'OFFLINE_GATE_PROOF',
    section: '2.6',
    title:
      'offline: every action either runs on the device or is an explicit online-only row in the matrix',
    kind: 'global',
    files: ['packages/api/src/__tests__/offline-matrix-guard.test.ts'],
  },
  {
    code: 'RETURNS_PROOF',
    section: '2.7',
    title: 'returns: cancelling/returning the same document restores the balances',
    kind: 'mapped',
    tag: 'returns',
  },
  {
    code: 'POSTGRES_JOURNEY',
    section: '2.8',
    title: 'a chained journey on real PostgreSQL, recorded with the shipped commit',
    kind: 'artifact',
    artifact: 'postgres',
    map: 'INDUSTRY_POSTGRES_TESTS',
  },
  {
    code: 'BROWSER_JOURNEY',
    section: '2.8',
    title: 'a Playwright scenario on the web app, recorded with the shipped commit',
    kind: 'artifact',
    artifact: 'browser',
    map: 'INDUSTRY_BROWSER_TESTS',
  },
  {
    code: 'CLAIMS_PROOF',
    section: '2.9',
    title: 'landing, help and onboarding copy claim only what 1–8 proved',
    kind: 'global',
    files: ['packages/ui/src/__tests__/landing-claims.test.ts'],
  },
]

/**
 * What each mapped acceptance file is allowed to prove.
 *
 * Declared per FILE, not per industry, because the file is what ran. A tag is
 * only added here after reading the test's own cases: `manufacturing-page-500s`
 * proves that columns a migration never created are not selected — it is not a
 * business day, so it declares no tags and manufacturing loses «workflow
 * verified» in the report. The coverage table's `workflow_complete` is the
 * mapping fact; this is the evidence fact, and they are allowed to disagree.
 */
export const FILE_TAGS = {
  'backend/src/__tests__/http-e2e-business-day.test.ts': ['operations', 'returns'],
  'backend/src/__tests__/financial-flows-e2e.test.ts': ['operations', 'reporting'],
  'backend/src/__tests__/v59-1-gold-routes-http.test.ts': ['operations'],
  'backend/src/__tests__/v59-1-clothing-routes-http.test.ts': [
    'operations',
    'reporting',
    'returns',
  ],
  'backend/src/__tests__/v59-1-mobile-serials-http.test.ts': ['operations', 'returns'],
  'backend/src/__tests__/v59-1-repair-routes-http.test.ts': ['operations'],
  'backend/src/__tests__/service-delivery-http.test.ts': ['operations', 'returns'],
  'backend/src/__tests__/v59-1-exchange-gl-http.test.ts': ['operations'],
  'backend/src/__tests__/v60-http-families.test.ts': ['operations', 'reporting'],
  'backend/src/__tests__/manufacturing-page-500s.test.ts': [],
  // Per trade: sale → payment → stock → ledger; profit with its cost status, the party
  // balance (= the ledger receivable) and the shelf; one unit returned restores stock and
  // balances. Every figure is read back from the real database.
  ...Object.fromEntries(
    Array.from({ length: JOURNEY_SHARDS }, (_, i) => [
      `backend/src/__tests__/journey-industries-${i + 1}.pg.test.ts`,
      ['operations', 'reporting', 'returns'],
    ]),
  ),
}

/**
 * Per-industry chained PostgreSQL journeys (V64 §21.2): signup→DNA→document→payment→
 * return→report, per trade, on the whole migrated schema. Each trade maps to the ONE
 * shard file that runs it (`industryJourneyTestOf`). The runner records its real
 * status only with `--postgres`; a machine with no PostgreSQL records it skipped → failed.
 */
export const INDUSTRY_POSTGRES_TESTS = Object.fromEntries(
  Object.keys(INDUSTRY_ACCEPTANCE_TESTS).map((key) => [key, [industryJourneyTestOf(key)]]),
)

/**
 * Per-industry Playwright scenarios. Empty: `apps/web/e2e` has three app-level
 * specs and none of them completes an onboarding→first document→report journey
 * for a family. `playwright.config.ts` points at https://hisabche.com with
 * `channel: 'chrome'`, so a scenario here also needs a reachable target.
 */
export const INDUSTRY_BROWSER_TESTS = {}

/**
 * Vetoes: a source fact that can only block a criterion.
 *
 * §2.2 requires the user to STATE the primary trade. Today the wizard derives it
 * from registry order (`primaryIndustryKeyOf`), so there is no question and no
 * label for one. A question cannot be asked without a label, which is why the
 * label is the needle: add the question, add `onboarding.primaryIndustry` in all
 * three catalogues, and the veto lifts on its own.
 */
export const VETOES = {
  PRIMARY_INDUSTRY_NOT_ASKED: {
    file: 'packages/i18n/messages/en/common.json',
    needle: 'primaryIndustry',
  },
}
