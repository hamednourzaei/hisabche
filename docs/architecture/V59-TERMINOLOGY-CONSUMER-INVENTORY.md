# HISABCHE V59 — TERMINOLOGY CONSUMER INVENTORY

**Date:** 2026-11-11  
**Canonical Hook:** `packages/ui/src/hooks/use-terminology.ts` (`useTerminology()`)  
**Canonical Profiles:** `packages/validation/src/schemas/operational-dna.ts` (`terminologyProfileSchema`, `GENERIC_TERMINOLOGY`, `resolveTerminologyProfile`)

## Resolution Order

1. `operationalDna.presentation?.terminology[slot]` (Axis 8 declarative terminology overrides)
2. `operationalDna.terminology[slot]` (DNA preset / workspace profile overrides)
3. Neutral `GENERIC_TERMINOLOGY` defaults (`UNRESOLVED` workforce / unknown DNA never falls back to retail wording)
4. Locale translation table (`packages/i18n/messages/{fa,af,en}/common.json`)

## Registered Consumers

| Component / Container | File | Slots Consumed | Fallback Key Pattern |
|---|---|---|---|---|
| `AddProductModal` | `packages/ui/src/components/ui/add-product-modal.tsx` | `addItemActionKey`, `itemLabelKey` | `dna.terms.itemAdd`, `dna.terms.item` | Wired (`useTerminology()`) |
| `DashboardContainer` | `packages/ui/src/components/ui/dashboard/containers/dashboard-container.tsx` | Role start screens, `setupGapsPrompt`, `transactionLabelKey`, `itemLabelKey` | `dashboard.setupGapsPrompt`, `dashboard.overview` | Wired (`useTerminology()`) |
| `DashboardRegistry` | `packages/ui/src/components/ui/dashboard/DashboardRegistry.ts` | Neutral widget labels & `terminology` on `resolveRoleStartScreen` / `resolveDashboardComponentLabel` | `dashboard.*` | Wired (`resolveTerminologyProfile`) |
| `OperatingQuestions` | `packages/ui/src/components/ui/onboarding/operating-questions.tsx` | `staffArrangement` (`operatorLabelKey`) & `produces` (`itemLabelKey`) | `onboarding.dna.staffArrangement.*` | Wired (`useTerminology()`) |
| `DnaMenuSuggestion` | `packages/ui/src/lib/menu/dna-menu-suggestion.ts` | `presentation.navigation.hiddenPaths` + `suggestedNavigationContext` | Empty suggestions when unresolved | Wired (`resolveTerminologyProfile`) |

## Localization Parity Status

- V59.1 reconciled `landing.security.badge.*` and all V59.1 trade/foundation keys with 3-way key parity across `fa`, `af`, and `en` (`packages/i18n/messages/{fa,af,en}/common.json`).
