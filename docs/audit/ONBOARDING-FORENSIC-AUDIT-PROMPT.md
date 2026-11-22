graphify رو در پروژه اپدیت بکن کد بیس اپدیت بکن طبق اون اماده بودی بگو
خب حالا ممیزی را از رویه کد بیس و گرافیفای انجام بده و پرامپت زیر را کامل بکن
اول پرامپت رو بنویس بعد کامل بکن

# HISABCHE — ONBOARDING FORENSIC AUDIT & COMPLETE REMEDIATION

## 100-FINDING INDUSTRY-AWARE ONBOARDING RELIABILITY INITIATIVE

**Mission:** Perform a repository-wide forensic audit of the entire Hisabche onboarding system, identify at least 100 distinct defects, architectural weaknesses, inconsistencies, missing integrations, and verification gaps, then implement and verify all actionable fixes.

**Repository:** Hisabche  
**Target:** `https://hisabche.com`  
**Primary concern:** Business onboarding, industry selection, multi-industry support, Operational DNA, capability resolution, workspace provisioning, activation, online/offline consistency, and every downstream consumer of onboarding data.

**Execution mode:** Autonomous, evidence-driven, implementation-focused.

---

# 1. NON-NEGOTIABLE EXECUTION DIRECTIVE

This is not a documentation-only audit.

You must:

1. Inspect the actual repository and its current working tree.
2. Read all applicable `AGENTS.md` and project-specific engineering instructions.
3. Audit the complete onboarding lifecycle and all connected systems.
4. Identify at least 100 distinct findings.
5. Create a prioritized remediation plan.
6. Implement all verified and actionable defects.
7. Add regression tests for every corrected behavior.
8. Execute the relevant test suites.
9. Continue until all actionable findings are resolved or have a precisely documented external blocker.
10. Produce a final evidence-based report.

Do not stop after producing the audit.

Do not ask for permission between implementation phases.

Do not stop merely because the task is large.

Do not mark a task complete because its UI looks correct.

Do not hide, disable, or remove functionality to conceal a defect.

Do not introduce temporary workarounds, mock implementations, fake success responses, or hardcoded industry-specific exceptions.

If one implementation path is blocked, investigate alternative solutions within the existing architecture and continue with independent work.

---

# 2. ENGINEERING SAFETY RULES

Preserve all existing user work.

- Never commit or push.
- Never reset, rebase, stash, checkout, or clean the repository.
- Never overwrite unrelated modifications.
- Never inspect, expose, or modify `.env` files or secrets.
- Never execute live Supabase DDL or production database writes.
- Never install, upgrade, downgrade, or remove dependencies unless explicitly authorized.
- Never change Expo SDK, React Native, or the existing mobile architecture.
- Never run production builds unless explicitly requested.
- Do not introduce new architectural engines when an existing shared engine can be extended.
- Do not duplicate business logic across frontend, backend, local engine, and mobile.
- Do not use `any`, `@ts-ignore`, `eslint-disable`, or unsafe type assertions to bypass correctness.
- Respect `exactOptionalPropertyTypes`.
- Follow existing repository conventions and package ownership.

Use English for source code, identifiers, comments, and technical documentation.

Write the final human-readable execution report in Persian.

---

# 3. PHASE ZERO — REPOSITORY DISCOVERY

Before changing code:

1. Inspect Git status, current branch, HEAD, and changed-file count.
2. Read root and nested engineering instructions.
3. Identify all onboarding-related packages and modules.
4. Trace the complete architecture.

Inspect at minimum:

- Onboarding pages and layouts.
- Onboarding containers and state management.
- Zustand persistence.
- Industry/business type registries.
- Industry profile registry.
- Operational DNA definitions and schemas.
- Capability resolution.
- Terminology resolution.
- Workspace provisioning.
- Account profile APIs.
- Workspace profile APIs.
- Activation gate.
- Onboarding middleware.
- Local-first onboarding.
- Local database schema and migrations.
- Local engine routes.
- API hooks and query invalidation.
- Permission and membership policies.
- Navigation and dashboard routing.
- Existing onboarding tests.
- Existing architecture documentation.
- All downstream consumers of selected industry and Operational DNA.

