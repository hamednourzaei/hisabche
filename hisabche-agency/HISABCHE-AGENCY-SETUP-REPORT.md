# Hisabche Engineering Agency — Setup & Operational Handover Report

**Generated:** 2026-11-24
**Upstream Source:** [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents) (local clean shallow clone at `C:\Users\hamed\.cache\agency-agents`, commit `8ae6164602c95ca78828b148b9052460ee426885`, MIT License)
**Target Workspace:** `c:\Users\hamed\Desktop\hisabche`
**Overall Setup Status:** `IMPLEMENTED_NOT_LIVE_VERIFIED` _(all in-repo governance, 27 specialized agents, Antigravity plugin live RPC discovery, Claude Code user agents, root `AGENTS.md`/`CLAUDE.md` integration, `verify-agency.mjs`, and `@hisabche/validation` guard suites verified; OpenAI Codex host installation is `NOT_IMPLEMENTED` / `BLOCKED` due to missing `codex` CLI binary on host, and live interactive multi-agent subagent execution / live DB verification was not run)_

---

## A. Executive Summary

`msitarzewski/agency-agents` (**268** agent markdown files across **18** divisions) was audited, filtered to **27** high-precision engineering, security, platform, product, and quality roles (**1 cross-cutting Orchestrator + 26 specialists across Teams A–E**), stripped of incompatible framework/protocol instructions, bound strictly to Hisabche's canonical law (`AGENTS.md`, `CLAUDE.md`, `outcome-driven-system-integrity`), and installed across available local harnesses without touching any Hisabche application source file (`backend/`, `packages/`, `apps/`, `docs/*.sql`, `package.json`, `pnpm-lock.yaml`).

Key deliverables created and verified:

