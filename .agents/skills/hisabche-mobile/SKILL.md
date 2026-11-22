---
name: hisabche-mobile
description: Building or changing anything in apps/mobile — React Native screens, native components, mobile navigation, or the mobile string bundle.
---

# Mobile (Expo + React Native)

Expo SDK 51, expo-router, React Native. Genuinely native — **never add
`react-native-web` or a WebView to reuse web UI.**

```
apps/mobile/app/                     expo-router file routes
apps/mobile/src/features/            screens by domain
apps/mobile/src/shared/components/   AppScreen, QueryList, ScreenHeader
apps/mobile/src/shared/i18n/         mobile-strings.ts (own bundle)
packages/mobile-ui/                  primitives + tokens
```

## Parity means semantics, not pixels

Same product, same words, same information hierarchy, same states as web —
adapted to the platform:

| Web     | Mobile       |
| ------- | ------------ |
| table   | card list    |
| modal   | bottom sheet |
| hover   | press state  |
| sidebar | tab bar      |
| toolbar | action menu  |

If web shows a sale/purchase filter, mobile shows one too. If web says
«خریدار» for a sale and «فروشنده» for a purchase, mobile uses the same words.

## Components and tokens

From `@hisabche/mobile-ui`: `MobileCard`, `Text`, `Money`, `StatusChip`,
`Avatar`, `FilterBar`, `SearchBar`, `SwipeRow`, `FloatingButton`, `useTheme`.
Never hardcode a colour — take it from `useTheme()`. Token parity with web is
enforced by tests in `packages/mobile-ui/src/tokens/__tests__/`.

Icons: `@expo/vector-icons` (Ionicons).

## Strings

`apps/mobile/src/shared/i18n/mobile-strings.ts`, typed by `MobileBundle`,
under the `mobile` i18next namespace. Adding a key means updating the interface
and all three locales (`fa-IR`, `fa-AF`, `en`) or it will not compile.

Locale codes differ from web: `fa-IR | fa-AF | en`. Use `toMessageLocale()` from
`@hisabche/i18n/messages` to map.

## Offline

The outbox merges queued records into lists so a sale recorded offline appears
immediately — see `usePendingInvoices`. Any server-side filter you add must be
applied to queued items too, or pending records vanish when the user filters.

Queued items have no server id: `keyExtractor={(item, i) => item.id ?? \`pending-${i}\`}`.

## API base URL

`apps/mobile/src/shared/lib/api.ts` re-points `apiClient.defaults.baseURL`.
Values pass through `normalizeBaseUrl` — a trailing space from a shell `set`
command otherwise produces `/api%20/auth/login`.

## Metro and pnpm

Metro walks `node_modules` instead of following pnpm symlinks. RN's transitive
helpers are hoisted via `publicHoistPattern` in `pnpm-workspace.yaml`. An
"Unable to resolve X" for a package nobody imports directly usually means X
needs adding there, followed by a full reinstall.

## Validation

```bash
cd apps/mobile && npx tsc --noEmit && npx jest
```

Rendering tests are not possible — `react-test-renderer@18` cannot render
React 19. Extract pure logic and test that.

## Common mistakes

- Reaching for `packages/ui` — it is web-only.
- Hardcoded colours instead of `useTheme()`.
- A string added to the bundle but not to all three locales.
- Filtering server data but not the outbox.
- Assuming every record has a server id.
