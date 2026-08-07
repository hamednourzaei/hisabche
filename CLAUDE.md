# CLAUDE.md

# HISABCHE ENGINEERING MANIFEST

Version: 3.0

This document defines how Claude Code must work in this repository.

---

# PROJECT DOCUMENTATION (Source of Truth)

Full engineering docs live in `documents/`:

- `PRODUCT.md` — vision, personas, modules, implemented features
- `SYSTEM_DESIGN.md` — architecture, data flow, offline-first, security
- `DATABASE_SCHEMA.md` — Postgres tables, relations, migrations
- `API_REFERENCE.md` — every backend route, payloads, validation rules
- `AUTH_AND_PERMISSION.md` — roles, capabilities, per-platform auth stacks
- `OFFLINE_SYNC.md` — local stores, queues, conflicts, retries
- `USER_FLOWS.md` — Mermaid flows (auth, invoices, inventory, sync)
- `PLATFORM_MATRIX.md` — web/desktop/mobile comparison
- `RELEASE_PROCESS.md` — build/package/deploy pipelines
- `TESTING_STRATEGY.md` — test layers, IPC tests, CI gates
- `CODING_STANDARDS.md` — TS strict, Zod, money, i18n/RTL rules
- `CLAUDE.md` — rules for future Claude Code sessions (this file's sibling)

Consult the relevant doc before changing code; keep docs in sync when a
documents-relevant behavior changes.

---

# DOCUMENTATION RULE (mandatory)

Before modifying **architecture, schema, data flow, or sync behavior**,
read the matching docs AND respect them:

- `/documents/DOMAIN_MODEL.md` — entities, relations, invariants
- `/documents/PRODUCT.md`
- `/documents/SYSTEM_DESIGN.md`
- `/documents/DATABASE_SCHEMA.md`
- `/documents/AUTH_AND_PERMISSION.md`
- `/documents/OFFLINE_SYNC.md`
- `/documents/API_REFERENCE.md` — **docs-first**: new API = update this
  contract BEFORE writing the route
- `/documents/AI_RULES.md` — hard rules (no schema change without
  migration, no removing offline support, no `any`, Zod always, i18n always)
- `/documents/DATABASE_MIGRATION_POLICY.md` — schema change = migration +
  rollback; never drop columns immediately
- `/documents/ERROR_HANDLING.md` — IPC `IPC_ERROR_CODES`,
  backend error classes, HTTP envelope

Any code change must respect these documents. Deviation requires explicit
user approval.

---

# CI / PRE-COMMIT

- CI (`pnpm`-only, no `npm`): `.github/workflows/ci.yml`,
  `desktop-build.yml`, `mobile-check.yml`. Backend = separate workspace; CI
  installs it with `cd backend && pnpm install`.
- Pre-commit gate: husky + lint-staged (`.husky/pre-commit` →
  `.lintstagedrc.json`): eslint+prettier on staged files only.
- Root `pnpm lint` is currently a **no-op** (every app's `lint` is `echo ok`;
  backend also `echo ok`) — real lint is the eslint configured at root, so the
  CI "lint" step is a stub until `lint` scripts are implemented.

---

These rules OVERRIDE Claude's default behavior.

Failure to follow these rules is considered incorrect behavior.

---

# PRIMARY MISSION

Your job is NOT to understand the whole repository.

Your job is to deliver working software.

Repository knowledge is valuable.

Working software is more valuable.

Shipping is the priority.

---

# PRODUCT PHILOSOPHY

This repository is large.

Do NOT behave like a researcher.

Behave like a Staff Software Engineer.

Staff engineers don't read 300 files before changing a button.

They identify the implementation point.

Then they implement.

---

# GOLDEN RULE

Read Less.

Implement More.

---

# IMPLEMENTATION FIRST

Always follow this sequence.

Understand request

↓

Locate implementation

↓

Read minimum required files

↓

Implement

↓

Verify

↓

Stop

Never continue exploring after implementation starts unless blocked.

---

# SEARCH BUDGET

Maximum search operations

5

Maximum opened files

10

Maximum recursive dependency depth

2

Maximum unrelated folders

0

Maximum investigation time

5 minutes

If any limit is reached

STOP SEARCHING

START IMPLEMENTING

---

# CONTEXT BUDGET

Repository exploration

Maximum 20%

Implementation

Minimum 80%

Thinking

Maximum 10%

Coding

Minimum 70%

---

# IMPLEMENTATION CONFIDENCE

If implementation confidence

> =70%

Do NOT continue searching.

Start editing immediately.

---

# LOCAL THINKING

Always think locally.

Never think globally.

Do not redesign architecture unless requested.

Do not redesign neighboring modules.

Do not improve unrelated code.

---

# SEARCH RULES

Every search must answer ONE question.

If you cannot explain WHY you are searching

Do not search.

Never perform

"just to be safe"

searches.

---

# REPOSITORY SEARCH RULES

Forbidden

Repository-wide searches

Package-wide searches

Searching every usage

Searching every import

Searching sibling modules

Searching future work

Searching every hook

Searching every service

Searching every component

Searching entire folders

Allowed

Targeted search

Specific symbol

Specific file

Specific import

Specific route

Specific type

Specific hook

---

# FILE READING

Allowed order

Page

↓

Component

↓

Hook

↓

Service

↓

Type

↓

Done

Never continue reading after the implementation path is clear.

---

# DEPENDENCY RULE

Maximum recursive dependency depth

2

Never inspect dependency trees recursively.

---

# PAGE MODIFICATION

If modifying a page

Only inspect

The page

Direct child components

Direct hooks

Direct services

Direct types

Nothing else.

---

# FEATURE IMPLEMENTATION

Implement current feature completely.

Ignore neighboring features.

Ignore unrelated cleanup.

Ignore future improvements.

---

# BUG FIXS

Find bug

↓

Locate root cause

↓

Fix

↓

Verify

↓

Stop

Never continue searching after verification.

---

# REFACTORING

Never refactor because

"It could be cleaner."

Refactor only when

Required for correctness

Required for requested task

Required for compilation

Required for runtime stability

---

# ARCHITECTURE

Never redesign architecture

Unless explicitly requested.

Never split files

Unless necessary.

Never move folders

Unless necessary.

Never rename public APIs

Unless necessary.

---

# FILE MODIFICATION LIMIT

Maximum modified files

3

If more than three files are required

Stop

Explain why

Wait for approval.

---

# UI DEVELOPMENT

Prefer existing components.

Priority

1.

shadcn/ui

2.

Material UI

Never build custom primitives

Unless impossible.

Business logic is more valuable than UI abstractions.

---

# COMPONENT RULES

Prefer composition.

Avoid inheritance.

Avoid wrappers.

Avoid unnecessary abstractions.

Avoid deep component trees.

Avoid prop drilling.

Avoid component factories.

---

# TYPESCRIPT

Strict mode

No any

No unknown casts

No ts-ignore

No duplicated types

Prefer inferred types

---

# REACT

Prefer Server Components

Prefer composition

Avoid unnecessary state

Avoid unnecessary effects

Avoid memoization unless measured

Avoid Context unless necessary

---

# PERFORMANCE

Never optimize prematurely.

Measure first.

Optimize later.

---

# TOKEN USAGE

Repository context is expensive.

Every opened file costs tokens.

Every search costs tokens.

Every unnecessary explanation costs tokens.

Minimize all of them.

---

# RESPONSE STYLE

Never narrate every search.

Never explain every thought.

Never list every inspected file.

Report only

Task

Files changed

Result

Next step

Keep updates under five lines.

---

# NO OVER ENGINEERING

Never introduce

Factories

Registries

Dependency injection

Plugin systems

Generic abstractions

Builder patterns

Event buses

unless already required.

Prefer simple code.

---

# NO PREMATURE GENERALIZATION

Do not solve future problems.

Solve today's problem.

---

# NO CLEANUP MODE

Never clean unrelated code.

Never reformat unrelated files.

Never rename unrelated symbols.

Never move unrelated code.

---

# STOP CONDITIONS

Immediately stop searching if

Root cause identified

Implementation path clear

Confidence >=70%

Editable file located

Compilation passes

Task complete

Do not continue investigating.

---

# DEFAULT ASSUMPTION

The first editable implementation found

is the implementation target.

Do not continue looking for a "better" location.

---

# CODE QUALITY

Readable

Predictable

Maintainable

Minimal

Production-ready

No clever tricks.

---

# PRODUCTION FIRST

Always optimize for

Stability

Maintainability

Developer velocity

Low cognitive load

Simple debugging

---

# HISABCHE MODE

Repository is a production monorepo.

Minimize context.

Minimize searches.

Minimize token usage.

Minimize changed files.

Prefer local edits.

Avoid cross-package changes.

Never inspect the whole package.

Never inspect the whole repository.

Never inspect every consumer.

Implement locally whenever possible.

---

# TASK EXECUTION

If multiple tasks are requested

Do NOT investigate all tasks.

Complete Task 1

Verify

Continue Task 2

Verify

Continue Task 3

Never batch repository exploration.

Batch implementation instead.

---

# SAFETY SEARCHES

Forbidden.

Never perform searches

"just in case"

or

"to make sure"

Every search must answer one concrete question.

---

# SHIP MODE

Perfect understanding is NOT required.

Working software IS required.

When in doubt

Ship.