Search for duplicate definitions, legacy compatibility adapters, stale business-type unions, hardcoded industry assumptions, and independent sources of truth.

Do not assume that a documented architecture is implemented.

Trace actual runtime data flow:

`User Input → UI State → Validation → API → Backend Service → Database → Readback → Capability Resolver → Navigation → Module UI → Offline Engine`

Identify every broken or incomplete transition.

---

# 4. FORENSIC AUDIT — AT LEAST 100 DISTINCT FINDINGS

Create a structured audit with at least 100 unique findings.

Do not manufacture findings to reach the target.

Each finding must contain:

- Unique ID.
- Category.
- Severity: P0 / P1 / P2 / P3.
- Confidence: CONFIRMED / RISK / TEST GAP.
- Exact source file and relevant symbol.
- Technical explanation.
- Actual or potential user impact.
- Reproduction scenario.
- Root cause.
- Proposed correction.
- Regression test required.
- Final remediation status.

A test gap is not automatically a production defect.

A risk is not automatically a confirmed runtime incident.

Deduplicate findings that share the same root cause.

Audit these domains comprehensively:

## A. Industry Selection and Business Type Modeling

Inspect:

- Single-industry and multi-industry selection.
- Trade IDs and sales models.
- Retail and wholesale classification.
- Primary industry selection.
- Secondary industries.
- Unknown and legacy IDs.
- Other/custom industry handling.
- Industry registry consistency.
- Duplicate IDs.
- Selection ordering.
- Maximum selection constraints.
- Industry localization.
- Industry-specific question definitions.
- Server-side validation.
- Database persistence.
- Industry editing after onboarding.

Establish a canonical typed representation.

Never store a structured multi-industry selection as an opaque comma-separated string.

Separate business models from actual trade classifications.

Ensure unknown industries never silently become retail or physical-goods businesses.

## B. Onboarding State and Persistence

Audit:

- Zustand persistence.
- Local storage versioning.
- State migrations.
- Browser refresh.
- Browser restart.
- Multi-tab behavior.
- Authentication changes.
- Logout/login.
- Workspace switching.
- Local draft ownership.
- Server draft ownership.
- Autosave.
- Retry.
- Debouncing.
- Request ordering.
- Concurrent updates.
- Stale local state.
- Stale server state.
- Partial draft restoration.
- Missing fields.
- Corrupt persisted data.

Ensure every user-entered field survives navigation, refresh, restart, and recoverable network failures.

Do not silently discard draft data.

Implement versioned migrations when necessary.

## C. Completion and Workspace Provisioning

Inspect every operation involved in completing onboarding.

Determine whether these operations are coordinated correctly:

- Workspace creation.
- Workspace membership.
- Currency configuration.
- Account profile.
- Workspace profile.
- Industry selection.
- Primary industry.
- Operational DNA.
- Capability composition.
- Onboarding progress.
- Activation state.
- Dashboard navigation.

Investigate:

- Partial completion.
- Duplicate submissions.
- Concurrent completion requests.
- Idempotency.
- Failed API responses.
- Null responses.
- Timeout.
- Retry.
- Version conflicts.
- Missing database columns.
- Authorization failures.
- Multi-workspace ambiguity.
- Owner versus delegated user behavior.

The user must never be told onboarding succeeded when required persistence failed.

Implement an idempotent server-authoritative completion workflow.

Where the existing architecture supports it, use a coherent transaction or an explicit recoverable state machine.

Do not pretend multiple independent writes are atomic.

Never navigate to an activated dashboard based exclusively on a local boolean.

Require authoritative server confirmation of successful activation.

## D. Operational DNA

Audit:

- All DNA axes.
- Question definitions.
- Question types.
- Answer options.
- Default values.
- Missing answers.
- Unknown answers.
- Multiple-industry merging.
- Conflicting industry defaults.
- User overrides.
- Suggested answers.
- Provenance.
- Schema validation.
- Versioning.
- Optimistic concurrency.
- Online/offline parity.
- Database persistence.
- Capability derivation.

