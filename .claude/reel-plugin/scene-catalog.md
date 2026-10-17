# Hisabche Promo Reel — Complete Scene Engine Catalog
> **Path:** `.claude/reel-plugin/scene-catalog.md`  
> **Source of Truth:** `src/engine/types.ts` & `src/scenes/index.tsx`

Every scene in `reel.scenes` has a `spec: SceneSpec`. This document details the exact, verified contract for every supported `spec.kind`.

---

## 1. Core Story & Information Scene Engines

### `hook`
- **Purpose:** High-tension opening scene (0.0s to 3.5s) to arrest audience attention in 9:16 feeds.
- **Required props:** `lines: string[]`
- **Optional props:** `theme?: ThemeName`, `openingArchetype?: OpeningArchetype`, `label?: string`, `cards?: IconCard[]`, `consequence?: { alertBanner: string, stoppedAction: string, lossMetric?: string }`, `discovery?: { surfaceMetric: { label: string, value: string }, hiddenReality: { label: string, value: string }, discrepancyNote: string }`, `confrontation?: { speaker: string, dialogue: string, fadedEvidence: string }`, `interrupt?: { colossalHeadline: string, subHeadline?: string, shatteredTool: string }`, `quietDread?: { isolatedFact: string, unsettlingDetail: string, heartbeatBpm?: number }`, `deadline?: { targetTime: string, countdownLabel: string, unresolvedGap: string }`
- **Archetype Options:**
  1. `immediate-consequence`: Disruption stops operations cold.
  2. `uncomfortable-discovery`: Surface metric clashes with bank reality.
  3. `customer-confrontation`: Direct quote from angry buyer/supplier.
  4. `visual-pattern-interrupt`: Colossal headline shattering outdated tool.
  5. `quiet-dread`: Isolated ominous business fact in the dead of night.
  6. `deadline-pressure`: Digital clock counting down to bank clearing.
- **Example:**
```ts
{
  kind: 'hook',
  theme: 'financial-intelligence',
  openingArchetype: 'deadline-pressure',
  lines: ['ساعت ۱۲ ظهر چکت برگشت می‌خوره!'],
  deadline: { targetTime: '۱۲:۰۰:۰۰', countdownLabel: 'زمان تا موعد صیاد', unresolvedGap: 'کسری ۵۹۸٫۶ میلیون' }
}
```

---

### `branch`
- **Purpose:** A fork in the road / binary choice exposing the pain of traditional methods vs the elegance of Hisabche.
- **Required props:** `cards: [IconCard, IconCard]`, `question: string`, `answer: string`, `badge: string`
- **Optional props:** `theme?: ThemeName`
- **Timing behavior:** Question appears at `t=0.2s`, Left card lands at `0.8s`, Right card lands at `1.6s`, Badge pulses at `2.4s`.
- **Example:**
```ts
{
  kind: 'branch',
  theme: 'dark-neon',
  question: 'حساب‌وکتاب فروشگاهت چطوریه؟',
  cards: [
    { icon: 'book', title: 'دفتر سنتی کاغذی', sub: 'خط‌خوردگی، گم شدن حساب، فراموشی طلب‌ها', tone: 'red' },
    { icon: 'cloud', title: 'سیستم ابری حسابچه', sub: 'پیامک خودکار به بدهکاران، راس‌گیری آنی', tone: 'cyan' }
  ],
  answer: 'انتخاب با توئه: استرس هر روزه یا آرامش خاطر؟',
  badge: 'سامانه ابری حسابچه'
}
```

---

### `stagger`
- **Purpose:** Sequential waterfall drop of pain points, operational leaks, or audit violations.
- **Required props:** `title: string`, `header: [string, string]`, `rows: { icon: string, text: string }[]`
- **Optional props:** `theme?: ThemeName`, `interval?: number` (default: 0.7s), `tone?: Tone`
- **Timing behavior:** Header lands at `t=0.2s`. Rows slide down sequentially at `0.2s + idx * interval`.
- **Example:**
```ts
{
  kind: 'stagger',
  theme: 'cinematic-obsidian',
  title: 'سرمایه‌ای که بی‌صدا دود می‌شود:',
  header: ['محل نشت نقدینگی', 'میزان آسیب به کسب‌وکار'],
  rows: [
    { icon: 'receipt', text: 'فاکتورهای نسیه دستی بدون سررسید' },
    { icon: 'boxes', text: 'اجناس راکد قفسه که خاک می‌خورند' },
    { icon: 'bank', text: 'کسری ناگهانی حساب در موعد پاس شدن چک' }
  ]
}
```

---

