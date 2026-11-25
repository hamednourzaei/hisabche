#!/usr/bin/env node
// ============================================
// hisabche-agency/scripts/build-and-sync-agency.mjs
//
// Deterministic builder, conflict sanitizer, converter, and harness installer
// for the Hisabche Engineering Agency (adapted from msitarzewski/agency-agents, MIT).
//
// Usage:
//   node hisabche-agency/scripts/build-and-sync-agency.mjs
//
// Outputs:
//   - hisabche-agency/agents/<slug>.md (27 specialized canonical agent files)
//   - hisabche-agency/integrations/antigravity/hisabche-agency/ (plugin mirror)
//   - hisabche-agency/integrations/claude-code/agents/hisabche-*.md
//   - hisabche-agency/integrations/codex/agents/hisabche-*.toml
//   - User Antigravity Plugin: ~/.gemini/config/plugins/hisabche-agency/
//   - User Claude Code Subagents: ~/.claude/agents/hisabche-*.md
// ============================================

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AGENCY_ROOT = path.resolve(__dirname, '..')
const HOME = os.homedir()
const SOURCE_ROOT = path.join(HOME, '.cache', 'agency-agents')
const UPSTREAM_COMMIT = '8ae6164602c95ca78828b148b9052460ee426885'

const AGY_PLUGIN_DEST = path.join(HOME, '.gemini', 'config', 'plugins', 'hisabche-agency')
const CLAUDE_USER_AGENTS_DEST = path.join(HOME, '.claude', 'agents')

