# ADR-0001: One Build + Rollup Chunk Groups for Feature Packs

- **Status:** Accepted (V62)
- **Date:** 2026-11-12
- **Deciders:** Hisabche Architecture / Engineering

## Context

Prior to V62:

- `apps/mobile/vite.shell.config.mjs` forced `singleFile: true` / `inlineEverything` for historical React Native Metro reasons even though Android already loads `file:///android_asset/shell/index.html`, producing a ~7.31 MB single-file HTML bundle parsed on every cold start.
- Desktop (stale 8 Nov renderer build) emitted a ~9.35 MB monolithic `index-*.js` entry (~75.4% of 12.40 MB total JS) because eager barrel imports in `providers.tsx` and `route-error.tsx`, missing `sideEffects` declarations in `@hisabche/ui` and `@hisabche/api`, and static all-locale JSON bundling in `@hisabche/i18n` pulled the entire UI and all 3 languages into the entry chunk.
- Loading 7 independent micro-frontend builds would fragment React, React Query, Zustand, and `@hisabche/i18n` singletons and multiply build/test complexity.

## Decision

1. Keep **one Vite/Rollup shell build per host** (`packages/app-shell/vite.shell.mjs` for Desktop, `apps/mobile/vite.shell.config.mjs` with `singleFile: false` for Mobile).
2. Derive 7 canonical packs (`core` + 6 installable feature packs: `operations`, `manufacturing`, `workforce`, `approvals`, `intelligence`, `marketplace`) directly from `ENGINES` in `packages/validation/src/schemas/business-capabilities.ts` via `FEATURE_PACKS` (`packages/validation/src/schemas/feature-packs.ts`).
3. Emit `packages/app-shell/pack-map.generated.json` via `scripts/packs/emit-pack-map.mjs` so `.mjs` Vite configs split code deterministically into `pack-<id>` chunks and `locale-<lang>` chunks (`build.manifest: true`, `manualChunks: shellManualChunks`).
4. Gate pack routes in `packages/app-shell/src/app/app.tsx` with `PackRouteGate` and pass pack-scoped `entityTypes` in sync requests, keeping `packs.delivery=off` and `packs.installer=full` by default until signed pack delivery is enabled.

## Consequences

- **Positive:** Shared runtime singletons (React, QueryClient, Zustand, i18n, SQLite bridge) remain intact with zero duplicate framework code. Both full-installer and modular-delivery builds come from the exact same Vite build graph.
- **Positive:** Lazy-loaded pack routes and dynamic locale imports drop initial parse/eval payload dramatically even before remote CDN pack delivery is turned on.
- **Negative / Trade-offs:** Shared dependencies used by multiple packs still land in shared Rollup chunks unless split further; budget monitoring via `scripts/packs/report.mjs` + `bundle-budgets.json` is required on every release so shared chunks do not quietly grow back into a monolith.