Establish a consistent distinction between:

- Unanswered.
- Unknown.
- Not applicable.
- Explicitly disabled.
- User-confirmed.
- System-suggested.

Never silently overwrite user-confirmed values with inferred defaults.

Resolve conflicting multi-industry defaults deterministically and transparently.

## E. Capability and Industry Resolution

Audit every layer that consumes industry information:

- Capability resolver.
- Industry profile registry.
- Terminology resolver.
- Navigation.
- Dashboard.
- Tabs.
- Module visibility.
- Permissions.
- API access.
- Local engine.
- Reports.
- KPIs.
- Mobile consumers.
- Existing workspace settings.

A capability marked available must have an actual working workflow.

Do not confuse:

- Registered.
- Available.
- Implemented.
- Authorized.
- Workflow complete.
- Production verified.

Use evidence-based capability states.

Never use industry names as a substitute for actual capability requirements.

Do not create parallel industry-specific accounting, inventory, sales, or synchronization engines.

## F. Backend, Database, and API Contracts

Inspect:

- Account-level industry data.
- Workspace-level industry data.
- Profile schemas.
- API request validation.
- API response validation.
- Database constraints.
- Migrations.
- Authorization.
- RLS policies.
- Actor identity.
- Workspace isolation.
- Query keys.
- Cache invalidation.
- Version conflicts.
- Legacy compatibility.
- Error responses.
- Audit history.

Ensure malformed persisted data cannot silently become a valid-looking generic profile.

Do not silently filter invalid industry IDs.

Use strict runtime validation at trust boundaries.

Workspace-scoped queries must not leak cached data across workspaces.

## G. Offline-First and Local Engine

Verify:

- Offline onboarding.
- Local profile persistence.
- Local schema.
- Local migrations.
- Application restart.
- Server reconciliation.
- Local/server version conflicts.
- Device switching.
- Account switching.
- Workspace switching.
- Unknown industry behavior.
- Operational DNA parity.
- Capability resolution parity.

Preserve the existing Expo/RN constraints.

Do not introduce polling or an independent synchronization engine.

The same domain contract must be used across online and offline execution wherever the architecture permits.

## H. UX, Accessibility, and Localization

Audit:

- Every onboarding step.
- Validation messages.
- Error visibility.
- Loading states.
- Duplicate submissions.
- Back navigation.
- Progress indicators.
- Keyboard accessibility.
- Focus management.
- Screen-reader announcements.
- RTL and LTR.
- Persian, Dari, and English translations.
- Responsive layouts.
- Mobile viewport behavior.
- Unknown translation keys.
- Raw registry IDs.
- Inconsistent terminology.
- Review summaries.

All supported languages must have consistent key coverage.

Do not use raw technical identifiers in user-facing screens.

---

# 5. MANDATORY INITIAL FINDINGS TO VERIFY

The following issues were previously identified through source inspection. Recheck them against the current working tree; do not assume they still exist.

