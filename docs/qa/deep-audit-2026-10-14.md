# Deep audit — 14 Oct 2026

The registry of every finding (82 rows, status per row) is kept in
`.claude/LIVE-AUDIT-2026-10-14.md`; lessons in `.claude/SESSION-CACHE-2026-10-14-LIVE-AUDIT.md`.

- Production was read-only. All fixes are local and uncommitted.
- Production data repair (till ×100, bank payments booked to cash) is a separate, reviewed step,
  based on `docs/FINDING-till-units-and-routing-2026-10-14.sql`.
- New migration: `docs/custom-units-01-migration.sql` —
  Post-migration verification query generated — PENDING HUMAN CONFIRMATION.
