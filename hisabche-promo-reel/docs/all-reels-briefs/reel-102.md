# Reel 102 — تراز نقدینگی و مدیریت چک‌های سررسید — خداحافظی با چک برگشتی

## Status

`VERIFIED_COMPLETE`

## 1. Topic & Hook

### Topic

کمبود نقدینگی در موعد پاس شدن چک‌ها به دلیل تاخیر در وصول نسیه‌ها

### Hook

دخلت شلوغه و فروشت هم بالاست؛ اما چرا موقع پاس کردن چک‌ها، حسابت خالیه؟

### Business Problem

کمبود نقدینگی در موعد پاس شدن چک‌ها به دلیل تاخیر در وصول نسیه‌ها

### Hisabche Capability

تقویم هوشمند نقدینگی و ارسال پیامک خودکار یادآور سررسید با لینک پرداخت

## 2. Reel Metadata

| Field         | Value                   |
| ------------- | ----------------------- |
| Reel ID       | 102                     |
| Duration      | 41.2s                   |
| FPS           | 30                      |
| Scene count   | 5                       |
| Theme         | swiss-editorial         |
| Music Mood    | uplifting               |
| Camera noZoom | true (Fixed 1.0x Scale) |
| Status        | VERIFIED_COMPLETE       |

## 3. Full Script

### Voiceover

Scene 1 (0s–7.2s): «دخلت شلوغه و فروشت هم بالاست؛ اما چرا موقع پاس کردن چک‌ها، حسابت خالیه؟»

Scene 2 (7.2s–14.4s): «چون نسیه‌ها توی بازار خوابیده، سررسیدها رو دستی نوشتی و وصول مطالبات از دستت در رفته!»

Scene 3 (14.4s–25.200000000000003s): «با تقویم نقدینگی «حسابچه»، سیستم سه روز قبل از سررسید پیامک یادآوری محترمانه به همراه لینک پرداخت برای مشتری می‌فرسته.»

Scene 4 (25.200000000000003s–34.6s): «قبل از اینکه موعد چکت برسه، پول به حسابت برگشته و خیالت از برگشت نخوردن چک‌ها راحته.»

Scene 5 (34.6s–41.2s): «همین الان کلمه «حسابچه» رو ارسال کن تا ماژول نقدینگی و چک‌ها رو رایگان تست کنی!»

### On-screen Text

NOT EXPLICITLY DEFINED IN SOURCE

### CTA

ارسال کلمه حسابچه برای تست رایگان ماژول چک و نقدینگی

## 4. Timeline

### Scene 01 — CashflowShockScene

**Time:** 0.00s – 7.20s (7.2s, Frames 0–216)

**Voiceover**
دخلت شلوغه و فروشت هم بالاست؛ اما چرا موقع پاس کردن چک‌ها، حسابت خالیه؟

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<CashflowShockScene />`
- Spec Kind: `bespoke`
- Metaphor: `rising-chart`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `chart-rise`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.8s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.10s / +0.10s] Sound: `alert`
- [t=1.20s / +1.20s] Sound: `tick`
- [t=3.20s / +3.20s] Sound: `titleHit`
- [t=5.80s / +5.80s] Sound: `whoosh`

**Source**

- Reel definition: `src/reels/reel-102-deal-rescue.ts`
- Scene component: `src/scenes/cashflow-cheques.tsx`

### Scene 02 — TrappedReceivablesScene

**Time:** 7.20s – 14.40s (7.2s, Frames 216–432)

**Voiceover**
چون نسیه‌ها توی بازار خوابیده، سررسیدها رو دستی نوشتی و وصول مطالبات از دستت در رفته!

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<TrappedReceivablesScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.8s]

**Transition**

- Type: `glitch`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=7.45s / +0.25s] Sound: `impact`
- [t=7.50s / +0.30s] Sound: `typewriterClick`
- [t=9.70s / +2.50s] Sound: `alert`
- [t=12.00s / +4.80s] Sound: `tick`
- [t=13.60s / +6.40s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-102-deal-rescue.ts`
- Scene component: `src/scenes/cashflow-cheques.tsx`

### Scene 03 — CashCalendarScene

**Time:** 14.40s – 25.20s (10.8s, Frames 432–756)

