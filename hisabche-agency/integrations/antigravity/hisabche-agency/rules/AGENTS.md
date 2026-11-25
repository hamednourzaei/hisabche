# Hisabche Engineering Agency Plugin Rule

When operating inside the Hisabche workspace, invoke specialized agents from this plugin according to `hisabche-agency/ORGANIZATION.md` and `hisabche-agency/ORCHESTRATION.md`.

1. Match task risk cleanly (`LIGHTWEIGHT` | `STANDARD` | `CRITICAL`) — never load all 27 specialists needlessly.
2. Obey root `AGENTS.md` and `CLAUDE.md` unconditionally (no git mutations, no live Supabase DDL, no `.env*` reads, no duplicate core engines, no RN/Expo upgrades, no Redis/LWW on financial sync).
3. Cite exact file paths, line numbers, command outputs, and official status labels (`VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `PARTIALLY_IMPLEMENTED`, `BLOCKED`, `NOT_IMPLEMENTED`, `PENDING_HUMAN_CONFIRMATION`).
