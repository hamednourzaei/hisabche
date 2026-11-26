# Adding an Independently Updateable Module to Hisabche

1. **Verify Separability:** Confirm no Core accounting, ledger, costing, invoice, or payment logic lives inside the module (`AGENTS.md §2`).
2. **Define `ModuleExtensionContract`:** Export navigation, routes, widgets, permissions, reports, workflows, forms, validation schemas, i18n namespaces, background jobs, API endpoints, sync entities, local tables, and industry profiles using `packages/updater-core/src/module-contract.ts`.
3. **Author `ModuleManifest`:** Declare `requiredCoreRange`, `apiRange`, `dbSchemaRange`, `platforms`, `requiredCapabilities`, `requiredPermissions`, and `rollbackCompatibility`. Never self-grant capabilities/permissions outside workspace entitlements.
4. **Gate UI & Prefetch:** Register the pack route in `packages/app-shell/src/features/packs/pack-gate.tsx` and `prefetch.ts` so unmounted modules make zero API queries.
5. **Sign & Publish:** Sign the manifest externally with `scripts/updates/sign-release.mjs --key-file <pem> --artifact <bundle.bin>` and publish to `/api/updates/v2/releases` starting at `internal` ring.
6. **Verify:** Run `resolveModuleDependencies`, `quality-gates.test.ts`, and `module-proof.test.ts` (install, update, crash-rollback, offline use, entitlement revocation).