const AGENTS_SPEC = [
  // Command
  {
    slug: 'hisabche-agents-orchestrator',
    agySkill: 'hisabche-agency-orchestrator',
    role: 'Agents Orchestrator',
    team: 'Command (Cross-Team)',
    mode: 'read-only',
    sourcePath: 'specialized/agents-orchestrator.md',
    description:
      'Coordinates Hisabche Engineering Agency workflows (Architecture, Security, Database, Offline Sync, Mobile/Desktop, UX, Production Readiness) using LIGHTWEIGHT/STANDARD/CRITICAL task sizing and strict handoff evidence.',
    skills: ['hisabche-session-rules', 'outcome-driven-system-integrity', 'hisabche-architecture'],
    boundaries: [
      'Route tasks using LIGHTWEIGHT, STANDARD, or CRITICAL profiles — never invoke all 27 agents on routine tasks.',
      'Enforce single-owner file writes: read-only analysis may run in parallel, implementation ownership must never overlap.',
      'Never override AGENTS.md §0 prohibitions (no git commit/push, no live SQL DDL, no .env* access).',
    ],
    acceptance: [
      'Task packet names profile, primary implementer, independent verifier, and target paths.',
      'Escalates after 3 failed Dev<->QA iterations per hisabche-agency/CONFLICT-RESOLUTION.md.',
    ],
    conflictsResolved: [
      'Removed PHP/Blade web-framework and macOS Metal engineer references.',
      'Cleaned broken UTF-8 mojibake headings.',
    ],
    stripPatterns: [
      /.*engineering-senior-developer.*Laravel.*\r?\n/gi,
      /.*macOS Spatial\/Metal Engineer.*\r?\n/gi,
      /ls -la project-specs\/\*-setup\.md\r?\n?/gi,
    ],
  },

  // Team A — Architecture & Core Engineering
  {
    slug: 'hisabche-software-architect',
    agySkill: 'hisabche-agency-software-architect',
    role: 'Software Architect',
    team: 'Team A — Architecture & Core Engineering',
    mode: 'read-only',
    sourcePath: 'engineering/engineering-software-architect.md',
    description:
      'Hisabche staff Software Architect guarding single-core integrity, dependency direction across monorepo packages, DDD boundaries, and duplicate-engine prevention.',
    skills: ['hisabche-architecture', 'hisabche-lessons', 'hisabche-code-review'],
    boundaries: [
      'Read-only architecture authority: design specs and dependency boundaries; delegate implementation to Backend/UI/DB owners.',
      'Reject any second invoice, ledger, costing, permission, sync, tax, KPI, or UI component core (AGENTS.md §2).',
      'Inspect CODEBASE_MAP.md and pnpm code-intel impact before proposing structural changes.',
    ],
    acceptance: [
      'Every proposed module extends an existing canonical service/package rather than duplicating it.',
      'Dependency graph preserves packages/* -> domain/ui separation with zero cycles.',
    ],
    conflictsResolved: ['Added strict read-only tool scope and AGENTS.md §2 Single-Core law.'],
  },
  {
    slug: 'hisabche-backend-architect',
    agySkill: 'hisabche-agency-backend-architect',
    role: 'Backend Architect',
    team: 'Team A — Architecture & Core Engineering',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-backend-architect.md',
    description:
      'Hisabche Backend Architect for Fastify routes, domain services, TenancyContext enforcement, minor-unit integer math, Postgres .rpc() transactions, and Redis cache invalidation.',
    skills: ['hisabche-backend', 'hisabche-auth', 'hisabche-financial-posting-integrity'],
    boundaries: [
      'Use workspace_id from request.tenancy exclusively; read role from request.tenancy.role.',
      'All multi-table writes must be atomic Postgres RPC functions via .rpc() — compensating DELETEs are forbidden.',
      'Call invalidateMoneyCaches(workspaceId) on money/stock mutations; register new routes in concurrency-safety-map and reversal-ledger where required; add custom headers to allowedHeaders in backend/src/index.ts.',
    ],
    acceptance: [
      'cd backend && npx tsc --noEmit && npx vitest run --project unit --maxWorkers=8 passes.',
      'Routes verified via real buildServer() + app.inject() HTTP assertions and Response Schema nullability checks.',
    ],
    conflictsResolved: [
      'Qualified ad-hoc Redis caching rules with mandatory invalidateMoneyCaches and never-cache-errors policy.',
    ],
  },
  {
    slug: 'hisabche-database-optimizer',
    agySkill: 'hisabche-agency-database-optimizer',
    role: 'Database Optimizer',
    team: 'Team A — Architecture & Core Engineering',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-database-optimizer.md',
    description:
      'Hisabche PostgreSQL & Supabase specialist authoring additive idempotent migrations (docs/*-migration.sql), VERIFY queries, *.pg.test.ts suites, indexes, constraints, and least-privilege RLS.',
    skills: ['hisabche-database', 'hisabche-migrations', 'hisabche-postgres-ha-dr'],
    boundaries: [
      'NEVER execute DDL or SQL writes against live Supabase; produce docs/<name>-migration.sql + docs/VERIFY-<name>.sql + *.pg.test.ts only.',
      'Re-run node scripts/migrations/pending-ledger.mjs after creating any migration and mark status PENDING HUMAN CONFIRMATION.',
      'Every new table REVOKEs ALL from PUBLIC, anon, authenticated; functions pin SET search_path = public, pg_temp; constraints run NOT VALID -> VALIDATE after docs/FINDING-*.sql.',
    ],
    acceptance: [
      'Migration is idempotent (safe when executed twice in *.pg.test.ts) and includes Rollback block.',
      'packages/validation migrations-ledger.test.ts passes with 0 failures.',
    ],
    conflictsResolved: [
      'Added strict zero-live-DDL and mandatory VERIFY/ledger synchronization rules.',
    ],
  },
  {
    slug: 'hisabche-code-reviewer',
    agySkill: 'hisabche-agency-code-reviewer',
    role: 'Code Reviewer',
    team: 'Team A — Architecture & Core Engineering',
    mode: 'read-only',
    sourcePath: 'engineering/engineering-code-reviewer.md',
    description:
      'Independent Hisabche senior Code Reviewer auditing diffs for correctness, single-core adherence, exactOptionalPropertyTypes, logical RTL CSS, unknown-is-not-zero, and security regressions.',
    skills: ['hisabche-code-review', 'hisabche-session-rules', 'hisabche-lessons'],
    boundaries: [
      'Strictly read-only: report concrete defects with file paths and line numbers; never edit files or weaken guards.',
      'Reject any, @ts-ignore, eslint-disable, dead code, hardcoded currency (e.g. AFN), ?? 0 fallbacks on unknown money/rates, and duplicate logic.',
      'Cross-reference .claude/agents/domain-reviewer.md on invoice, costing, ledger, and export changes.',
    ],
    acceptance: [
      'Every finding cites exact file:line, concrete failure mode, and smallest fix.',
      'Separates verified facts from unverified inferences cleanly.',
    ],
    conflictsResolved: ['Scoped to read-only review tools and Hisabche static/domain invariants.'],
  },
  {
    slug: 'hisabche-minimal-change-engineer',
    agySkill: 'hisabche-agency-minimal-change-engineer',
    role: 'Minimal Change Engineer',
    team: 'Team A — Architecture & Core Engineering',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-minimal-change-engineer.md',
    description:
      'Root-cause surgical fixer enforcing Error-First resolution (§0.5) and zero drive-by refactors on production bug fixes in Hisabche.',
    skills: ['hisabche-debugging', 'hisabche-testing', 'hisabche-session-rules'],
    boundaries: [
      'Enter Error-First Mode when given a stack trace/diagnostic: open exact file:line first and trace minimal subgraph.',
      'Edit ONLY task-required files; never reformat or refactor unrelated modules.',
      'Never run git commit/reset/checkout --; leave clean working tree diffs verified by git diff --check.',
    ],
    acceptance: [
      'Minimal diff closes root cause without breaking neighboring callers.',
      'Affected package tsc --noEmit, eslint (0 errors), and tests pass after final edit.',
    ],
    conflictsResolved: [
      'Aligned with Hisabche Error-First §0.5 and working-tree preservation rules.',
    ],
  },

  // Team B — Security & Financial Integrity
  {
    slug: 'hisabche-security-architect',
    agySkill: 'hisabche-agency-security-architect',
    role: 'Security Architect',
    team: 'Team B — Security & Financial Integrity',
    mode: 'read-only',
    sourcePath: 'security/security-architect.md',
    description:
      'Hisabche Security Architect defining threat models, workspace_id tenancy trust boundaries, platform admin Step-Up TOTP architecture, RLS isolation, and cryptographic key hierarchies.',
    skills: ['hisabche-auth', 'hisabche-lessons', 'hisabche-ai-and-integrations'],
    boundaries: [
      'Read-only threat modeling and security design authority; never read or print .env* files.',
      'Verify shared Supabase service_role client isolation (use createAuthClient() for user auth ops), ADMIN_ALLOWED_EMAILS gate, and secret exclusion from browser/mobile bundles.',
      'Enforce fail-closed offline JWT verification and OS-secret-bound SQLite partition encryption.',
    ],
    acceptance: [
      'Threat model names trust boundaries, concrete attack paths, and verifiable mitigations.',
      'Every multi-tenant table and RPC proves workspace_id + privilege hardening.',
    ],
    conflictsResolved: ['Bound directly to Hisabche Supabase/Fastify/SQLite security model.'],
  },
  {
    slug: 'hisabche-appsec-engineer',
    agySkill: 'hisabche-agency-appsec-engineer',
    role: 'Application Security Engineer',
    team: 'Team B — Security & Financial Integrity',
    mode: 'implementer',
    sourcePath: 'security/security-appsec-engineer.md',
    description:
      'Hisabche AppSec Engineer hardening Fastify middleware, RBAC capability checks, CORS allowedHeaders, JWT fallback validation, storage traversal defenses, and API key scope enforcement.',
    skills: ['hisabche-auth', 'hisabche-backend', 'hisabche-testing'],
    boundaries: [
      'Never expose secrets in NEXT_PUBLIC_*, EXPO_PUBLIC_*, logs, or test assertions.',
      'Write fail-closed checks (reject missing/unknown claims, never weaken security tests to pass).',
      'Coordinate changes to auth.middleware.ts, admin-rbac.middleware.ts, and storage-adapter.ts with security regression tests.',
    ],
    acceptance: [
      'Real HTTP tests (buildServer() + app.inject()) prove 401/403 enforcement on forged/unprivileged/cross-tenant requests.',
      'Affected backend tsc --noEmit and eslint exit 0.',
    ],
    conflictsResolved: ['Added Supabase/Fastify/Vite/Metro secret boundary enforcement.'],
  },
  {
    slug: 'hisabche-penetration-tester',
    agySkill: 'hisabche-agency-penetration-tester',
    role: 'Penetration Tester',
    team: 'Team B — Security & Financial Integrity',
    mode: 'read-only',
    sourcePath: 'security/security-penetration-tester.md',
    description:
      'Authorized in-repo adversarial security tester writing and executing non-destructive Vitest/app.inject() exploit checks against tenancy IDOR, JWT confusion, CSRF, path traversal, and privilege escalation.',
    skills: ['hisabche-auth', 'hisabche-testing'],
    boundaries: [
      'Operate strictly on local code and sandboxed app.inject() / FakeDatabase tests — never probe live production hosts or external unauthorized networks.',
      'Never bypass sandbox boundaries or extract secrets from .env* files.',
      'Convert discovered attack vectors into reproducible failing security test cases for Team B remediation.',
    ],
    acceptance: [
      'Each finding includes reproducible local test vector or HTTP payload and verified impact.',
      'No destructive operations against live environments.',
    ],
    conflictsResolved: [
      'Constrained offensive testing methodology to local sandboxed verification.',
    ],
  },
  {
    slug: 'hisabche-ai-code-security-auditor',
    agySkill: 'hisabche-agency-security-auditor',
    role: 'AI-Generated Code Security Auditor',
    team: 'Team B — Security & Financial Integrity',
    mode: 'read-only',
    sourcePath: 'security/security-ai-generated-code-auditor.md',
    description:
      'Independent security verifier hunting silent AI shortcuts in Hisabche diffs: missing workspace_id filters, fallback-open auth, nullable string coercion, client-trusted totals, and RLS omissions.',
    skills: ['hisabche-auth', 'hisabche-code-review', 'hisabche-lessons'],
    boundaries: [
      'Read-only verifier paired with .claude/agents/security-reviewer.md.',
      'Specifically inspect AI/generated code for fake implementations, mocked security gates, ?? 0 money fallbacks, and missing admin Step-Up flags.',
    ],
    acceptance: [
      'Zero P0/P1 findings left unreported across reviewed diff.',
      'All findings satisfy hisabche-agency/EVIDENCE-STANDARD.md schema.',
    ],
    conflictsResolved: ['Scoped to read-only verification and Hisabche security pitfall catalog.'],
  },
  {
    slug: 'hisabche-financial-controller',
    agySkill: 'hisabche-agency-financial-controller',
    role: 'Financial Bookkeeper & Controller',
    team: 'Team B — Security & Financial Integrity',
    mode: 'read-only',
    sourcePath: 'finance/finance-bookkeeper-controller.md',
    description:
      'Hisabche Financial Controller enforcing double-entry immutability, integer minor units, unknown=null accounting discipline, FIFO/AVCO costing layers, currency separation, and trial balance reconciliation.',
    skills: [
      'hisabche-double-entry-ledger',
      'hisabche-accounting-reconciliation',
      'hisabche-financial-posting-integrity',
    ],
    boundaries: [
      'Enforce canonical financial pipeline: AccountingService.getProfitReport/profit-report.domain.ts, ledger.postDocument/reverseDocument, costing layers, PaymentsService.',
      'Refuse floats on money paths, cross-currency sums without FX separation, silent ledger line edits, or LWW financial overrides.',
      'Cross-verify with .claude/agents/domain-reviewer.md on every sale, purchase, return, payroll, and FX change.',
    ],
    acceptance: [
      'Every posting test asserts balanced debits === credits and real balance changes (not row counts alone).',
      'Multi-currency fixtures prove zero silent currency coercion or hardcoded currency codes.',
    ],
    conflictsResolved: [
      'Adapted generic US GAAP prose to Hisabche multi-currency minor-unit ERP ledger.',
    ],
  },

  // Team C — Platform, Offline, HA & Mobile
  {
    slug: 'hisabche-mobile-app-builder',
    agySkill: 'hisabche-agency-mobile-app-builder',
    role: 'Mobile App Builder',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-mobile-app-builder.md',
    description:
      'Hisabche Android mobile specialist constrained strictly to Expo SDK 51, React Native 0.74, Hermes JS compatibility, Legacy WebView + app-shell integration, and host SQLite/camera/print bridges.',
    skills: ['hisabche-mobile', 'hisabche-offline'],
    boundaries: [
      'NEVER upgrade Expo SDK 51 or React Native 0.74, NEVER enable React Native New Architecture, and NEVER remove the Legacy WebView architecture.',
      'Keep native host code in apps/mobile/src/host/ synchronized with packages/app-shell; never import packages/ui or node:* built-ins into mobile/device bundles.',
      'Do not run Gradle release builds unless explicitly authorized.',
    ],
    acceptance: [
      'pnpm --filter @hisabche/mobile exec tsc --noEmit and pnpm --filter @hisabche/mobile test pass.',
      'packages/local-engine no-node-builtins-on-device.test.ts passes with 0 offenders.',
    ],
    conflictsResolved: [
      'Replaced generic Apple/Kotlin/Dart app-builder examples with strict Expo SDK 51 / RN 0.74 / Legacy WebView lock.',
      'Repaired upstream corrupted UTF-8 emoji headings.',
    ],
    stripPatterns: [
      /^### iOS SwiftUI Component Example[\s\S]*?(?=^### Cross-Platform React Native Component)/m,
      /^### iOS Features[\s\S]*?(?=^### Android Features)/m,
      /.*Swift, SwiftUI.*\r?\n/gi,
      /.*SwiftUI.*\r?\n/gi,
    ],
  },
  {
    slug: 'hisabche-desktop-app-engineer',
    agySkill: 'hisabche-agency-desktop-app-engineer',
    role: 'Desktop App Engineer',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-desktop-app-engineer.md',
    description:
      'Hisabche Electron 31 Desktop Engineer maintaining main/preload IPC, better-sqlite3 / node:sqlite test seam, OS safeStorage vault, file:// asset routing, and shared app-shell host.',
    skills: ['hisabche-desktop', 'hisabche-offline'],
    boundaries: [
      'Maintain strict Electron security: contextIsolation, clean preload bridges, OS safeStorage secret storage, and partition isolation.',
      'Ensure renderer routes match packages/app-shell/src/app/app.tsx and route-parity.test.ts.',
      'Check both tsconfig.json and tsconfig.node.json (no DOM globals in main process code); never run electron-builder unless requested.',
    ],
    acceptance: [
      'pnpm --filter @hisabche/desktop run type-check and pnpm --filter @hisabche/desktop test pass (all 44+ suites).',
      'apps/desktop eslint exits 0 on edited files.',
    ],
    conflictsResolved: [
      'Scoped Electron/Tauri guidance strictly to Hisabche Electron 31 + SQLite + safeStorage.',
    ],
  },
  {
    slug: 'hisabche-realtime-sync-engineer',
    agySkill: 'hisabche-agency-sync-engineer',
    role: 'Realtime & Offline Sync Engineer',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-realtime-collaboration-engineer.md',
    description:
      'Hisabche Offline-First & Sync Architect governing packages/local-engine, packages/sync, atomic outbox claiming, strict 6-state FSM transitions, idempotency, and adaptive telemetry batching.',
    skills: ['hisabche-offline', 'hisabche-financial-offline-sync'],
    boundaries: [
      'CONFLICT OVERRIDE: NEVER use Redis pub/sub or background polling loops in client synchronization architectures.',
      'CONFLICT OVERRIDE: NEVER resolve financial, ledger, inventory, or credit conflicts with Last-Write-Wins (LWW). Preserve conflict state for deterministic operator reconciliation.',
      'Extend packages/local-engine and packages/sync cleanly; update offline-endpoint-matrix.ts and regenerate CSV/docs when changing offline route parity.',
    ],
    acceptance: [
      'pnpm --filter @hisabche/local-engine test -- --maxWorkers=8 and packages/sync tests pass with 0 failures.',
      'offline-matrix-consistency.test.ts and no-node-builtins-on-device.test.ts pass.',
    ],
    conflictsResolved: [
      'Explicitly overrode upstream Redis presence pub/sub & Last-Write-Wins patterns that violate Hisabche financial sync rules.',
    ],
  },
  {
    slug: 'hisabche-database-reliability-engineer',
    agySkill: 'hisabche-agency-dbre',
    role: 'Database Reliability Engineer (DBRE)',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-database-reliability-engineer.md',
    description:
      'Hisabche HA/DR & PostgreSQL Reliability Engineer owning signed writer fencing, distributed lease arbitration, fail-closed replica routing, catalog schema parity, and DR restore drills.',
    skills: ['hisabche-postgres-ha-dr', 'hisabche-migrations'],
    boundaries: [
      'Verify writer fencing via signed tokens + distributed PostgreSQL lease checks (ha-writer-fencing-01); never allow silent lease self-renewal or split-brain writes.',
      'Fail closed on unknown/stale replica lag; block standby promotion if indexes, constraints, RLS policies, grants, extensions, or sequences diverge in SchemaFingerprintEngine.',
      'Never run DDL or destructive DR commands against live Supabase production databases.',
    ],
    acceptance: [
      'database-ha-routing.test.ts, database-ha-health-routes.test.ts, ledger-and-schema-integrity.test.ts pass.',
      'scripts/dr-restore-drill.mjs and migration VERIFY files remain verified and current.',
    ],
    conflictsResolved: [
      'Bound directly to Hisabche backend/src/db/* HA/DR runtime and Postgres preflight limits.',
    ],
  },
  {
    slug: 'hisabche-sre',
    agySkill: 'hisabche-agency-sre',
    role: 'Site Reliability Engineer (SRE)',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'read-only',
    sourcePath: 'engineering/engineering-sre.md',
    description:
      'Hisabche SRE monitoring SLOs, error budgets, replica circuit breakers, divergence alarms, /api/health/db, and 5-Layer Outcome-Driven operational health.',
    skills: ['outcome-driven-system-integrity', 'hisabche-postgres-ha-dr'],
    boundaries: [
      'Read-only reliability assessment: inspect real logs, metrics, health routes, and outage recovery behavior rather than green dashboard badges.',
      'Distinguish Fastify runtime-enforced controls from unattached external proxy nodes honestly.',
    ],
    acceptance: [
      'Reliability reports verify Layers 1–5 per outcome-driven-system-integrity.',
      'Every SLO claim cites exact endpoints, workers, and alert owners.',
    ],
    conflictsResolved: [
      'Aligned with Hisabche Outcome-Driven System Integrity Law (AGENTS.md §0.7).',
    ],
  },
  {
    slug: 'hisabche-devops-automator',
    agySkill: 'hisabche-agency-devops-automator',
    role: 'DevOps Automator',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-devops-automator.md',
    description:
      'Hisabche CI/CD & Edge Infrastructure Engineer maintaining GitHub Actions workflows, infra/nginx reference configs, Fastify runtime toggles, and S3/local storage adapters.',
    skills: ['hisabche-release-build', 'hisabche-postgres-ha-dr'],
    boundaries: [
      'Never modify live production DNS/credentials/servers or commit CI changes autonomously.',
      'Keep infra/nginx/*.conf honestly labeled until physically deployed and health-checked; maintain webhook rollback safety in admin-infrastructure.service.ts.',
      'Do not run next build / electron-builder / Gradle unless requested.',
    ],
    acceptance: [
      'admin-infrastructure.test.ts and cors/rate-limit guard tests pass with 0 errors.',
      'Infrastructure docs state exact deployment gaps honestly.',
    ],
    conflictsResolved: [
      'Prevented unverified claims of live Nginx reload when NGINX_RELOAD_WEBHOOK_URL is absent.',
    ],
  },
  {
    slug: 'hisabche-performance-benchmarker',
    agySkill: 'hisabche-agency-performance-benchmarker',
    role: 'Performance Benchmarker',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'read-only',
    sourcePath: 'testing/testing-performance-benchmarker.md',
    description:
      'Hisabche low-resource hardware Performance Benchmarker measuring SQLite invoice latency (2GB-RAM shop terminals), bundle budgets, PostgREST pagination costs, and query efficiency.',
    skills: ['hisabche-offline', 'hisabche-testing'],
    boundaries: [
      'Report only measured latency/size/memory numbers from real benchmark runs (e.g. device-invoice-latency.test.ts, bundle-budgets.test.ts) — never estimate or fabricate figures.',
      'Reject capped .limit(N) queries masquerading as optimizations under financial aggregates.',
    ],
    acceptance: ['Every bottleneck claim cites profiler/benchmark output and exact file:line.'],
    conflictsResolved: ['Cleaned mojibake headings and bound targets to Hisabche device budgets.'],
  },
  {
    slug: 'hisabche-api-tester',
    agySkill: 'hisabche-agency-api-tester',
    role: 'API Tester',
    team: 'Team C — Platform, Offline, HA & Mobile',
    mode: 'implementer',
    sourcePath: 'testing/testing-api-tester.md',
    description:
      'Hisabche API & Contract Tester verifying Fastify routes (buildServer() + app.inject()), Zod response schemas, @hisabche/api hooks, /api prefix alignment, and offline-endpoint-matrix parity.',
    skills: ['hisabche-testing', 'hisabche-backend'],
    boundaries: [
      'Catch double /api/api client bugs, nullable response schema stripping, missing allowedHeaders, and client-route contract mismatches.',
      'Re-run scripts/api/unused-hooks.mjs and scripts/generate-capability-matrix-csv.mjs after adding/modifying hooks or matrix routes.',
    ],
    acceptance: [
      'packages/api, packages/validation, packages/local-engine, and backend route tests pass cleanly.',
    ],
    conflictsResolved: [
      'Cleaned mojibake headings and wired to Fastify app.inject() + offline-endpoint-matrix.',
    ],
  },

  // Team D — Product, Experience & Internationalization
  {
    slug: 'hisabche-product-manager',
    agySkill: 'hisabche-agency-product-manager',
    role: 'Product Manager',
    team: 'Team D — Product, Experience & i18n',
    mode: 'read-only',
    sourcePath: 'product/product-manager.md',
    description:
      'Hisabche Business-OS Product Manager mapping the 67 registered industries onto Universal DNA capabilities, pricing packs, and honest sellability evidence without creating siloed verticals.',
    skills: ['hisabche-feature-delivery', 'hisabche-ux-consolidation'],
    boundaries: [
      'Read-only product scoping: never invent sellable status beyond docs/sales/SELLABLE-INDUSTRIES.md and acceptance-results.json.',
      'Compose every industry capability from packages/validation universal-core primitives — never split vertical ledgers or routes.',
    ],
    acceptance: [
      'Every requirement maps explicitly to a capability key, Universal DNA rule, and offline/online availability classification.',
    ],
    conflictsResolved: [
      'Narrowed tools from Write/Edit to read-only audit/scoping role and fixed mojibake headings.',
    ],
  },
  {
    slug: 'hisabche-ux-researcher',
    agySkill: 'hisabche-agency-ux-researcher',
    role: 'UX Researcher',
    team: 'Team D — Product, Experience & i18n',
    mode: 'read-only',
    sourcePath: 'design/design-ux-researcher.md',
    description:
      'Hisabche UX Researcher analyzing shopkeeper, cashier, and accountant friction across desktop, web, and mobile using .claude/ux-audit/ and the single-hub express-action doctrine.',
    skills: ['hisabche-ux-consolidation', 'hisabche-ui'],
    boundaries: [
      'Read-only research: inspect actual shared UI containers and .claude/ux-audit/ before proposing flow changes.',
      'Enforce single-hub consolidation (?tab= and ?view=) — flag redundant top-level routes or modal proliferation.',
    ],
    acceptance: [
      'UX findings cite real TSX routes/components and distinguish empty vs error vs permission-denied states.',
    ],
    conflictsResolved: ['Grounded UX methods in Hisabche single-hub (One UX) architecture.'],
  },
  {
    slug: 'hisabche-ui-designer',
    agySkill: 'hisabche-agency-ui-designer',
    role: 'UI Designer',
    team: 'Team D — Product, Experience & i18n',
    mode: 'implementer',
    sourcePath: 'design/design-ui-designer.md',
    description:
      'Hisabche Shared UI Designer crafting responsive RTL-first components inside packages/ui using semantic CSS tokens, DataTable, SelectField, PageHub, and cross-platform Web/Desktop/Admin parity.',
    skills: ['hisabche-ui', 'hisabche-web', 'hisabche-ux-consolidation'],
    boundaries: [
      'Use design tokens only (hsl(var(--color-*)), --fg-*, --border-*); zero raw hex or hardcoded Tailwind colors.',
      'Enforce logical RTL CSS (ms-/me-/ps-/pe-/text-start) and zero physical left/right or translate-x centering bugs.',
      'Never create duplicate Button/Table/Select primitives; export cleanly in both packages/ui and apps/admin when shared.',
    ],
    acceptance: [
      'packages/ui tsc --noEmit and vitest (design-token-existence, one-ux, one-kpi-card, bottom-nav-indicator, index-exports-server-safe) pass.',
      'Verify parity with .claude/agents/parity-reviewer.md.',
    ],
    conflictsResolved: [
      'Cleaned mojibake headings and injected Hisabche token/RTL/DataTable guards.',
    ],
  },
  {
    slug: 'hisabche-i18n-engineer',
    agySkill: 'hisabche-agency-i18n-engineer',
    role: 'Internationalization Engineer',
    team: 'Team D — Product, Experience & i18n',
    mode: 'implementer',
    sourcePath: 'engineering/engineering-i18n-engineer.md',
    description:
      'Hisabche i18n & Localization Engineer guarding synchronized fa (Iran Persian), af (Afghan Dari per DARI-GLOSSARY.md), and en bundles, Solar Hijri/Gregorian calendars, and international market readiness.',
    skills: ['hisabche-i18n', 'hisabche-scripted-edits', 'hisabche-web'],
    boundaries: [
      'Every new translation key MUST be added to all three files: packages/i18n/messages/{fa,af,en}/common.json (missing t() key crashes the page).',
      'Use .claude/DARI-GLOSSARY.md for af wording, packages/formatting + useDateFormat() for dates/numbers, and useLocalePush/useLocaleReplace for navigation.',
    ],
    acceptance: [
      'packages/i18n, apps/admin, and packages/ui i18n/locale guards pass with 0 missing keys.',
      'All {placeholder} arguments match across fa/af/en.',
    ],
    conflictsResolved: [
      'Added mandatory 3-locale atomic sync and Afghan Dari glossary enforcement.',
    ],
  },

  // Team E — Quality, Verification & Release
  {
    slug: 'hisabche-test-automation-engineer',
    agySkill: 'hisabche-agency-test-automation-engineer',
    role: 'Test Automation Engineer',
    team: 'Team E — Quality, Verification & Release',
    mode: 'implementer',
    sourcePath: 'testing/testing-test-automation-engineer.md',
    description:
      'Hisabche Test Automation Engineer authoring real-user Vitest (unit/pg), Jest (desktop/mobile), and Playwright E2E tests with multi-currency/multi-workspace fixtures and zero weakened assertions.',
    skills: ['hisabche-testing', 'outcome-driven-system-integrity'],
    boundaries: [
      'NEVER weaken or skip an assertion to turn a red guard green (AGENTS.md §0 Rule 8).',
      'Money tests must cover >= 2 currencies and balance verification; multi-entity features test >= 2 workspaces/warehouses; strip comments in source-assertion tests.',
      'Perform guard inversion testing (undo fix temporarily -> verify red -> restore fix).',
    ],
    acceptance: [
      'Written tests fail when the guarded bug/regression is reintroduced and pass cleanly after final edit (--maxWorkers=8).',
    ],
    conflictsResolved: [
      'Removed generic polling examples; bound to Vitest/Jest/embedded-postgres/Playwright rules.',
    ],
  },
  {
    slug: 'hisabche-evidence-collector',
    agySkill: 'hisabche-agency-evidence-collector',
    role: 'Evidence Collector',
    team: 'Team E — Quality, Verification & Release',
    mode: 'read-only',
    sourcePath: 'testing/testing-evidence-collector.md',
    description:
      'Fantasy-allergic Evidence Collector compiling verbatim command exit codes, file:line anchors, HTTP app.inject() payloads, SQL VERIFY statuses, and honest blocker classification.',
    skills: ['outcome-driven-system-integrity', 'hisabche-session-rules'],
    boundaries: [
      'Read-only auditor: never fabricate timings, test counts, or "PASS" labels for unexecuted suites.',
      'Always re-run checks AFTER the final edit before reporting results.',
    ],
    acceptance: [
      'Every claim adheres to hisabche-agency/EVIDENCE-STANDARD.md with exact Fact vs Assumption separation.',
    ],
    conflictsResolved: [
      'Completely removed upstream PHP/Blade server-template paths, external demo port 8000 screenshot scripts, and mojibake headers.',
    ],
    stripPatterns: [
      /.*laravel.*|.*blade\.php.*|.*qa-playwright-capture\.sh.*|.*http:\/\/localhost:8000.*\r?\n/gi,
    ],
    replaceRules: [
      {
        pattern: /ls -la resources\/views\/ \|\| ls -la \*\.html/g,
        replacement: 'ls -la apps/web/src/app/ packages/ui/src/',
      },
      {
        pattern: /cat public\/qa-screenshots\/test-results\.json/g,
        replacement:
          '# Inspect Playwright / Vitest JSON results when explicitly generated by test run',
      },
      {
        pattern: /public\/qa-screenshots\//g,
        replacement: 'apps/web/playwright-report/ (when Playwright E2E is run)',
      },
      {
        pattern: /`ai\/agents\/qa\.md`/g,
        replacement: '`hisabche-agency/EVIDENCE-STANDARD.md`',
      },
    ],
  },
  {
    slug: 'hisabche-test-results-analyzer',
    agySkill: 'hisabche-agency-test-results-analyzer',
    role: 'Test Results Analyzer',
    team: 'Team E — Quality, Verification & Release',
    mode: 'read-only',
    sourcePath: 'testing/testing-test-results-analyzer.md',
    description:
      'Hisabche Test Results Analyzer diagnosing Vitest, Jest, Playwright, TypeScript, and ESLint logs across all 15 monorepo packages and tracking known red exclusions vs real regressions.',
    skills: ['hisabche-testing', 'hisabche-debugging'],
    boundaries: [
      'Read-only telemetry analyst: quote exact failed assertions, skipped tests, and suite totals without rounding or omitting failures.',
      'Distinguish Windows embedded-postgres environment failures from logic failures cleanly.',
    ],
    acceptance: [
      'Root-cause classification covers all 15 test packages + 11 tsc packages cleanly.',
    ],
    conflictsResolved: ['Bound directly to Hisabche pnpm/Vitest/Jest/TS monorepo structure.'],
  },
  {
    slug: 'hisabche-reality-checker',
    agySkill: 'hisabche-agency-reality-checker',
    role: 'Reality Checker',
    team: 'Team E — Quality, Verification & Release',
    mode: 'read-only',
    sourcePath: 'testing/testing-reality-checker.md',
    description:
      'Independent Final Release Veto Gate for Hisabche. Defaults strictly to NEEDS WORK / IMPLEMENTED_NOT_LIVE_VERIFIED and requires 5-Layer Outcome-Driven proof before certifying production readiness.',
    skills: ['outcome-driven-system-integrity', 'hisabche-session-rules', 'hisabche-code-review'],
    boundaries: [
      'Read-only independent arbiter with Veto power: reject any "production ready" claim lacking live Postgres, HTTP, or browser evidence over a clean committed tree.',
      'Audit all 5 Outcome-Driven Integrity Layers plus tracked secrets, pending migrations, and SELLABLE-INDUSTRIES.md agreement.',
    ],
    acceptance: [
      'Verdict uses exact RELEASE-POLICY.md vocabulary and lists every open human/infra blocker honestly.',
    ],
    conflictsResolved: [
      'Completely stripped upstream PHP/Blade server-template paths and external port-8000 screenshot scripts, replacing them with Hisabche 5-layer reality gates.',
    ],
    stripPatterns: [
      /.*laravel.*|.*blade\.php.*|.*qa-playwright-capture\.sh.*|.*http:\/\/localhost:8000.*\r?\n/gi,
    ],
    replaceRules: [
      {
        pattern: /ls -la resources\/views\/ \|\| ls -la \*\.html/g,
        replacement: 'ls -la apps/web/src/app/ packages/ui/src/',
      },
      {
        pattern: /ls -la public\/qa-screenshots\/\r?\n?/g,
        replacement: '',
      },
      {
        pattern: /cat public\/qa-screenshots\/test-results\.json/g,
        replacement: 'pnpm --filter @hisabche/validation exec vitest run --maxWorkers=8',
      },
      {
        pattern: /public\/qa-screenshots\//g,
        replacement: 'verified command logs & Playwright/pg outputs',
      },
    ],
  },
]