**Voiceover**
با تقویم نقدینگی «حسابچه»، سیستم سه روز قبل از سررسید پیامک یادآوری محترمانه به همراه لینک پرداخت برای مشتری می‌فرسته.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<CashCalendarScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 10.400000000000002s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=14.60s / +0.20s] Sound: `whoosh`
- [t=16.30s / +1.90s] Sound: `precisionSequence`
- [t=18.90s / +4.50s] Sound: `sync`
- [t=22.90s / +8.50s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-102-deal-rescue.ts`
- Scene component: `src/scenes/cashflow-cheques.tsx`

### Scene 04 — LiquidityForecastScene

**Time:** 25.20s – 34.60s (9.4s, Frames 756–1038)

**Voiceover**
قبل از اینکه موعد چکت برسه، پول به حسابت برگشته و خیالت از برگشت نخوردن چک‌ها راحته.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<LiquidityForecastScene />`
- Spec Kind: `bespoke`
- Metaphor: `transformation`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 8.999999999999998s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=25.60s / +0.40s] Sound: `cardEnter`
- [t=28.00s / +2.80s] Sound: `dataFlow`
- [t=31.70s / +6.50s] Sound: `cash`

**Source**

- Reel definition: `src/reels/reel-102-deal-rescue.ts`
- Scene component: `src/scenes/cashflow-cheques.tsx`

### Scene 05 — CashflowCtaScene

**Time:** 34.60s – 41.20s (6.6s, Frames 1038–1236)

**Voiceover**
همین الان کلمه «حسابچه» رو ارسال کن تا ماژول نقدینگی و چک‌ها رو رایگان تست کنی!

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<CashflowCtaScene />`
- Spec Kind: `bespoke`
- Metaphor: `attention-ripple`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.200000000000001s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=34.90s / +0.30s] Sound: `typewriterClick`
- [t=36.60s / +2.00s] Sound: `ctaResolution`
- [t=39.20s / +4.60s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-102-deal-rescue.ts`
- Scene component: `src/scenes/cashflow-cheques.tsx`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `split-screen-horizon`
- Art Direction: `swiss-editorial`

### Colors

- Theme Palette: `swiss-editorial` tokens (solid, soft, glow)
- Neon Cyan: `#22d3ee`
- Purple Glow: `#c084fc`
- Warning Crimson: `#fb7185`
- Emerald Mint: `#4ade80`

### Typography

- Vazirmatn / Dana (Persian Display Headlines & UI)
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- High-depth container-local cards with 1px glass border
- Sub-pixel telemetry indicators and status pills
- Real-time mathematical financial gauges and matrix grids

## 6. Motion Design

| Element                 | Animation       | Timing      | Easing                | Source                            |
| ----------------------- | --------------- | ----------- | --------------------- | --------------------------------- |
| CashflowShockScene      | chart-rise      | 0.0s–7.2s   | cubic-bezier / spring | src/reels/reel-102-deal-rescue.ts |
| TrappedReceivablesScene | impact-ripple   | 7.2s–14.4s  | cubic-bezier / spring | src/reels/reel-102-deal-rescue.ts |
| CashCalendarScene       | entrance-spring | 14.4s–25.2s | cubic-bezier / spring | src/reels/reel-102-deal-rescue.ts |
| LiquidityForecastScene  | value-transform | 25.2s–34.6s | cubic-bezier / spring | src/reels/reel-102-deal-rescue.ts |
| CashflowCtaScene        | entrance-spring | 34.6s–41.2s | cubic-bezier / spring | src/reels/reel-102-deal-rescue.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 3

## 8. Audio & Music

- Music Mood: `uplifting`
- Total Sound Cues: 19
- Sound Kinds: `alert`, `cardEnter`, `cash`, `chime`, `ctaResolution`, `dataFlow`, `impact`, `precisionSequence`, `softTransition`, `sync`, `tick`, `titleHit`, `typewriterClick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «ارسال کلمه حسابچه برای تست رایگان ماژول چک و نقدینگی»
- Placement: Final Scene (34.6s–41.2s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `swiss-editorial`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-102-deal-rescue.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-102-deal-rescue.ts) (Lines 1–125)
- Scene component: [`src/scenes/cashflow-cheques.tsx`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/scenes/cashflow-cheques.tsx) (Lines 1–1477)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Story matrix (pain, action, outcome), Music mood, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** None (All standard fields backed by source code)

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-102/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
