# Hisabche Engineering Agency

Specialized, evidence-driven AI Engineering Organization adapted for **Hisabche** from [`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents) (`8ae6164602c95ca78828b148b9052460ee426885`, MIT License).

This workspace folder holds the **governance, specialized team architecture, selection & conflict matrix, orchestration workflows, conversion/installation scripts, and verification suite** cleanly separated from Hisabche application code (`backend/`, `packages/`, `apps/`, `docs/*.sql`).

## Quick Navigation

| Document                                                             | Purpose                                                                                                                |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [ORGANIZATION.md](./ORGANIZATION.md)                                 | Five engineering teams (A–E) + Orchestrator, roles, boundaries, escalation paths                                       |
| [SOURCE-AUDIT.md](./SOURCE-AUDIT.md)                                 | Complete Phase 1 audit of all 18 divisions / 268 upstream agents & scripts                                             |
| [AGENT-SELECTION.md](./AGENT-SELECTION.md)                           | 27-agent selection rationale (1 Orchestrator + 26 Team A–E specialists), detected conflicts, and harness install paths |
| [AGENT-REGISTRY.md](./AGENT-REGISTRY.md)                             | Canonical registry of slugs, read-only vs implementer modes, and tool scopes                                           |
| [GOVERNANCE.md](./GOVERNANCE.md)                                     | Authoritative Hisabche rules binding and Single Ownership Matrix                                                       |
| [SECURITY-POLICY.md](./SECURITY-POLICY.md)                           | Tenancy (`workspace_id`), RBAC, minor-unit financial integrity, secret protection                                      |
| [ORCHESTRATION.md](./ORCHESTRATION.md)                               | Context efficiency, `LIGHTWEIGHT` / `STANDARD` / `CRITICAL` modes, single-owner writes                                 |
| [EXECUTION-PROTOCOL.md](./EXECUTION-PROTOCOL.md)                     | Preflight -> Code Intel -> Scoped Edits -> Postflight discipline                                                       |
| [EVIDENCE-STANDARD.md](./EVIDENCE-STANDARD.md)                       | Mandatory finding schema & Fact/Interpretation/Assumption separation                                                   |
| [QUALITY-GATES.md](./QUALITY-GATES.md)                               | Automated verification gates + 5-Layer Outcome-Driven Integrity checks                                                 |
| [RELEASE-POLICY.md](./RELEASE-POLICY.md)                             | Reality Checker gate and mandatory status vocabulary                                                                   |
| [CONFLICT-RESOLUTION.md](./CONFLICT-RESOLUTION.md)                   | Decision precedence and deterministic conflict escalation                                                              |
| [TASK-TEMPLATES.md](./TASK-TEMPLATES.md)                             | Reusable prompt, audit, handoff, and escalation templates                                                              |
| [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)                   | Upstream license (MIT) and original file preservation notices                                                          |
| [HISABCHE-AGENCY-SETUP-REPORT.md](./HISABCHE-AGENCY-SETUP-REPORT.md) | Complete installation & verification handover report                                                                   |

## Harness Usage Summary

- **Antigravity IDE / CLI (`agy`):** Installed as user-level plugin `C:\Users\hamed\.gemini\config\plugins\hisabche-agency\` (`plugin.json`, `rules/AGENTS.md`, and 27 progressive `skills/hisabche-agency-<slug>/SKILL.md`).
- **Claude Code (`claude`):** Installed as user-level subagents under `C:\Users\hamed\.claude\agents\hisabche-*.md` (pre-existing `seo-*.md` and workspace `.claude/agents/*.md` remain untouched).
- **OpenAI Codex CLI (`codex`):** Pre-converted validated `.toml` definitions stored in [integrations/codex/agents/](./integrations/codex/agents/); user installation into `~/.codex/agents/` is **not active** because `codex` CLI is not installed on this host.

## Authority & Safety Reminder

No agent in this agency may bypass root [AGENTS.md](../AGENTS.md) or [CLAUDE.md](../CLAUDE.md). Agents must never commit, push, reset, read `.env*` files, execute live Supabase DDL/writes, install packages unprompted, or weaken tests.