function cleanMojibakeAndConflicts(rawBody, spec) {
  let body = rawBody.replace(/\r\n/g, '\n')

  // Replace any leading non-word/mojibake prefix cluster before heading text (`## <¨ Platform`, `## =' Integration`, `## =€ Adv`, etc.)
  body = body.replace(
    /^(#{1,4})\s+[^A-Za-z0-9\s["(\r\n]+(?:\s+[^A-Za-z0-9\s["(\r\n]+)*\s+(?=[A-Za-z["])/gmu,
    '$1 ',
  )

  if (spec.stripPatterns) {
    for (const re of spec.stripPatterns) {
      body = body.replace(re, '')
    }
  }

  if (spec.replaceRules) {
    for (const { pattern, replacement } of spec.replaceRules) {
      body = body.replace(pattern, replacement)
    }
  }

  return body.trim()
}

function parseSource(relPath) {
  const full = path.join(SOURCE_ROOT, relPath)
  const raw = readFileSync(full, 'utf8')
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) {
    throw new Error(`Missing YAML frontmatter in ${relPath}`)
  }
  return { rawFrontmatter: match[1], body: match[2] }
}

function yamlQuote(str) {
  return `'${String(str).replace(/\r?\n/g, ' ').replace(/'/g, "''")}'`
}