### `hub`
- **Purpose:** Centralized ecosystem architecture showing fragmented business operations locking into Hisabche.
- **Required props:** `title: string`, `core: string`, `coreSub: string`, `nodes: { icon: string, label: string }[]`
- **Optional props:** `theme?: ThemeName`
- **Timing behavior:** Core logo pulses in center; satellite nodes spiral in radially with neon connection lines.
- **Example:**
```ts
{
  kind: 'hub',
  theme: 'procedural-spatial',
  title: 'تمام ارکان بازار در یک داشبورد زنده',
  core: 'حسابچه',
  coreSub: 'هسته مالی و انبارداری',
  nodes: [
    { icon: 'bank', label: 'بانک و چک' },
    { icon: 'users', label: 'طرف حساب‌ها' },
    { icon: 'boxes', label: 'انبار و موجودی' },
    { icon: 'smartphone', label: 'پوز و فاکتور' }
  ]
}
```

---

### `compare`
- **Purpose:** 4-column definitive matrix proof (Feature | Excel | Legacy Software | Hisabche).
- **Required props:** `title: string`, `columns: [string, string, string, string]`, `rows: { label: string, marks: [Mark, Mark, Mark] }[]`
  *(Mark = `'yes'` | `'no'` | `'part'`)*
- **Optional props:** `theme?: ThemeName`, `interval?: number`
- **Timing behavior:** Header fixed; comparison rows slide in with check/cross marks glowing cyan for Hisabche.
- **Example:**
```ts
{
  kind: 'compare',
  theme: 'swiss-editorial',
  title: 'مقایسه شفاف راهکارهای حسابداری بازار',
  columns: ['ویژگی کلیدی', 'اکسل', 'سیستم سنتی', 'حسابچه'],
  rows: [
    { label: 'کارکرد بدون اینترنت (آفلاین)', marks: ['no', 'part', 'yes'] },
    { label: 'راس‌گیری خودکار چک و فاکتور', marks: ['no', 'no', 'yes'] },
    { label: 'ارسال خودکار پیامک یادآوری', marks: ['no', 'no', 'yes'] }
  ]
}
```

---

### `bridge`
- **Purpose:** Shows two disconnected worlds (e.g. Sales Counter vs Backoffice Warehouse) merging into one.
- **Required props:** `title: string`, `left: IconCard`, `right: IconCard`, `merged: string`, `caption: string`, `summaries: [Summary, Summary]`
- **Optional props:** `theme?: ThemeName`
- **Example:**
```ts
{
  kind: 'bridge',
  theme: 'dark-neon',
  title: 'پایان چنددستگی در مدیریت دخل و خرج',
  left: { icon: 'store', title: 'فروشگاه و دخل', sub: 'فاکتورهای صادرشده روزانه', tone: 'cyan' },
  right: { icon: 'bank', title: 'بانک و چک‌ها', sub: 'سررسید اسناد تجاری', tone: 'purple' },
  merged: 'سامانه یکپارچه حسابچه',
  caption: 'هر فاکتور در همان لحظه در بانک و انبار می‌نشیند.',
  summaries: [
    { question: 'بدون حسابچه؟', answer: 'مغایرت دائمی حساب‌ها', tone: 'red', icons: ['receipt', 'trash'] },
    { question: 'با حسابچه؟', answer: 'تطبیق خودکار و آنی اسناد', tone: 'green', icons: ['check', 'sparkles'] }
  ]
}
```

---

### `cta`
- **Purpose:** High-conversion finale with dual action cards and Google search prompt.
- **Required props:** `tagline: string`, `boxes: [CtaBox, CtaBox]`, `switchAt: number`
- **Optional props:** `theme?: ThemeName`
- **Timing behavior:** Box 1 shows immediate business resolution; at `switchAt` (e.g. 2.2s), flips to Box 2 featuring `hisabche.com` and search keyword.
- **Example:**
```ts
{
  kind: 'cta',
  theme: 'cyber-emerald',
  tagline: 'همین امروز بی‌نظمی مالی را تمام کن',
  switchAt: 2.2,
  boxes: [
    { lead: 'کنترل کامل نسیه‌ها و چک‌های صیاد', action: 'شروع رایگان بدون نیاز به نصب', word: 'حسابچه', tone: 'cyan' },
    { lead: 'در مرورگر سرچ کن:', action: 'ورود آنی در: hisabche.com', word: 'حسابچه', tone: 'green' }
  ]
}
```

---

### `pile`
- **Purpose:** Stacking mountain of chaotic physical papers/receipts compressing into a single unified record.
- **Required props:** `title: string`, `papers: { icon: string, label: string }[]`, `counter: string`, `merge: string`
- **Optional props:** `theme?: ThemeName`

### `versus`
- **Purpose:** High-contrast clash of metrics (e.g. 430M Trapped Receivables vs 1.4M Cash in Hand).
- **Required props:** `title: string`, `left: { label: string, value: string, tone: Tone }`, `right: { label: string, value: string, tone: Tone }`, `verdict: string`
- **Optional props:** `theme?: ThemeName`

