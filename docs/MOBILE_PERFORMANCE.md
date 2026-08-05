# Mobile Performance Report

Target device class: **Redmi 9** (Helio G80, 3 GB RAM, Android 10).

## Measured

| Metric | Value | How |
|---|---|---|
| JS bundle (Android, uncompressed) | **3.36 MB** | `expo export --platform android --no-bytecode` |
| Module count in graph | ~1,180 | Metro bundle output |
| Font payload | 246 KB | Vazirmatn Regular + Bold, subset not applied |
| Type-check | clean | `tsc --noEmit`, strict, no `any` |
| Unit tests | 17 passing / 3 suites | `jest` |

Startup, memory and frame-rate numbers require a physical device or emulator run
(`npx expo run:android --variant release`) — they are **not** measured here and should be
captured before release.

## Design decisions made for this device class

**Zero chart/animation libraries.** `Sparkline` and the sales trend are plain `View` bars.
No `react-native-svg`, no `victory-native`, no `d3`. Saves ~600 KB and all the layout cost.

**No `gesture-handler` for sheets or swipe.** `BottomSheet` uses RN `Modal` + `Animated`;
`SwipeRow` uses `PanResponder`. Both run on the native driver.

**Every animation uses `useNativeDriver: true`** — tab indicator, card press scale, button
press, floating label, skeleton pulse, sheet translate, offline banner fade. None touch layout
properties, so nothing crosses the bridge per frame.

**Lists are `FlashList`, never `ScrollView`+`map`.** `QueryList` sets `estimatedItemSize` per
screen (invoices 96, products 84, customers 88) so recycling is correct on first paint.

**Rows are `memo`'d with stable props.** `InvoiceRow`, `ProductRow`, `CustomerRow`, `MetricCard`,
`TrendPill`, `Badge`, `StatusChip`, `Avatar` are all `memo`. Label formatters are `useCallback`'d
in the parent so identity is stable across renders.

**Selector-level Zustand subscriptions.** Screens read `useAuthStore((s) => s.isAuthenticated)`
rather than the whole store, so an unrelated field change does not re-render a list.

**Tabular figures instead of re-layout.** `fontVariant: ['tabular-nums']` on every numeric
variant means a changing amount never reflows its row.

## Known costs

1. **`@expo/vector-icons` ships all icon fonts** (~1 MB of TTF in the asset bundle). Only Ionicons
   is used. Switching to a subset or inline SVG paths is the single largest remaining win.
2. **Fonts are not subset.** Vazirmatn covers full Arabic/Persian ranges; a Latin+Persian subset
   would cut the 246 KB roughly in half.
3. **`react-native-reanimated` is installed** (required by `expo-router`) but no screen uses it
   directly — its babel plugin cost is paid regardless.
4. **Realtime pulls in `@supabase/supabase-js`** through the dynamic import in
   `packages/api/src/hooks/useRealtime.ts`. Metro bundles it even though the import is lazy.

## Next measurements to take

```bash
npx expo run:android --variant release
```

Then record: cold start to first frame, RSS after navigating all five tabs, and FPS while
scrolling a 500-row invoice list (`adb shell dumpsys gfxinfo com.hisabche.mobile`).