- **Canonical Agency Hub (`hisabche-agency/`):** 15 governance/protocol/handover documents, 5 team charters (`teams/*/README.md`), 9 operational workflows (`workflows/*/WORKFLOW.md`), 27 canonical specialized agent definitions (`agents/hisabche-*.md`), deterministic builder (`scripts/build-and-sync-agency.mjs`), and verification harness (`scripts/verify-agency.mjs`).
- **Antigravity Plugin (`agy`):** Installed to `C:\Users\hamed\.gemini\config\plugins\hisabche-agency\` (`plugin.json`, `rules/AGENTS.md`, 27 `skills/hisabche-agency-*/SKILL.md`), mirrored in `hisabche-agency/integrations/antigravity/hisabche-agency/`, and confirmed loaded via live Language Server RPC (`GetAllPlugins`).
- **Claude Code (`claude`):** Installed 27 `hisabche-*.md` user subagents under `C:\Users\hamed\.claude\agents\` (preserving all 18 existing `seo-*.md` user agents and all 5 pre-existing workspace `.claude/agents/*.md` files), mirrored in `hisabche-agency/integrations/claude-code/agents/`.
- **OpenAI Codex CLI (`codex`):** Generated and validated 27 single-line TOML definitions under `hisabche-agency/integrations/codex/agents/hisabche-*.toml` ready for installation once `codex` CLI is installed on the host.
- **Repository Entrypoints:** Linked `hisabche-agency/` cleanly inside root `AGENTS.md` (`§11`) and `CLAUDE.md` (`§12`).

---

## B. Agent Inventory (27 Specialized Agents)

Out of 268 upstream definitions across 18 divisions (`academic`: 6, `design`: 10, `engineering`: 66, `finance`: 5, `game-development`: 6, `gis`: 13, `healthcare`: 3, `marketing`: 37, `paid-media`: 7, `product`: 6, `project-management`: 7, `research`: 1, `sales`: 9, `security`: 12, `spatial-computing`: 6, `specialized`: 59, `support`: 6, `testing`: 9), **27** were selected (**12** `engineering`, **4** `security`, **6** `testing`, **1** `product`, **2** `design`, **1** `finance`, **1** `specialized`; **241** excluded).

|  #  | Canonical Slug                           | Team    | Mode          | Upstream Source (`agency-agents`)                            | Antigravity Skill Slug                     | Key Conflict / Policy Hardening                                                                                                                |
| :-: | ---------------------------------------- | ------- | ------------- | ------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
|  1  | `hisabche-agents-orchestrator`           | Command | `read-only`   | `specialized/agents-orchestrator.md`                         | `hisabche-agency-orchestrator`             | Stripped PHP/Blade web-framework, macOS Metal & mojibake headings; added `LIGHTWEIGHT`/`STANDARD`/`CRITICAL` routing                           |
|  2  | `hisabche-software-architect`            | Team A  | `read-only`   | `engineering/engineering-software-architect.md`              | `hisabche-agency-software-architect`       | Scoped read-only; enforced `AGENTS.md §2` single-core rule                                                                                     |
|  3  | `hisabche-backend-architect`             | Team A  | `implementer` | `engineering/engineering-backend-architect.md`               | `hisabche-agency-backend-architect`        | Bound Redis caching to `invalidateMoneyCaches` & never-cache-errors; enforced `.rpc()` transactions & `TenancyContext`                         |
|  4  | `hisabche-database-optimizer`            | Team A  | `implementer` | `engineering/engineering-database-optimizer.md`              | `hisabche-agency-database-optimizer`       | Enforced zero live DDL, additive migrations, `REVOKE ALL`, `VERIFY-*.sql`, `*.pg.test.ts`                                                      |
|  5  | `hisabche-code-reviewer`                 | Team A  | `read-only`   | `engineering/engineering-code-reviewer.md`                   | `hisabche-agency-code-reviewer`            | Scoped read-only; enforced `any`/`@ts-ignore`/`?? 0`/hardcoded currency bans & `.claude/agents/domain-reviewer.md` cross-check                 |
|  6  | `hisabche-minimal-change-engineer`       | Team A  | `implementer` | `engineering/engineering-minimal-change-engineer.md`         | `hisabche-agency-minimal-change-engineer`  | Enforced Error-First `§0.5`, zero drive-by refactors, working tree preservation                                                                |
|  7  | `hisabche-security-architect`            | Team B  | `read-only`   | `security/security-architect.md`                             | `hisabche-agency-security-architect`       | Bound to `workspace_id`, `request.tenancy.role`, Step-Up TOTP, `createAuthClient()` isolation, fail-closed offline JWT & SQLite crypto         |
|  8  | `hisabche-appsec-engineer`               | Team B  | `implementer` | `security/security-appsec-engineer.md`                       | `hisabche-agency-appsec-engineer`          | Enforced fail-closed RBAC, `allowedHeaders`, secret leakage guards, real HTTP `app.inject()` 401/403 proofs                                    |
|  9  | `hisabche-penetration-tester`            | Team B  | `read-only`   | `security/security-penetration-tester.md`                    | `hisabche-agency-penetration-tester`       | Restricted adversarial testing strictly to local code and sandboxed `app.inject()` / test doubles                                              |
| 10  | `hisabche-ai-code-security-auditor`      | Team B  | `read-only`   | `security/security-ai-generated-code-auditor.md`             | `hisabche-agency-security-auditor`         | Scoped read-only alongside `.claude/agents/security-reviewer.md` targeting silent AI shortcuts                                                 |
| 11  | `hisabche-financial-controller`          | Team B  | `read-only`   | `finance/finance-bookkeeper-controller.md`                   | `hisabche-agency-financial-controller`     | Adapted GAAP copy to integer minor units, `unknown = null`, FIFO/AVCO layers, immutable journal reversals, multi-currency balance verification |
| 12  | `hisabche-mobile-app-builder`            | Team C  | `implementer` | `engineering/engineering-mobile-app-builder.md`              | `hisabche-agency-mobile-app-builder`       | Stripped SwiftUI iOS blocks & mojibake headings; locked to Expo SDK 51, RN 0.74, Legacy WebView, zero RN New Architecture                      |
| 13  | `hisabche-desktop-app-engineer`          | Team C  | `implementer` | `engineering/engineering-desktop-app-engineer.md`            | `hisabche-agency-desktop-app-engineer`     | Scoped to Electron 31 IPC, `better-sqlite3` / `node:sqlite`, `safeStorage`, `file://` routing & `tsconfig.node.json`                           |
| 14  | `hisabche-realtime-sync-engineer`        | Team C  | `implementer` | `engineering/engineering-realtime-collaboration-engineer.md` | `hisabche-agency-sync-engineer`            | **Conflict Override:** banned upstream Redis pub/sub, client polling, and Last-Write-Wins (LWW) on financial sync                              |
| 15  | `hisabche-database-reliability-engineer` | Team C  | `implementer` | `engineering/engineering-database-reliability-engineer.md`   | `hisabche-agency-dbre`                     | Bound to signed writer fencing (`ha-writer-fencing-01`), fail-closed replica routing, `SchemaFingerprintEngine`, `dr-restore-drill.mjs`        |
| 16  | `hisabche-sre`                           | Team C  | `read-only`   | `engineering/engineering-sre.md`                             | `hisabche-agency-sre`                      | Bound to 5-Layer Outcome-Driven health (`§0.7`), `/api/health/db`, replica circuit breakers                                                    |
| 17  | `hisabche-devops-automator`              | Team C  | `implementer` | `engineering/engineering-devops-automator.md`                | `hisabche-agency-devops-automator`         | Prevented unverified Nginx reload claims (`NGINX_RELOAD_WEBHOOK_URL`) and unauthorized production builds                                       |
| 18  | `hisabche-performance-benchmarker`       | Team C  | `read-only`   | `testing/testing-performance-benchmarker.md`                 | `hisabche-agency-performance-benchmarker`  | Cleaned mojibake headings; bound to real measured latency/bundle budgets and banned `.limit(N)` shortcuts under totals                         |
| 19  | `hisabche-api-tester`                    | Team C  | `implementer` | `testing/testing-api-tester.md`                              | `hisabche-agency-api-tester`               | Cleaned mojibake headings; bound to `buildServer()` + `app.inject()`, Zod nullable schemas, `/api` prefix & offline matrix parity              |
| 20  | `hisabche-product-manager`               | Team D  | `read-only`   | `product/product-manager.md`                                 | `hisabche-agency-product-manager`          | Narrowed from `Write, Edit` to `read-only`; cleaned mojibake headings; enforced Universal DNA composition over 67 trades                       |
| 21  | `hisabche-ux-researcher`                 | Team D  | `read-only`   | `design/design-ux-researcher.md`                             | `hisabche-agency-ux-researcher`            | Bound to `.claude/ux-audit/` and Single-Hub `One UX` (`?tab=`, `?view=`, Express Actions)                                                      |
| 22  | `hisabche-ui-designer`                   | Team D  | `implementer` | `design/design-ui-designer.md`                               | `hisabche-agency-ui-designer`              | Cleaned mojibake headings; enforced design tokens (`--color-*`), `DataTable`, `SelectField`, logical RTL CSS (`ms-`/`me-`)                     |
| 23  | `hisabche-i18n-engineer`                 | Team D  | `implementer` | `engineering/engineering-i18n-engineer.md`                   | `hisabche-agency-i18n-engineer`            | Enforced synchronized `fa`/`af`/`en` bundles, `DARI-GLOSSARY.md`, `packages/formatting`, `useLocalePush`                                       |
| 24  | `hisabche-test-automation-engineer`      | Team E  | `implementer` | `testing/testing-test-automation-engineer.md`                | `hisabche-agency-test-automation-engineer` | Enforced multi-currency/multi-workspace fixtures, balance assertions, guard inversion testing, never weaken tests                              |
| 25  | `hisabche-evidence-collector`            | Team E  | `read-only`   | `testing/testing-evidence-collector.md`                      | `hisabche-agency-evidence-collector`       | Stripped PHP/Blade paths & external port-8000 capture script; bound to `EVIDENCE-STANDARD.md`                                                  |
| 26  | `hisabche-test-results-analyzer`         | Team E  | `read-only`   | `testing/testing-test-results-analyzer.md`                   | `hisabche-agency-test-results-analyzer`    | Bound to monorepo Vitest/Jest/PG/TSC outputs & exact pass/fail/skip counting                                                                   |
| 27  | `hisabche-reality-checker`               | Team E  | `read-only`   | `testing/testing-reality-checker.md`                         | `hisabche-agency-reality-checker`          | Stripped PHP/Blade/external capture scripts; bound to 5-Layer Outcome-Driven gate, `RELEASE-POLICY.md` veto authority                          |

---

## C. Team Architecture & Single-Ownership Separation

The agency enforces strict separation across **Command**, **Architecture/Design Authority**, **Single-Owner Implementation**, and **Independent Verification**:

- **Command (`hisabche-agents-orchestrator`):** Selects `LIGHTWEIGHT`, `STANDARD`, or `CRITICAL` profile (`ORCHESTRATION.md`) so routine fixes spawn 1–2 agents instead of 27, assigns one file write owner per module, and escalates after 3 failed Dev ↔ QA loops.
- **Team A — Architecture & Core Engineering (`teams/architecture/README.md`):** `Software Architect` _(ro)_, `Backend Architect` _(impl)_, `Database Optimizer` _(impl)_, `Code Reviewer` _(ro)_, `Minimal Change Engineer` _(impl)_.
- **Team B — Security & Financial Integrity (`teams/security/README.md`):** `Security Architect` _(ro)_, `Application Security Engineer` _(impl)_, `Penetration Tester` _(ro)_, `AI-Generated Code Security Auditor` _(ro)_, `Financial Bookkeeper & Controller` _(ro)_.
- **Team C — Platform, Offline, HA & Mobile (`teams/platform/README.md`):** `Mobile App Builder` _(impl)_, `Desktop App Engineer` _(impl)_, `Realtime Sync Engineer` _(impl)_, `Database Reliability Engineer` _(impl)_, `SRE` _(ro)_, `DevOps Automator` _(impl)_, `Performance Benchmarker` _(ro)_, `API Tester` _(impl)_.
- **Team D — Product, Experience & i18n (`teams/product/README.md`):** `Product Manager` _(ro)_, `UX Researcher` _(ro)_, `UI Designer` _(impl)_, `Internationalization Engineer` _(impl)_.
- **Team E — Quality, Verification & Release (`teams/quality/README.md`):** `Test Automation Engineer` _(impl)_, `Evidence Collector` _(ro)_, `Test Results Analyzer` _(ro)_, `Reality Checker` _(ro — Veto Gate)_.
- **Pre-Existing Local Guards Preserved:** `.claude/agents/{domain-reviewer,parity-reviewer,security-reviewer,sales-product-analyst,sales-script-writer}.md` remain untouched and act alongside Team A/B/E reviewers.

---

## D. Harness Integration Matrix

| Harness                        | Host Availability                                                                               | Installation Target                                                                                                                   | Repository Mirror                                                | Preserved Pre-Existing Files                                                                        | Live Discovery Evidence                                                                                                            | Status                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Antigravity (`agy`)**        | Binary present (`C:\Users\hamed\AppData\Local\agy\bin\agy.exe`); LS running (`localhost:53814`) | `C:\Users\hamed\.gemini\config\plugins\hisabche-agency\` (`plugin.json`, `rules/AGENTS.md`, `skills/hisabche-agency-*/SKILL.md` × 27) | `hisabche-agency/integrations/antigravity/hisabche-agency/`      | Unrelated user skills & plugins untouched                                                           | Live `GetAllPlugins` RPC returned `{"name":"hisabche-agency","disabled":null,"isGlobal":true,"skillCount":27,"ruleCount":1}`       | `VERIFIED_COMPLETE` _(plugin registration & discovery; no separate subagent run executed)_                     |
| **Claude Code (`claude`)**     | Binary present (`C:\Users\hamed\AppData\Roaming\npm\claude.ps1`)                                | `C:\Users\hamed\.claude\agents\hisabche-*.md` × 27                                                                                    | `hisabche-agency/integrations/claude-code/agents/`               | All **18** `seo-*.md` user agents and **5** `.claude/agents/*.md` workspace agents preserved intact | Frontmatter & file counts validated by `verify-agency.mjs` Check 6; non-interactive CLI spawn skipped after shell hang without TTY | `IMPLEMENTED_NOT_LIVE_VERIFIED`                                                                                |
| **OpenAI Codex CLI (`codex`)** | **Not installed** (`codex` `NOT_FOUND`; `C:\Users\hamed\.codex` = `False`)                      | `~/.codex/agents/` **not written**                                                                                                    | `hisabche-agency/integrations/codex/agents/hisabche-*.toml` × 27 | N/A                                                                                                 | All 27 `.toml` files parsed cleanly (`name`, `description`, `developer_instructions`) by `verify-agency.mjs` Check 7               | `NOT_IMPLEMENTED` / `BLOCKED` _(host installation blocked by missing `codex` CLI; repo `.toml` archive ready)_ |

---

## E. Workflow & Template Suite

Nine standardized workflows are documented under `hisabche-agency/workflows/`:

1. `architecture-audit/WORKFLOW.md` — Single-core integrity, dependency direction, duplicate-engine detection.
2. `security-audit/WORKFLOW.md` — Tenancy (`workspace_id`), Step-Up TOTP, auth client isolation, secret scan, `app.inject()` auth matrix.
3. `database-audit/WORKFLOW.md` — Additive SQL, `REVOKE ALL`, `SET search_path`, `VERIFY-*.sql`, idempotent `.pg.test.ts` x2, `pending-ledger.mjs`.
4. `offline-sync-audit/WORKFLOW.md` — Outbox claiming, FSM transitions, SQLite partition encryption, fail-closed JWT fallback, zero LWW on money.
5. `mobile-audit/WORKFLOW.md` — Expo 51 / RN 0.74 / Legacy WebView lock, `no-node-builtins-on-device.test.ts`, host parity.
6. `ux-audit/WORKFLOW.md` — Single-hub `One UX`, logical RTL CSS, design tokens, synchronized `fa`/`af`/`en` keys & `DARI-GLOSSARY.md`.
7. `production-readiness/WORKFLOW.md` — 5-Layer Outcome-Driven Integrity sign-off + Reality Checker veto gate.
8. `regression-testing/WORKFLOW.md` — Multi-package TypeScript, ESLint, Vitest (`--maxWorkers=8`), Jest verification sequence.
9. `release-validation/WORKFLOW.md` — Explicit release preflight (`next build`, `electron-builder`, Gradle, Playwright, CI `.pg.test.ts`).

Reusable handoff, task-sizing, audit-finding, and escalation formats live in `hisabche-agency/TASK-TEMPLATES.md`.

---

## F. Governance, Conflict Precedence & Safety Guarantees

- **Conflict Precedence (`CONFLICT-RESOLUTION.md`):**
  1. Tier 1: `AGENTS.md §0` & `SECURITY-POLICY.md`
  2. Tier 2: `Financial Controller` & `Database Optimizer` data/ledger invariants
  3. Tier 3: `Software Architect` single-core non-duplication
  4. Tier 4: Mobile (`Expo 51`/`RN 0.74`/`Legacy WebView`) & Desktop (`Electron 31`) locks
  5. Tier 5: `Reality Checker` veto authority
- **Hard Project Safety Verified Across Setup:**
  - Zero edits to `backend/`, `packages/`, `apps/`, `docs/*.sql`, `package.json`, or `pnpm-lock.yaml` from this setup task (pre-existing V75 uncommitted files in the working tree preserved untouched).
  - Zero `git commit`, `git push`, `git reset`, `git checkout --`, or `git stash` commands executed.
  - Zero `.env*` reads/copies and zero JWT/private-key strings across all **142** files under `hisabche-agency/`.
  - Upstream shallow clone `C:\Users\hamed\.cache\agency-agents` left completely unmodified (`git status --short` clean at `8ae61646`).

---

## G. Verification Results

All checks below ran cleanly **after** the code/script/config edits (and `verify-agency.mjs` + `git diff --check` verified again after all documentation updates):

1. `node --check hisabche-agency/scripts/build-and-sync-agency.mjs && node --check hisabche-agency/scripts/verify-agency.mjs` -> Exit `0`.
2. `node hisabche-agency/scripts/build-and-sync-agency.mjs` -> Built & synced **27** canonical agents, **27** Antigravity skills, **27** Claude Code user agents, and **27** Codex TOMLs; exit `0`.
3. `node hisabche-agency/scripts/verify-agency.mjs` -> **9/9 `[PASS]`**, exit `0`:
   - Upstream repo clean @ `8ae61646` & MIT LICENSE preserved
   - `THIRD-PARTY-NOTICES.md` MIT attribution verified
   - 15 governance docs, 5 teams, 9 workflows verified
   - 27 specialized agents valid UTF-8 with zero stale PHP/Blade/SwiftUI/external-QA-script/mojibake regressions
   - Antigravity plugin verified (`27` skills + `rules/AGENTS.md` + `plugin.json`)
   - Claude Code agents verified (`27` `hisabche-*` installed, `18` `seo-*` & `5` workspace agents preserved)
   - Codex `.toml` archive structurally verified (`27` valid TOMLs)
   - Root `AGENTS.md` (`28210 B`) and `CLAUDE.md` (`28060 B`) cross-reference `hisabche-agency/`
   - **142** files scanned under `hisabche-agency/` with zero leaked JWTs or private key headers
4. `git.exe diff --check -- AGENTS.md CLAUDE.md` -> Exit `0` (`AGENTS.md | 12 +`, `CLAUDE.md | 12 +`, zero whitespace/EOL errors).
5. Antigravity Language Server live RPC (`POST http://localhost:53814/exa.language_server_pb.LanguageServerService/GetAllPlugins`) -> Returned `{"name":"hisabche-agency","path":"file:///C:/Users/hamed/.gemini/config/plugins/hisabche-agency","disabled":null,"isGlobal":true,"skillCount":27,"ruleCount":1}`.
6. `@hisabche/validation` compatibility & repo guard verification (run after final `AGENTS.md` / `CLAUDE.md` / script edits):
   - `npx tsc --noEmit` -> Exit `0`.
   - `npx vitest run src/__tests__/architecture-boundaries.test.ts src/__tests__/capability-claims-match-code.test.ts src/__tests__/capability-has-consumer.test.ts src/__tests__/migrations-ledger.test.ts src/__tests__/profit-report-rule.test.ts src/__tests__/unified-architecture-contracts.test.ts --maxWorkers=8` -> **Test Files 6 passed (6), Tests 77 passed (77)**, exit `0`.

---

## H. Limitations & Honest Exclusions

1. **OpenAI Codex CLI Not Installed:** `codex` binary does not exist on this Windows workstation and `C:\Users\hamed\.codex` does not exist; `~/.codex/agents/` installation was skipped honestly (`BLOCKED` / `NOT_IMPLEMENTED`) while preserving ready-to-install `.toml` files in `hisabche-agency/integrations/codex/agents/`.
2. **Claude Code Interactive Subagent Runtime:** Non-interactive `claude` execution without TTY was not relied upon; installation under `~/.claude/agents/hisabche-*.md` is verified on disk with exact YAML frontmatter (`IMPLEMENTED_NOT_LIVE_VERIFIED`).
3. **Full Monorepo Suites & Live DB/Builds Not Re-run:** Since this task exclusively created `hisabche-agency/`, user-level harness plugins, and documentation sections in `AGENTS.md` / `CLAUDE.md`, full backend `.pg.test.ts`, Electron/Android/Next builds, live Supabase migrations, and `pnpm code-intel` index rebuilds were intentionally not run per `AGENTS.md §0` & scope rules.

---

## I. Next Steps for Owner

1. **When installing OpenAI Codex CLI later:** Copy `hisabche-agency/integrations/codex/agents/*.toml` into `%USERPROFILE%\.codex\agents\` and validate with `codex`.
2. **Invoke specialized roles with profile discipline:** Prefix requests with task sizing (`LIGHTWEIGHT` | `STANDARD` | `CRITICAL`) or trigger any workflow in `hisabche-agency/workflows/`.
3. **Re-sync after policy edits:** If you modify `hisabche-agency/scripts/build-and-sync-agency.mjs`, run:
   ```bash
   node hisabche-agency/scripts/build-and-sync-agency.mjs && node hisabche-agency/scripts/verify-agency.mjs
   ```
4. **Git Commit Review:** Review `git status` and commit `hisabche-agency/`, `AGENTS.md`, and `CLAUDE.md` cleanly when ready (intentionally left uncommitted per `AGENTS.md §0 Rule 1`).

---

## J. Final Status Summary

| Workstream Component                                                                 | Exact Status                    | Notes                                                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Source Audit (`SOURCE-AUDIT.md`) & License Attribution (`THIRD-PARTY-NOTICES.md`)    | `VERIFIED_COMPLETE`             | All 18 divisions / 268 templates inspected; clean upstream clone @ `8ae61646` preserved               |
| Agency Architecture, Governance, Teams (5) & Workflows (9)                           | `VERIFIED_COMPLETE`             | 15 docs, 5 team charters, 9 workflows verified by `verify-agency.mjs` Check 3                         |
| 27 Specialized Agent Definitions (`agents/hisabche-*.md`)                            | `VERIFIED_COMPLETE`             | Validated by `verify-agency.mjs` Check 4 (conflicts stripped, mojibake clean)                         |
| Antigravity User Plugin (`~/.gemini/config/plugins/hisabche-agency`)                 | `VERIFIED_COMPLETE`             | On-disk 27 skills + live `GetAllPlugins` RPC (`skillCount: 27, ruleCount: 1`)                         |
| Claude Code User Subagents (`~/.claude/agents/hisabche-*.md`)                        | `IMPLEMENTED_NOT_LIVE_VERIFIED` | 27 installed + 18 `seo-*` & 5 workspace agents preserved; live interactive session spawn not executed |
| OpenAI Codex Host Installation (`~/.codex/agents/*.toml`)                            | `BLOCKED` / `NOT_IMPLEMENTED`   | 27 valid `.toml` files ready in repo mirror; `codex` CLI binary absent on host                        |
| Root Rule Linking (`AGENTS.md §11`, `CLAUDE.md §12`) & `@hisabche/validation` Guards | `VERIFIED_COMPLETE`             | `git diff --check` exit 0; `@hisabche/validation` `tsc` (0) + 6/6 suites / 77/77 tests passed         |
| Overall Agency Program Readiness                                                     | `IMPLEMENTED_NOT_LIVE_VERIFIED` | Complete, verified local setup ready for interactive team orchestration                               |