1. Industry selection represented using a legacy business-type union.
2. Multiple industry IDs serialized as comma-separated strings.
3. Sales models mixed with industry classifications.
4. Primary industry selection only shown for multiple selections.
5. Primary industry fallback based on selection insertion order.
6. Removing the selected primary industry without deterministic replacement.
7. Completion validation not independently enforcing canonical industry selection.
8. Unknown industry IDs displayed as raw strings.
9. Review summary merging different classification concepts.
10. Unsafe type assertions in industry state setters.
11. Missing mandatory description for custom/other industry.
12. Independently maintained industry registries.
13. Incomplete registry parity verification.
14. Legacy scalar-state migration missing.
15. Multi-industry end-to-end persistence not proven.
16. No explicit normalization of duplicate IDs.
17. UI selection limit not aligned with API limits.
18. Inconsistent unknown-industry policies.
19. Incomplete industry resolver regression tests.
20. No comprehensive primary-industry change regression test.
21. Whole-object Zustand persistence without a visible migration strategy.
22. Missing persisted-state versioning.
23. Bulk answer setter bypassing individual validation.
24. Unvalidated onboarding step setter.
25. Archetype presets without visible compatibility checks.
26. Separate client and server completion flags.
27. Client completion state updated independently of server activation.
28. Reset without server-draft reconciliation.
29. Incomplete verification of authentication-related state ownership.
30. Missing migration from legacy industry representation.
31. Business note held in component-local state.
32. Business note omitted from server progress.
33. Incomplete server draft restoration.
34. One-shot resume behavior.
35. Local state preferred without revision comparison.
36. ACTIVE draft not reconciled correctly.
37. Progress autosave failures swallowed.
38. Autosave without visible request coalescing.
39. Missing ordering protection for overlapping progress writes.
40. Step zero excluded from autosave.
41. Autosave skipped when operational profile is unavailable.
42. Progress persistence authorization policy requiring verification.
43. Workspace creation and profile persistence split into sequential writes.
44. Account profile updated before full workspace configuration.
45. Null workspace-profile save result not blocking completion.
46. Null DNA save result not blocking completion.
47. DNA version conflict refetched without reapplying user intent.
48. ACTIVE progress potentially written after DNA conflict.
49. Completion continues when Operational Profile is unavailable.
50. Local DNA updated before server confirmation.
51. Dashboard navigation without explicit authoritative activation readback.
52. Missing visible idempotency protection.
53. Missing duplicate-submission guard.
54. Generic error messages hiding partial persistence.
55. No clear recovery information after partial completion.
56. Workspace creation potentially left incomplete after later failure.
57. Retry idempotency not proven.
58. No fault-injection evidence for all completion boundaries.
59. Currency written before final confirmation.
60. Local currency changed before server success.
61. Failed currency update not visibly rolled back.
62. Duplicate currency writes.
63. Unsupported currency silently ignored.
64. Raw currency code in review summary.
65. Invalid store-size translation fallback.
66. Duplicate store-size translation keys.
67. Optional business description even for custom industry.
68. Store size required in UI but absent from activation prerequisites.
69. Weak email validation in local first-run flow.
70. Business-name validation needs authoritative verification.
71. Currency schema/catalogue parity not fully verified.
72. Keyboard accessibility not tested.
73. Translation parity not fully verified.
74. Progress indicator behavior not comprehensively tested.
75. Unsaved text preservation not proven.
76. Responsive RTL/LTR behavior not proven.
77. Repeated Next/Back handling not proven.
78. Suggested Operational DNA answers have ambiguous persistence semantics.
79. Missing answer conflated with unknown.
80. Unsupported question types fall back to generic options.
81. Question options duplicated in UI.
82. Legacy question aliases remain in presentation code.
83. Staff arrangement terminology ambiguous.
84. Question selection does not explicitly receive selected industries.
85. Multi-industry defaults merged without explicit conflict resolution.
86. Suggested and user-overridden values lack clear provenance.
87. Capability summary does not prove working workflows.
88. Capability labels can fall back to raw keys.
89. Translation fallback for capability packs needs verification.
90. Suggested feature-pack IDs may not be validated.
91. Available capability terminology may overstate implementation readiness.
92. Industry profiles do not themselves enforce navigation visibility.
93. Industry profiles do not grant authorization.
94. Industry profile and Operational DNA can diverge.
95. Industry question and schema parity not proven.
96. Capability availability lacks end-to-end evidence.
97. Account and workspace industry profiles persisted separately.
98. Profile APIs use different authorization paths.
99. Invalid DNA may silently become null.
100. Online/offline profile and activation parity not fully proven.

These are audit starting points, not automatically 100 confirmed defects. Verify, deduplicate, correct stale findings, and add further findings where necessary.

---

# 6. REQUIRED ARCHITECTURAL OUTCOME

The objective is one reliable onboarding architecture.

Establish the following canonical lifecycle:

`Onboarding Draft → Validated Business Profile → Operational DNA → Capability Composition → Workspace Configuration → Server Activation → Industry-Aware Application`

Requirements:

1. One canonical business profile contract.
2. One canonical industry registry.
3. Explicit separation of industry and sales model.
4. Typed multi-industry representation.
5. Explicit primary industry.
6. Versioned and recoverable draft persistence.
7. One authoritative completion workflow.
8. Idempotent completion requests.
9. Consistent online/offline validation.
10. Deterministic Operational DNA resolution.
11. Workspace-isolated profile caching.
12. Authoritative activation.
13. Industry-aware capability resolution.
14. No hidden generic/retail fallback.
15. No silent data loss.
16. No false activation success.
17. Full regression coverage.

Extend existing shared packages and domain engines rather than creating competing implementations.

---

# 7. IMPLEMENTATION ORDER

Execute the work in dependency order.

### Phase 1 — Critical reliability

Resolve P0 issues:

- Autosave failure visibility.
- Completion consistency.
- Required profile persistence.
- Required DNA persistence.
- Server-authoritative activation.
- Partial completion recovery.
- Idempotency.
- Activation gate integration.

### Phase 2 — Canonical industry model

- Separate trade from sales model.
- Normalize industry IDs.
- Implement typed multi-industry representation.
- Enforce primary industry validity.
- Handle legacy and unknown values.
- Add safe migrations.
- Align UI, backend, database, and local engine.

### Phase 3 — Operational DNA and capability resolution

- Canonical question definitions.
- Explicit answer semantics.
- Multi-industry conflict handling.
- User override provenance.
- Schema parity.
- Workflow-backed capability status.
- Consistent terminology.

### Phase 4 — Persistence and offline reliability

- Versioned drafts.
- Full draft restoration.
- Revision-aware writes.
- Workspace isolation.
- Offline parity.
- Restart recovery.
- Server reconciliation.

### Phase 5 — UX and localization

- Error visibility.
- Validation.
- Accessibility.
- RTL/LTR.
- Persian/Dari/English parity.
- Responsive layouts.
- Review summary accuracy.

### Phase 6 — Verification and closure

- Run focused tests.
- Run relevant package tests.
- Run type checking and linting where permitted.
- Execute integration tests.
- Execute offline regression tests.
- Inspect final diffs.
- Verify every finding's disposition.

---

# 8. REQUIRED REGRESSION TEST MATRIX

At minimum, cover:

1. New online signup.
2. Signup with automatically provisioned workspace.
3. Signup without an existing workspace.
4. Existing empty workspace.
5. Existing workspace with locked currency.
6. Account with multiple workspaces.
7. Owner onboarding.
8. Delegated user onboarding.
9. Single industry.
10. Multiple industries.
11. Primary industry selection.
12. Primary industry removal.
13. Industry reordering.
14. Custom industry with description.
15. Custom industry without description.
16. Legacy industry IDs.
17. Unknown industry IDs.
18. Duplicate industry IDs.
19. Maximum industry selection.
20. Browser refresh at every step.
21. Browser restart.
22. Failed autosave.
23. Autosave retry.
24. Concurrent draft updates.
25. Two devices editing one draft.
26. Currency update failure.
27. Workspace-profile failure.
28. DNA persistence failure.
29. DNA version conflict.
30. Database migration unavailable.
31. Duplicate completion requests.
32. Concurrent completion requests.
33. Failure after workspace creation.
34. Failure after account-profile update.
35. Failure after workspace-profile update.
36. Failure after DNA persistence.
37. Activation rejection.
38. Direct API access before activation.
39. Offline onboarding.
40. Offline application restart.
41. Offline-to-online reconciliation.
42. Account switching.
43. Workspace switching.
44. Cross-workspace cache isolation.
45. RTL and LTR layouts.
46. Persian, Dari, and English key parity.
47. Keyboard-only navigation.
48. Mobile viewport.
49. Capability visibility after onboarding.
50. Industry changes after onboarding.

Do not claim these tests passed unless they were actually executed.

---

