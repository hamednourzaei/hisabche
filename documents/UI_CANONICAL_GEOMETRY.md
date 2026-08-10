# UI CANONICAL GEOMETRY

The reference for **how big things are** across Web, Desktop and Mobile.
Companion to [UI_PARITY_SCREEN_MATRIX.md](./UI_PARITY_SCREEN_MATRIX.md), which
tracks per-screen status.

**Source of truth.** `packages/design-tokens/src/scale.ts` holds the numbers;
`packages/ui/src/styles/globals.css` is what it transcribes, and a parity test
enforces the two stay equal. Web reaches them through Tailwind's `var(--*)`
mappings, mobile through `packages/mobile-ui/src/tokens`. **Nothing in this
document is a new value** — every figure below was read out of one of those
files or off the rendered DOM.

**Verification levels.** `DOM-VERIFIED` = read from computed styles on the
running web app. `SOURCE-VERIFIED` = read from the implementation.
`PIXEL-VERIFIED` is used nowhere in this repository: the Browser pane in this
environment does not composite frames, so screenshots time out, and there is no
simulator for mobile or a scriptable Electron window.

---

## Scales

### Radius (`design-tokens/scale.ts` → `radiusPx`)

| Token | px   | Used for                                           |
| ----- | ---- | -------------------------------------------------- |
| xs    | 6    | inline chips, small inputs                         |
| sm    | 8    | —                                                  |
| md    | 12   | secondary surfaces                                 |
| lg    | 16   | inputs (`rounded-xl` on web is `--radius-xl` = 20) |
| xl    | 20   | buttons with borders, icon buttons                 |
| 2xl   | 24   | **cards** — web `rounded-2xl`, mobile `MobileCard` |
| full  | 9999 | primary actions, badges, status chips              |

### Spacing (`mobile-ui/tokens/layout.ts`, matching web rem scale)

`xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 24 · 3xl 32 · 4xl 48`

---

## Primitive geometry

| Primitive      | Web (SOURCE-VERIFIED)                             | Mobile (SOURCE-VERIFIED)                   | Verdict                                |
| -------------- | ------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| Button sm      | h-8 / h-9 (32–36px), `rounded-full`, text-xs/sm   | 36px, `radius.full`                        | match                                  |
| Button md      | h-10 (40px), `rounded-full`, px-4, text-sm        | 44px (`MIN_TOUCH_TARGET`)                  | **intentional** — touch minimum        |
| Button lg      | h-11 (44px)                                       | 54px                                       | **intentional** — primary touch action |
| Input          | h-10 (40px) + separate label above ≈ 64px stack   | 60px box with floating label inside        | equivalent field height                |
| Card           | `rounded-2xl` (24px), p-4/py-3                    | `radius['2xl']` (24px), `spacing[padding]` | **fixed this pass** — was 16px         |
| Badge          | `rounded-full`, px-2.5 py-0.5, text-xs            | `radius.full`, px `spacing.md`, py 4       | match                                  |
| Status chip    | `rounded-full` + dot                              | `radius.full` + 6px dot                    | match                                  |
| Dialog / Sheet | `rounded-2xl`, min-h-[44px] actions, max-h-[90vh] | `BottomSheet`, same action floor           | **intentional** — sheet vs dialog      |
| Tabs / filter  | min-h 28/32/36, `rounded-lg`, px-2.5–4            | `FilterBar` chips                          | match                                  |
| Table row      | h-9 / h-10 (36–40px)                              | n/a — becomes a card                       | **intentional**                        |

### Touch-target rule

Web's 40px button becomes 44px on mobile. That is not drift: 44pt is the
platform minimum, and the design token is the same semantic `md` button. Any
mobile control below 44 is a bug; any web control forced to 44 is over-applying
a mobile rule.

---

## Shell geometry — Invoices page (DOM-VERIFIED at 1280×720, `fa`, dark)

