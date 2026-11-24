# گیت‌های ارزیابی کیفیت Skill و خروجی Claude Code

این سند معیار ارزیابی است؛ تست‌های زیر باید به تست‌های واقعی پروژه متصل شوند، نه اینکه صرفاً به‌صورت چک‌لیست PASS شوند.

## Gate A — Skill hygiene

- Frontmatter معتبر و name یکتا.
- شرح دقیق و trigger-based.
- دستورالعمل‌ها با `AGENTS.md` تعارض ندارند.
- Skill موجود دوباره‌سازی نشده.
- ارجاعات داخلی به فایل‌های موجود یا فایل‌های همین بسته اشاره می‌کنند.
- هیچ ادعای ساختگی درباره API، جدول یا تست وجود ندارد.

## Gate B — Repository grounding

- `AGENTS.md` کامل خوانده شده.
- Code intelligence freshness بررسی شده.
- مسیر واقعی schema/service/RPC/tests از checkout جاری ثبت شده.
- همه ادعاها برچسب evidence دارند: `VERIFIED`, `INFERRED`, `UNKNOWN`.
- نبود نتیجه در index به معنی نبود قابلیت تلقی نشده است.

## Gate C — Financial correctness

- Double-entry balance.
- Debit/credit side constraints.
- Workspace and FK integrity.
- Currency isolation and scale.
- AFN zero-decimal handling.
- Idempotent posting.
- Concurrency and locking.
- Atomic rollback.
- Immutable posted entries and linked reversals.
- Unknown/partial values are never coerced to zero.
- COGS and stock layer conservation.
- Reconciliation of source events to journals.

## Gate D — Database resilience

- Single-writer invariant.
- Replica lag/freshness policy.
- Fencing and split-brain prevention.
- Independent backup storage.
- WAL/PITR continuity.
- Actual isolated restore drill.
- Schema/extension/function/RLS/grant parity.
- Object storage recovery.
- Auth and other external dependencies tested separately.
- Measured RPO/RTO with exact drill window.

## Gate E — Offline and failure correctness

- Durable outbox.
- Stable mutation identity.
- Unknown commit outcome handling.
- No LWW for financial state.
- Crash/restart tests.
- Multi-device concurrency.
- Cursor atomicity.
- Server-side permission revalidation.
- Device performance under weak network.

## Gate F — Release verification

- Relevant typecheck/lint/tests run with exit codes.
- No test weakened or skipped.
- `git diff --check`.
- Changed files only are task-related.
- No build unless requested.
- No production DDL/write/failover without approval.
- No commit/push.
- Runtime, device and production verification reported separately.

## Required final report

| Area               | Status | Evidence | Remaining blocker |
| ------------------ | ------ | -------- | ----------------- |
| Skill installation |        |          |                   |
| Ledger invariants  |        |          |                   |
| Financial posting  |        |          |                   |
| Reconciliation     |        |          |                   |
| HA/DR              |        |          |                   |
| Offline sync       |        |          |                   |
| Automated tests    |        |          |                   |
| Runtime/device     |        |          |                   |
| Production         |        |          |                   |

Allowed statuses: `VERIFIED_COMPLETE`, `IMPLEMENTED_NOT_LIVE_VERIFIED`, `VERIFIED_WITH_LIMITATIONS`, `BLOCKED`, `NOT_IMPLEMENTED`.