# 9. PRODUCTION-READINESS RULES

A finding is closed only when:

- The root cause is corrected.
- The correction uses the appropriate shared architecture.
- A meaningful regression test exists.
- The test has actually executed successfully.
- Relevant type and lint checks pass.
- No related regression is introduced.
- The final implementation is inspected.

Use these exact statuses:

- `VERIFIED_COMPLETE`
- `IMPLEMENTED_NOT_LIVE_VERIFIED`
- `BLOCKED`
- `NOT_IMPLEMENTED`
- `PENDING_HUMAN_CONFIRMATION`

Never mark an untested change as verified complete.

Never report a production fix based solely on local source inspection.

If live database verification or production access is unavailable, document that limitation without performing unauthorized operations.

---

# 10. REQUIRED DOCUMENTATION

Create or update these project documents in the appropriate existing documentation structure:

1. `ONBOARDING-FORENSIC-AUDIT.md`
   - At least 100 unique findings.
   - Evidence, severity, confidence, and disposition.

2. `ONBOARDING-REMEDIATION-PLAN.md`
   - Root causes.
   - Dependencies.
   - Implementation sequence.
   - Remaining blockers.

3. `ONBOARDING-ARCHITECTURE.md`
   - Canonical data contracts.
   - Lifecycle.
   - Persistence ownership.
   - Activation semantics.
   - Online/offline behavior.

4. `ONBOARDING-REGRESSION-COVERAGE.md`
   - Scenario.
   - Test file.
   - Execution command.
   - Actual result.
   - Status.

Use existing documentation conventions if equivalent documents already exist. Do not create duplicate documentation systems.

---

# 11. FINAL ACCEPTANCE CRITERIA

The mission is complete only when:

- At least 100 distinct audit findings have been recorded.
- All confirmed actionable P0 findings are corrected.
- All confirmed actionable P1 findings are corrected or have a specific documented blocker.
- Industry selection has one canonical typed representation.
- Sales models and industry classifications are separated.
- Multi-industry selection works end-to-end.
- Primary industry selection is deterministic and valid.
- Draft persistence survives refresh and restart.
- Failed persistence is visible and recoverable.
- Completion cannot silently succeed after failed required writes.
- Activation is server-authoritative.
- Duplicate completion requests are safe.
- Operational DNA is validated and deterministic.
- Online/offline contracts are aligned.
- Capability status reflects actual workflow evidence.
- No unknown industry silently defaults to retail.
- All relevant regression tests have been executed.
- No unauthorized changes to dependencies, secrets, production data, or unrelated user work occurred.

---

# 12. FINAL REPORT FORMAT

Deliver the final report in Persian.

Include:

1. Executive summary.
2. Initial repository state.
3. Total unique findings.
4. Findings by severity.
5. Findings by confidence.
6. Confirmed defects fixed.
7. Architectural changes.
8. Industry-selection improvements.
9. Operational DNA improvements.
10. Persistence and activation improvements.
11. Offline/online parity.
12. Tests executed and actual results.
13. Type-check and lint results.
14. Files changed.
15. Database migrations created, if any.
16. Unresolved blockers.
17. Production verification limitations.
18. Remaining risk.
19. Final readiness assessment.

Include exact commands and actual outputs or concise evidence references.

Do not fabricate metrics, test results, production observations, or completion percentages.

---

# FINAL EXECUTION COMMAND

Start immediately.

First inspect the repository and preserve its existing state.

Then perform the complete forensic audit, record at least 100 distinct findings, prioritize root causes, implement the fixes in dependency order, add regression tests, execute all permitted verification, and update the documentation.

Continue autonomously until every actionable issue is resolved or a real external blocker is demonstrated with evidence.

Do not stop after the audit report.

Do not stop after fixing the first critical issue.

Do not replace implementation with recommendations.

Do not ask me to manually identify the remaining defects.

Your responsibility is to make Hisabche onboarding reliable across every supported industry, every workspace, and both online and offline operation.

**The deliverable is a corrected, tested, documented onboarding system — not another unfinished audit.**