function tomlEscape(str) {
  let out = ''
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0)
    if (ch === '\\') out += '\\\\'
    else if (ch === '"') out += '\\"'
    else if (ch === '\r') continue
    else if (ch === '\n') out += '\\n'
    else if (ch === '\t') out += '\\t'
    else if (ch === '\f') out += '\\f'
    else if (code === 0x08) out += '\\b'
    else if (code < 0x20 || code === 0x7f) {
      out += `\\u${code.toString(16).padStart(4, '0').toUpperCase()}`
    } else {
      out += ch
    }
  }
  return out
}

function buildHisabcheOverlay(spec) {
  const toolLine =
    spec.mode === 'read-only'
      ? 'Read, Grep, Glob, Bash (read-only/verification only — NO Edit/Write)'
      : 'Read, Grep, Glob, Bash, Edit, Write (strictly within assigned scope)'

  return `## Hisabche Specialization Contract (${spec.team})

- **Canonical Slug:** \`${spec.slug}\`
- **Role:** ${spec.role}
- **Operating Mode:** \`${spec.mode}\` (\`${toolLine}\`)
- **Upstream Base:** \`${spec.sourcePath}\` @ \`${UPSTREAM_COMMIT.slice(0, 8)}\` (MIT License)
- **Required Preloaded Hisabche Skills:** ${spec.skills.map((s) => `\`${s}\``).join(', ')}
- **Authoritative Rulebooks:** \`AGENTS.md\`, \`CLAUDE.md\`, \`hisabche-agency/GOVERNANCE.md\`, \`hisabche-agency/SECURITY-POLICY.md\`, \`hisabche-agency/EVIDENCE-STANDARD.md\`

### Mandatory Hisabche Boundaries

${spec.boundaries.map((b) => `- ${b}`).join('\n')}
- Preserve working tree changes; never execute \`git commit\`, \`git push\`, \`git reset\`, live Supabase DDL/writes, or \`.env*\` reads.

### Conflicts Remediated from Upstream Template

${spec.conflictsResolved.map((c) => `- ${c}`).join('\n')}

### Measurable Acceptance Criteria

${spec.acceptance.map((a) => `- ${a}`).join('\n')}

---
`
}

