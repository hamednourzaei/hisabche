# HISABCHE — BRAND ASSET ENGINE V1

## Complete Audit, Architecture Correction & Production-Grade Implementation

**Target:** `/fa/settings` → «لوگو، مهر و امضا» (`logo_url`, `stamp_url`, `signature_url`)  
**Repository:** `hamednourzaei/hisabche`  
**Execution Mode:** Autonomous, phased, no subagents, strict `AGENTS.md §0` & `CLAUDE.md` compliance.

---

## Execution Phases

- **Phase 0 — Repository Rules & Preflight:** Record branch, HEAD, `git status --short`, existing tests, and dependencies without modifying `.env*`, lockfiles, or pre-existing dirty files.
- **Phase 1 — Complete Implementation Audit:** Trace Settings UI → File Selection → Client Validation → Image Processing → API Hook → HTTP → Auth → Workspace Authorization → Backend Validation → Workspace Service → Storage Provider → DB Reference → Image Retrieval → Cache → Invoice Rendering → PDF Output. Find every caller of `logo_url`, `stamp_url`, `signature_url`, `logoUrl`, `stampUrl`, `signatureUrl`.
- **Phase 2 — Image Processing Engine:** Format-aware optimization (PNG, JPEG, WebP, SVG) using existing repo dependencies only, strict SVG sanitization (XSS/XML/script/external-ref rejection), resolution/pixel/bomb protection, real size/dimension/time metrics.
- **Phase 3 — Upload Experience:** Drag-and-drop, previews, dimensions/size info, honest progress/state (no fake percentages), cancel/abort (`AbortController`), FileReader error handling, duplicate-submission prevention, workspace-switch protection, input reset, preserving old asset until replacement succeeds.
- **Phase 4 — Storage Architecture:** Reuse existing storage provider (`backend/src/storage/`), workspace-scoped object keys (`business-assets/{workspaceId}/{assetType}/{assetId}/{version}`), server-side content/MIME/dimension validation, SHA-256 integrity, private storage + secure retrieval/signed URLs, cache invalidation.
- **Phase 5 — Database & Migration Safety:** Check schema/historical migrations; if changes are required, produce additive idempotent `docs/*-migration.sql` + `docs/VERIFY-*.sql` + `*.pg.test.ts` (never execute live DDL).
- **Phase 6 — Replacement & Delete Transactions:** Safe upload-first -> DB update -> verify -> cache invalidate -> retire previous asset; orphan cleanup on DB failure; confirmed deletion with state verification.
- **Phase 7 — Error Handling:** Structured error taxonomy with stable codes, HTTP statuses, safe Persian messages, server logs, retryability, and intact previous-asset guarantees.
- **Phase 8 — Observability:** Structured logs (trace ID, workspace ID, asset type, sizes, durations, outcomes — zero image bytes/Base64/secrets).
- **Phase 9 — Security & Authorization:** Server-side RBAC, cross-tenant rejection, forged key/ID rejection, path traversal, MIME spoofing, SVG injection.
- **Phase 10 — Test Matrix:** Unit, HTTP (`buildServer()` + `app.inject()`), multi-tenancy, and UI regression tests.
- **Phase 11 — Performance Verification:** Before/after byte, dimension, memory, and duration measurements.
- **Phase 12 — I18N & UI Quality:** Synchronized `fa`/`af`/`en` keys, RTL logical CSS, accessible controls, reduced-motion compatibility.
- **Phase 13 — Final Verification:** `tsc --noEmit`, `eslint`, focused Vitest suites, `git diff --check`, `pnpm code-intel update`.
- **Phase 14 — Continuous Knowledge Capture & Final Report:** Extend relevant `.agents/skills/` & `.claude/skills/` + `hisabche-knowledge-index` and deliver the Persian engineering report.

---

## Status Ledger (Updated Live)

- Phase 0–1 (Audit & Caller Trace): `VERIFIED_COMPLETE`
- Phase 2 (Image Processing & SVG Sanitizer): `IMPLEMENTED_NOT_LIVE_VERIFIED`
- Phase 3 (Upload UX, Cancel, Previews, Confirm Delete): `IMPLEMENTED_NOT_LIVE_VERIFIED`
- Phase 4–9 (Storage, Transactions, Errors, Observability, Auth): `IMPLEMENTED_NOT_LIVE_VERIFIED`
- Phase 5 (DB Compatibility): `VERIFIED_COMPLETE` (existing `logo_url`, `stamp_url`, `signature_url` preserved backward-compatibly; zero breaking schema changes needed)
- Phase 10–14 (Tests, i18n, Code-Intel, Knowledge Capture): `VERIFIED_COMPLETE` (local Vitest/TSC/ESLint)
