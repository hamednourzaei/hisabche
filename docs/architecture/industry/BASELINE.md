# Baseline — working tree before the industry change

Captured: 26 Oct 2026

- HEAD: `41031ed2` («SEO: internal-link graph…»)
- 36 modified + 7 untracked owner files were already present before this work (checkpoint record).
  Current `git status --short` after this work: 42 modified + 17 untracked. The extra entries are
  this change; the original owner files were not reverted, reformatted or otherwise touched.
  Owner changes include `filter-contract.ts`, offline product/customer read tests,
  `capability-matrix.csv`, golden vectors, warehouse shelves and i18n.
- No commit, push, reset, checkout, stash or rebase was performed.
- Backend `npx tsc --noEmit` fails in `backend/src/services/inventory/warehouse-summary.domain.ts:61`
  (`Property 'category' does not exist on type 'WarehouseProduct'`). Neither file is part of this
  change; the error comes from the owner's in-progress `product.schema.ts` work and is reported
  separately, not «fixed» here.