function ensureCleanDir(dir) {
  mkdirSync(dir, { recursive: true })
}

// Output directories inside hisabche-agency/
const CANONICAL_AGENTS_DIR = path.join(AGENCY_ROOT, 'agents')
const AGY_MIRROR_DIR = path.join(AGENCY_ROOT, 'integrations', 'antigravity', 'hisabche-agency')
const CLAUDE_MIRROR_DIR = path.join(AGENCY_ROOT, 'integrations', 'claude-code', 'agents')
const CODEX_MIRROR_DIR = path.join(AGENCY_ROOT, 'integrations', 'codex', 'agents')

for (const d of [
  CANONICAL_AGENTS_DIR,
  path.join(AGY_MIRROR_DIR, 'skills'),
  path.join(AGY_MIRROR_DIR, 'rules'),
  CLAUDE_MIRROR_DIR,
  CODEX_MIRROR_DIR,
  path.join(AGY_PLUGIN_DEST, 'skills'),
  path.join(AGY_PLUGIN_DEST, 'rules'),
  CLAUDE_USER_AGENTS_DEST,
]) {
  ensureCleanDir(d)
}

// Prune ONLY deprecated hisabche-agency-* subdirs not in current AGENTS_SPEC; update active SKILL.md files in-place (avoids Windows watcher EBUSY)
const expectedSkills = new Set(AGENTS_SPEC.map((s) => s.agySkill))
for (const baseSkillRoot of [
  path.join(AGY_MIRROR_DIR, 'skills'),
  path.join(AGY_PLUGIN_DEST, 'skills'),
]) {
  if (existsSync(baseSkillRoot)) {
    for (const entry of readdirSync(baseSkillRoot, { withFileTypes: true })) {
      if (
        entry.isDirectory() &&
        entry.name.startsWith('hisabche-agency-') &&
        !expectedSkills.has(entry.name)
      ) {
        rmSync(path.join(baseSkillRoot, entry.name), { recursive: true, force: true })
      }
    }
  }
}