### `ledger`
- **Purpose:** Detailed merchant customer statement with dynamic balance updates.
- **Required props:** `title: string`, `name: string`, `lines: { label: string, amount: string }[]`, `balanceFrom: number`, `balanceTo: number`, `unit: string`, `footer: string`
- **Optional props:** `theme?: ThemeName`

### `queue`
- **Purpose:** Demonstrates offline resilient POS operations. Transactions queue up offline, then sync instantly upon reconnect.
- **Required props:** `title: string`, `offlineLabel: string`, `items: string[]`, `syncedLabel: string`, `reconnectAt: number`
- **Optional props:** `theme?: ThemeName`

### `day`
- **Purpose:** Day-in-the-life timeline of an exhausted shopkeeper from 08:00 morning opening to 22:00 closing.
- **Required props:** `title: string`, `moments: { time: string, icon: string, text: string }[]`
- **Optional props:** `theme?: ThemeName`, `interval?: number`

---

## 2. Modern Motion & Editorial Scene Engines

- **`kinetic`**: Bold typographic display cascades (`headline: string`, `words: string[]`, `sub?: string`, `tone?: Tone`).
- **`mockup`**: High-fidelity software UI simulation (`device: 'window' | 'phone'`, `screen: { type, header, items, totalLabel, totalValue }`, `toast?: { icon, text, time }`, `cursor?: { x, y, clickAt }`).
- **`chart`**: Neon SVG area/bar charts (`chartType: 'area' | 'bar'`, `kpis: [...]`, `data: [...]`).
- **`split`**: Clean 2-column comparative layout (`left: { title, points, tone }`, `right: { title, points, tone }`, `dividerLabel?: string`).
- **`cinematic-product`**: 2.5D exploded UI planes floating with z-axis parallax (`layers: { title, desc, icon, tone, z }[]`).
- **`kinetic-manifesto`**: Full-bleed typographic velocity statements (`headline: string[]`, `statements: string[]`).
- **`financial-intelligence`**: Real accounting math: Revenue minus COGS equals Real Profit (`revenue: number`, `cogs: number`, `grossProfit: number`, `verdict: string`).
- **`continuous-transform`**: Multi-phase sequential metamorphosis (`stages: { at: number, label: string, sub: string }[]`).
- **`daylight-editorial`**: High-craft Swiss editorial layout on #F7F6F2 alabaster canvas (`category: string`, `headline: string`, `points: { label, value }[]`, `quote?: string`).

---

## 3. Customer Conversion Interactive Demos

- **`offline-sync-demo`**: Live internet loss simulation; POS continues scanning with offline badge, flushes green at `reconnectAt`.
- **`fragmented-tools-demo`**: Excel icon, calculator, and physical notebook converge and fuse into Hisabche at `convergeAt`.
- **`profit-waterfall-demo`**: Financial waterfall breakdown subtracting buying cost and expenses from revenue.
- **`warehouse-movement-demo`**: Multi-branch stock movement with transit trucks and instant cardex adjustments.
- **`dual-perspective-demo`**: Split screen showing cash counter checkout instantly triggering double-entry journal lines.

---

## 4. Viral Short-Form Template Archetypes

1. **`tactile-train`**: Tactile paper train rolling horizontally across the screen.
2. **`thermal-receipt`**: Physical thermal paper printing out of a POS terminal with real accounting line items.
3. **`infinite-spatial`**: Deep 3D camera travel through layers of business analytics.
4. **`vox-documentary`**: Newspaper investigative clipping with yellow highlighter and document stamps.
5. **`minimal-vector`**: Clean line-art vector diagrams for conceptual clarity.
6. **`chat-panic`**: WhatsApp/Telegram customer message panic with rapid notification chimes.
7. **`liquid-glass`**: High-end glassmorphic refraction with iridescent blur boundaries.
8. **`kinetic-color`**: High-energy full-bleed background color shifts timed to punchy statements.
9. **`split-stopwatch`**: Top stopwatch vs bottom stopwatch timing manual chaos vs Hisabche speed.
10. **`isometric-exploded`**: 3D axonometric exploded hardware/software schematic.
11. **`continuous-line`**: A single continuous vector path that draws diagrams without breaking.
12. **`swiss-terminal`**: Clean monospace ASCII grid terminal with financial tickers.
13. **`premium-motion`**: Editorial SaaS presentation card with large metric numbers and contrast tags.

---

## 5. The Gold Standard: `word-sync` (WordDrivenStage)

```ts
{
  kind: 'word-sync',
  actor: 'cheque-countdown' | 'capital-trap' | 'overdue-cards' | 'sms-settlement' | 'cta-conversion-54' | 'hook-sales' | 'broken-chart' | 'leak-cards' | 'unified-dashboard' | 'cta-finish' | (string & {}),
  title?: string,
  sentencePlan?: SentencePlan
}
```
*Directly drives word-synchronized kinetic actors in `src/components/WordDrivenStage.tsx` where every single spoken Persian word moves the visual canvas.*
