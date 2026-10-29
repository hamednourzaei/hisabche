# Reel 23 — موجودی داری؛ اما آیا می‌دانی واقعاً چه داری؟

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

کارتن‌ها و اجناس در انبار چیده شده‌اند

### Hook

انبار پر از کالاست، قفسه‌ها چیده شده؛ اما آیا دقیقاً می‌دونی از هر کالا چقدر داری و پارت‌های خریدش با چه قیمتی بوده؟

### Business Problem

کارتن‌ها و اجناس در انبار چیده شده‌اند، اما انباردار و سیستم موجودی دقیق، محل قرارگیری و قیمت خرید هر پارت را نمی‌دانند.

### Hisabche Capability

کاردکس هوشمند چندانباره، ردیابی لات و بارکد کالا، صدور حواله انتقال داخلی.

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 23                               |
| Duration      | 59s                              |
| FPS           | 30                               |
| Scene count   | 5                                |
| Theme         | procedural-spatial               |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | false (Dynamic Push-in)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–7s): «انبار پر از کالاست، قفسه‌ها چیده شده؛ اما آیا دقیقاً می‌دونی از هر کالا چقدر داری و پارت‌های خریدش با چه قیمتی بوده؟»

Scene 2 (7s–25s): «کالا بین انبار مرکزی، فروشگاه و خودروهای توزیع حرکت می‌کنه. در حسابچه هر جابه‌جایی با حواله دوطرفه ثبت می‌شه تا یک بسته هم در مسیر گم نشه.»

Scene 3 (25s–39s): «دیگر نیازی به تماس تلفنی و شمارش چشمی نیست. با ثبت هر فاکتور فروش، کاردکس انبار در کسری از ثانیه کسر می‌گردد.»

Scene 4 (39s–51s): «موجودی فقط تعداد کالا نیست. یعنی بدانی چه داری، کجا داری و چه اتفاقی برایش افتاده.»

Scene 5 (51s–59s): «موجودی فقط تعداد کالا نیست. یعنی بدانی چه داری، کجا داری و چه اتفاقی برایش افتاده. حسابچه؛ موجودی را از حدس خارج کن.»

### On-screen Text

Scene 1:

- برچسب: معمای موجودی انبار
- خطوط: قفسه‌ها پر از کالاست؛ / اما دقیقاً [r:چه داری و کجاست؟]
- کارت‌ها: کارتن‌های انبار (موجودی فیزیکی در انبار چیده شده) | مغایرت دفاتر (قیمت خرید و تعداد دقیق نامشخص)

Scene 2:

- عنوان: ردیابی لحظه‌ای کالا بین [c:شعب و انبارها]

Scene 3:

- عنوان: مدیریت یکپارچه [g:موجودی تمام انبارها]

Scene 4:

- عنوان: انبارداری سنتی در برابر [c:شفافیت کاردکس حسابچه]
- ستون‌ها:

Scene 5:

- تگ‌لاین: حسابچه | موجودی را از حدس خارج کن
- باکس‌ها: موجودی فقط تعداد کالا نیست؛ یعنی بدانی چه داری… [انبار] | برای دریافت دموی رایگان سیستم انبارداری… [حسابچه]

### CTA

کامنت کنید: انبار | شروع رایگان در hisabche.com

## 4. Timeline

### Scene 01 — معمای موجودی انبار

**Time:** 0.00s – 7.00s (7s, Frames 0–210)

**Voiceover**
انبار پر از کالاست، قفسه‌ها چیده شده؛ اما آیا دقیقاً می‌دونی از هر کالا چقدر داری و پارت‌های خریدش با چه قیمتی بوده؟

**On-screen text**

- Label: معمای موجودی انبار
- Lines: قفسه‌ها پر از کالاست؛ / اما دقیقاً [r:چه داری و کجاست؟]
- Card [cyan]: کارتن‌های انبار — موجودی فیزیکی در انبار چیده شده
- Card [red]: مغایرت دفاتر — قیمت خرید و تعداد دقیق نامشخص

**Visuals**

- Spec Kind: `hook`
- Metaphor: `warning-impact`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.06 to 1.14 (pan: 1.2, -0.8)
- Readability Window: [1.4s, 6.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `whoosh`
- [t=0.25s / +0.25s] Sound: `impact`
- [t=0.80s / +0.80s] Sound: `pop`
- [t=1.00s / +1.00s] Sound: `alert`

**Source**

- Reel definition: `src/reels/customer-films.ts`

### Scene 02 — ردیابی لحظه‌ای کالا بین [c:شعب و انبارها]

**Time:** 7.00s – 25.00s (18s, Frames 210–750)

**Voiceover**
کالا بین انبار مرکزی، فروشگاه و خودروهای توزیع حرکت می‌کنه. در حسابچه هر جابه‌جایی با حواله دوطرفه ثبت می‌شه تا یک بسته هم در مسیر گم نشه.

**On-screen text**

- Title: ردیابی لحظه‌ای کالا بین [c:شعب و انبارها]

**Visuals**

- Spec Kind: `warehouse-movement-demo`
- Metaphor: `warning-impact`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.03 to 1.1 (pan: -1, 0.6)
- Readability Window: [1.4s, 17.6s]

**Transition**

- Type: `glitch`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=7.20s / +0.20s] Sound: `scan`
- [t=7.25s / +0.25s] Sound: `impact`
- [t=11.50s / +4.50s] Sound: `whoosh`
- [t=12.30s / +5.30s] Sound: `tick`
- [t=19.00s / +12.00s] Sound: `success`