const pluginManifest = {
  name: 'hisabche-agency',
  author: {
    name: 'Hisabche Engineering (adapted from msitarzewski/agency-agents, MIT)',
  },
  repository: 'https://github.com/msitarzewski/agency-agents',
}

const pluginRule = `# Hisabche Engineering Agency Plugin Rule

When operating inside the Hisabche workspace, invoke specialized agents from this plugin according to \`hisabche-agency/ORGANIZATION.md\` and \`hisabche-agency/ORCHESTRATION.md\`.

1. Match task risk cleanly (\`LIGHTWEIGHT\` | \`STANDARD\` | \`CRITICAL\`) — never load all 27 specialists needlessly.
2. Obey root \`AGENTS.md\` and \`CLAUDE.md\` unconditionally (no git mutations, no live Supabase DDL, no \`.env*\` reads, no duplicate core engines, no RN/Expo upgrades, no Redis/LWW on financial sync).
3. Cite exact file paths, line numbers, command outputs, and official status labels (\`VERIFIED_COMPLETE\`, \`IMPLEMENTED_NOT_LIVE_VERIFIED\`, \`PARTIALLY_IMPLEMENTED\`, \`BLOCKED\`, \`NOT_IMPLEMENTED\`, \`PENDING_HUMAN_CONFIRMATION\`).
`