| Element           | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Sidebar width     | 224px                                                    |
| Main padding      | 16px (`p-4`), no max-width                               |
| Page title `h1`   | 30px/36px w700 — `text-xl → sm:2xl → lg:3xl`             |
| Page subtitle     | 14px/20px w400 `fg-secondary`                            |
| Primary action    | h40, radius 9999, px 20, 14px w700, `min-h-[44px]` floor |
| Filter tab active | h32, radius 16, px16/py6, 14px w500, bg primary          |
| Filter tab idle   | same box, transparent, `fg-secondary`                    |
| Export button     | h34, radius 20, 0.8px border, px12/py6, gap 6            |
| Icon button       | 36×36, radius 20                                         |

At the mobile breakpoint the web `h1` resolves to `text-xl` = 20px bold.
`mobile-ui`'s `title` variant is 22px bold — one step apart, both the top of
their own scale, so the hierarchy reads the same. No token change warranted.

---

## Responsive breakpoints

Mobile now uses the **web app's own breakpoints**, read from
`packages/ui/tailwind.config.ts` → `screens` and re-declared in
`packages/mobile-ui/src/hooks/use-breakpoint.ts`:

`xs 480 · sm 640 · md 768 · lg 1024 · xl 1280`

| Device class | Width    | Columns | Gutter | Content cap         |
| ------------ | -------- | ------- | ------ | ------------------- |
| phone        | < 768    | 1       | 16     | none (edge to edge) |
| tablet       | 768–1023 | 2       | 24     | 720                 |
| wide         | ≥ 1024   | 4       | 24     | 960                 |

`useLayout()` is a hook, not a constant, because a tablet rotates — a value read
once at import would strand the app in portrait layout after a turn.

### Where it is applied

- `AppScreen` → `AdaptiveContent` centres and caps content above phone width, so
  every mobile screen adapts from one change rather than each growing its own
  width logic. On a phone it is a pass-through: phone layout is unchanged.
- Dashboard KPI tiles wrap 2-up on a phone and 3-across on a tablet, mirroring
  web's `grid-cols-2 lg:grid-cols-4`.

---

## Platform transformations (intentional, not drift)

| Web                | Mobile                              | Why                                                   |
| ------------------ | ----------------------------------- | ----------------------------------------------------- |
| Sidebar (224px)    | Bottom tab bar + More               | No room for a persistent sidebar                      |
| DataTable          | Card list                           | 6+ columns unreadable at 390pt                        |
| Dialog             | Bottom sheet                        | Reachability                                          |
| Hover              | Pressed state                       | No pointer                                            |
| Right-click        | Long press                          | No secondary button                                   |
| Checkbox column    | Long-press selection                | Column costs row space                                |
| Date-range popover | Action sheet over `COMPACT_PRESETS` | Same presets resolve through the same `presetRange()` |

Each keeps the same fields, order, labels, statuses and actions. What changes is
the container, never the information.

---

## Fixed as a result of this audit

1. **Card radius** — mobile `MobileCard` was `lg` (16px) against web's
   `rounded-2xl` (24px). Every mobile card was visibly squarer than the same
   card in the browser, and since almost every mobile screen is a list of these,
   it was the most repeated geometry difference in the product. Fixed at the
   primitive; the stale `// Cards sit at lg (16px)` comment in
   `mobile-ui/tokens/layout.ts` was corrected with it.

2. **Breakpoints** — mobile had none. Any width above a phone rendered the phone
   layout stretched. Now on the web scale.

3. **Screen headers** — three destinations had two names each («موجودی»/«انبار»,
   «خریدارها»/«مشتریان», «پول و سود»/«حسابداری»). `NavScreenHeader` titles from
   the navigation contract; a test enforces it.

4. **Date-range presets** — `presetRange()` moved to `@hisabche/ui-contract`, so
   "7 days" resolves to the same seven days on every platform instead of web
   owning the arithmetic.
