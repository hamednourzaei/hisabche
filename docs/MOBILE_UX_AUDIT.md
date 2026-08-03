# Mobile UX Audit

## 1. The core defect: mobile is on the wrong design system

Mobile tokens were mirrored from `apps/mobile/globals.css` — a **legacy, light-first** sheet.
The production web system is `packages/ui/src/styles/globals.css` **v3.1, dark-first**.
They are two different products visually.

| Token | Web (production v3.1) | Mobile (current) | Verdict |
|---|---|---|---|
| primary | `165 75% 51%` emerald/teal | `158 100% 37%` flat green | **wrong hue + wrong lightness** |
| default theme | dark (`210 33% 9%`) | light (`0 0% 100%`) | **inverted** |
| surfaces | base / muted / elevated / overlay (4 levels) | background / card / muted (3) | missing elevation step |
| text | primary / secondary / tertiary | foreground / mutedFg | **no tertiary tier → flat hierarchy** |
| radii | 6 / 8 / 12 / 16 / 20 / 24 | 4 / 6 / 8 / 12 / 16 / 24 | too tight, reads cheap |
| brand gradient | 5-stop `--gradient-brand` | none | no brand presence |
| glass / premium shadow | yes | plain shadows | flat |

## 2. UX problems, ranked

1. **Login** — a stacked form on a white page. No logo, no brand statement, no gradient, no
   floating labels, no password reveal. Biometric button appears only if already enabled.
2. **Dashboard** — four equal-weight cards. Every metric competes; nothing leads. `totalSales`
   and `warehouseValue` get identical visual weight. Wasted vertical space between rows.
3. **No numeric treatment** — `12,699,000 ؋` renders in the same face/size as body copy.
   Financial apps lead with the number; ours buries it.
4. **Tab bar is stock** — default Expo tabs. No animation, no haptics, no active indicator.
5. **Cards are outlines** — 1px border + 1px shadow on every surface. No hierarchy between a
   KPI card, a list row and a container.
6. **Lists are flat rows** — no avatars, no swipe actions, no filter chips on sales.
7. **Offline is invisible** — the outbox works, but nothing on screen says
   "۳ فاکتور منتظر همگام‌سازی" until you open Settings → Sync.
8. **Empty space** — `EmptyState` centres text in a large void; placeholder screens are blank.

## 3. Web ↔ mobile divergence

- Web is **dark-first with a light override**; mobile defaults to system with a light bias.
- Web uses a 4-surface elevation ladder and a 3-tier text ramp; mobile has neither.
- Web leans on `--gradient-brand` and `--shadow-premium` for identity; mobile has no brand marks.
- Web `--radius-lg: 16px` on cards; mobile used 16px only as `xl`, so cards looked sharper/cheaper.
- Shared and correct already: fa-IR / fa-AF / en, Vazirmatn, RTL, and all API/validation logic.

## 4. Components requiring rebuild

| Rebuild | Why |
|---|---|
| `tokens/colors` | Re-derive from web v3.1: 4 surfaces, 3 text tiers, dark-first. |
| `tokens/typography` | Add Display / Numeric / NumericLarge with tabular figures. |
| `MobileCard` | Variants: `plain` / `elevated` / `glass` / `gradient`. Drop the universal border. |
| `MetricCard` | Compact secondary tile — not the hero. |
| `Text` | Map to the 3-tier ramp. |
| `Button` | Gradient primary, proper pressed scale. |
| `Input` | Floating label, password reveal, focus ring. |
| Tab bar | Custom, animated, haptic. |

| Build new | Purpose |
|---|---|
| `HeroMetricCard` | The one number that leads a screen, with trend + sparkline. |
| `Money` | Locale-aware amount + currency sign, tabular, weight-differentiated. |
| `SectionHeader` | Title + action, replaces ad-hoc `<Text variant="heading">`. |
| `QuickAction` | Icon tile row under the hero KPI. |
| `BottomSheet` / `ActionSheet` | Sheets instead of pushed pages for pickers. |
| `FilterBar` | Chip row for sales/inventory filters. |
| `Avatar` | Initials + colour hash for CRM. |
| `OfflineBanner` | Persistent, tappable sync status. |
| `Sparkline` | Inline trend, no chart library. |

## 5. Strategy

- **Dark-first**, matching web. Light theme is the override, not the base.
- **One hero per screen.** A single dominant number, then secondary tiles, then lists.
- **Elevation over outline.** Surfaces separate by tone and shadow; borders only where needed.
- **Numbers are the product.** Tabular figures, large weights, currency sign de-emphasised.
- **Sheets over pages** for pickers and filters — fewer navigation stacks.
- **Motion is functional only**: fade, slide, scale, `LayoutAnimation`. Native driver, 60 FPS.
- No new dependencies for charts or sheets — RN `Animated` + `Modal` keep the Redmi 9 budget.