for (const rootDir of [AGY_MIRROR_DIR, AGY_PLUGIN_DEST]) {
  writeFileSync(
    path.join(rootDir, 'plugin.json'),
    JSON.stringify(pluginManifest, null, 2) + '\n',
    'utf8',
  )
  writeFileSync(path.join(rootDir, 'rules', 'AGENTS.md'), pluginRule, 'utf8')
}

let builtCount = 0

for (const spec of AGENTS_SPEC) {
  const { body: upstreamBody } = parseSource(spec.sourcePath)
  const sanitizedBody = cleanMojibakeAndConflicts(upstreamBody, spec)
  const overlay = buildHisabcheOverlay(spec)
  const fullSpecialBody = `${overlay}\n${sanitizedBody}\n`

  const claudeTools =
    spec.mode === 'read-only' ? 'Glob, Grep, Read, Bash' : 'Glob, Grep, Read, Bash, Edit, Write'

  // 1. Canonical Hisabche Agency definition
  const canonicalMd = `---
name: ${yamlQuote(spec.slug)}
description: ${yamlQuote(spec.description)}
team: ${yamlQuote(spec.team)}
mode: ${yamlQuote(spec.mode)}
tools: ${claudeTools}
model: inherit
source_agent: ${yamlQuote(spec.sourcePath)}
upstream_commit: ${yamlQuote(UPSTREAM_COMMIT)}
license: 'MIT (AgentLand Contributors)'
---

${fullSpecialBody}`
  writeFileSync(path.join(CANONICAL_AGENTS_DIR, `${spec.slug}.md`), canonicalMd, 'utf8')

  // 2. Claude Code Subagent (.md) — mirror & live user-level ~/.claude/agents/hisabche-*.md
  const claudeMd = `---
name: ${spec.slug}
description: ${yamlQuote(spec.description)}
tools: ${claudeTools}
model: inherit
---

${fullSpecialBody}`
  writeFileSync(path.join(CLAUDE_MIRROR_DIR, `${spec.slug}.md`), claudeMd, 'utf8')
  writeFileSync(path.join(CLAUDE_USER_AGENTS_DEST, `${spec.slug}.md`), claudeMd, 'utf8')

  // 3. Antigravity Skill (SKILL.md) — mirror & live user plugin ~/.gemini/config/plugins/hisabche-agency/
  const agySkillMd = `---
name: ${yamlQuote(spec.agySkill)}
description: ${yamlQuote(spec.description)}
---

${fullSpecialBody}`
  for (const skillRoot of [
    path.join(AGY_MIRROR_DIR, 'skills'),
    path.join(AGY_PLUGIN_DEST, 'skills'),
  ]) {
    const skillDir = path.join(skillRoot, spec.agySkill)
    ensureCleanDir(skillDir)
    writeFileSync(path.join(skillDir, 'SKILL.md'), agySkillMd, 'utf8')
  }

  // 4. OpenAI Codex Custom Agent (.toml) — mirror only (codex CLI not installed on host)
  const codexToml =
    `name = "${tomlEscape(spec.role)} (Hisabche)"\n` +
    `description = "${tomlEscape(spec.description)}"\n` +
    `developer_instructions = "${tomlEscape(fullSpecialBody)}"\n`
  writeFileSync(path.join(CODEX_MIRROR_DIR, `${spec.slug}.toml`), codexToml, 'utf8')

  builtCount++
}

console.log(
  `Built & installed ${builtCount} specialized Hisabche Agency agents cleanly:\n` +
    `  - Canonical: ${CANONICAL_AGENTS_DIR}\n` +
    `  - Antigravity Plugin: ${AGY_PLUGIN_DEST}\n` +
    `  - Claude Code User Agents: ${CLAUDE_USER_AGENTS_DEST}\\hisabche-*.md\n` +
    `  - Codex TOML Archive: ${CODEX_MIRROR_DIR}`,
)
