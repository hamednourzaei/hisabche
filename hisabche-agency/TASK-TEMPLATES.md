# Reusable Task, Handoff & Audit Templates

Use these compact templates to eliminate repetitive boilerplate and minimize token overhead.

---

## 1. Task Dispatch Template (`LIGHTWEIGHT` / `STANDARD` / `CRITICAL`)

```markdown
## Agency Task Packet

- **Profile:** LIGHTWEIGHT | STANDARD | CRITICAL
- **Workflow:** `workflows/<name>/WORKFLOW.md` (or standalone fix)
- **Primary Owner (Write Lock):** `<agent-slug>`
- **Independent Reviewer(s):** `<agent-slug>`
- **Target Scope:** `<exact files/packages>`
- **Preloaded Hisabche Skills:** `<hisabche-*>`
- **Constraints Reminder:** Obey `AGENTS.md §0` (no git ops, no live DDL, no `.env*`, no duplicate core, `--maxWorkers=8`).
- **Acceptance Criteria:**
  1. <observable check / invariant>
  2. `tsc --noEmit` + `eslint` + relevant suite PASS after final edit
```

---

## 2. Inter-Agent Handoff Envelope

```markdown
## Handoff: <from-agent> -> <to-agent>

- **Status So Far:** IMPLEMENTED_NOT_LIVE_VERIFIED | PARTIALLY_IMPLEMENTED | BLOCKED
- **Touched Files:** `<exact relative paths>`
- **Verified Checks:** `<command -> exact passed/failed counts & exit code>`
- **Unresolved Risks / Next Check Needed:** `<exact item>`
- **Non-Assumptions:** Do NOT re-read unchanged files unless modified below.
```

---

## 3. Finding Entry Template

Follow [EVIDENCE-STANDARD.md](./EVIDENCE-STANDARD.md) §2 verbatim (`Finding ID`, `Category`, `Severity`, `Exact File & Lines`, `Reproduction Steps`, `Actual Command/Test Output`, `Expected Behavior`, `Observed Behavior`, `Root Cause`, `Recommended Action`, `Verification Status`).