**Source**

- Reel definition: `src/reels/customer-films.ts`

### Scene 03 — مدیریت یکپارچه [g:موجودی تمام انبارها]

**Time:** 25.00s – 39.00s (14s, Frames 750–1170)

**Voiceover**
دیگر نیازی به تماس تلفنی و شمارش چشمی نیست. با ثبت هر فاکتور فروش، کاردکس انبار در کسری از ثانیه کسر می‌گردد.

**On-screen text**

- Title: مدیریت یکپارچه [g:موجودی تمام انبارها]

**Visuals**

- Spec Kind: `hub`
- Metaphor: `warning-impact`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.02 to 1.07 (pan: -0.8, 0.5)
- Readability Window: [1.4s, 13.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=25.25s / +0.25s] Sound: `impact`
- [t=25.50s / +0.50s] Sound: `sync`
- [t=26.40s / +1.40s] Sound: `tick`
- [t=26.85s / +1.85s] Sound: `tick`
- [t=27.30s / +2.30s] Sound: `tick`
- [t=27.75s / +2.75s] Sound: `chime`

**Source**

- Reel definition: `src/reels/customer-films.ts`

### Scene 04 — انبارداری سنتی در برابر [c:شفافیت کاردکس حسابچه]

**Time:** 39.00s – 51.00s (12s, Frames 1170–1530)

**Voiceover**
موجودی فقط تعداد کالا نیست. یعنی بدانی چه داری، کجا داری و چه اتفاقی برایش افتاده.

**On-screen text**

- Title: انبارداری سنتی در برابر [c:شفافیت کاردکس حسابچه]
- Row:
- Row:
- Row:

**Visuals**

- Spec Kind: `compare`
- Metaphor: `transformation`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.02 to 1.12 (pan: 0, -1.2)
- Readability Window: [1.4s, 11.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=39.40s / +0.40s] Sound: `whoosh`
- [t=40.10s / +1.10s] Sound: `tick`
- [t=40.55s / +1.55s] Sound: `tick`
- [t=41.00s / +2.00s] Sound: `tick`
- [t=41.65s / +2.65s] Sound: `chime`

**Source**

- Reel definition: `src/reels/customer-films.ts`

### Scene 05 — Scene 5

**Time:** 51.00s – 59.00s (8s, Frames 1530–1770)

**Voiceover**
موجودی فقط تعداد کالا نیست. یعنی بدانی چه داری، کجا داری و چه اتفاقی برایش افتاده. حسابچه؛ موجودی را از حدس خارج کن.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Spec Kind: `cta`
- Metaphor: `attention-ripple`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.03 to 1.08 (pan: 0, 0)
- Readability Window: [1.4s, 7.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=52.00s / +1.00s] Sound: `success`
- [t=55.00s / +4.00s] Sound: `pop`

**Source**

- Reel definition: `src/reels/customer-films.ts`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `full-bleed-kinetic`
- Art Direction: `kinetic-manifesto`

### Colors

- Theme Palette: `procedural-spatial` tokens (solid, soft, glow)
- Neon Cyan: `#22d3ee`
- Purple Glow: `#c084fc`
- Warning Crimson: `#fb7185`
- Emerald Mint: `#4ade80`

### Typography

- Persian Display: Vazirmatn / Dana (font-weight: 700–900)
- Telemetry Numerals: JetBrains Mono / ui-monospace
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- Glass Bento Cards with neon glow borders
- Clean icon badges and comparison split columns

## 6. Motion Design

| Element | Animation       | Timing      | Easing                | Source                      |
| ------- | --------------- | ----------- | --------------------- | --------------------------- |
| Scene 1 | impact-ripple   | 0.0s–7.0s   | cubic-bezier / spring | src/reels/customer-films.ts |
| Scene 2 | impact-ripple   | 7.0s–25.0s  | cubic-bezier / spring | src/reels/customer-films.ts |
| Scene 3 | impact-ripple   | 25.0s–39.0s | cubic-bezier / spring | src/reels/customer-films.ts |
| Scene 4 | value-transform | 39.0s–51.0s | cubic-bezier / spring | src/reels/customer-films.ts |
| Scene 5 | entrance-spring | 51.0s–59.0s | cubic-bezier / spring | src/reels/customer-films.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 3

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 22
- Sound Kinds: `alert`, `chime`, `impact`, `pop`, `scan`, `success`, `sync`, `tick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «کامنت کنید: انبار | شروع رایگان در hisabche.com»
- Placement: Final Scene (51s–59s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `procedural-spatial`
- Zoom Constraint: `noZoom: false` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/customer-films.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/customer-films.ts) (Lines 1–690)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Story matrix (pain, action, outcome), Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Music mood

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-23/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
