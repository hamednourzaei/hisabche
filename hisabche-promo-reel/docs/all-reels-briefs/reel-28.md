# Reel 28 — دو مغازه، یک صاحب؛ مدیریت چند شعبه بدون مغایرت

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

داشتن ۲ یا چند فروشگاه و بی‌خبری از موجودی و دخل شعب دیگر؛ از دست دادن مشتری به خاطر عدم اطلاع از کالای شعبه کناری.

### Hook

مشتری تو شعبه ۱ جنس می‌خواد؛ فروشنده می‌گه تموم کردیم! در حالی که همون کالا تو شعبه ۲ داره خاک می‌خوره!

### Business Problem

داشتن ۲ یا چند فروشگاه و بی‌خبری از موجودی و دخل شعب دیگر؛ از دست دادن مشتری به خاطر عدم اطلاع از کالای شعبه کناری.

### Hisabche Capability

تعریف چند شعبه و چند انبار در یک حساب کاربری با دسترسی مستقل برای هر فروشنده و دید متمرکز برای مالک.

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 28                               |
| Duration      | 59s                              |
| FPS           | 30                               |
| Scene count   | 5                                |
| Theme         | procedural-spatial               |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | false (Dynamic Push-in)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–7s): «مشتری تو شعبه ۱ جنس می‌خواد؛ فروشنده می‌گه تموم کردیم! در حالی که همون کالا تو شعبه ۲ داره خاک می‌خوره!»

Scene 2 (7s–25s): «در حسابچه، موجودی تمام شعب پای صندوق جلوی چشمته. با یک کلیک حواله انتقال داخلی صادر می‌شه و کالا بدون کسری جابه‌جا می‌گردد.»

Scene 3 (25s–39s): «دیگر نیازی به تماس تلفنی و عکس فرستادن از فاکتور نیست. دخل، انبار و طلب‌های هر دو مغازه همزمان در جیب شماست.»

Scene 4 (39s–51s): «سرعت گردش کالاهات رو دو برابر کن و جلوی خریدهای اشتباه و خواب سرمایه در شعب رو بگیر.»

Scene 5 (51s–59s): «چند مغازه رو مثل یک فروشگاه منسجم مدیریت کن. همین حالا حسابچه رو رایگان شروع کن.»

### On-screen Text

Scene 1:

- برچسب: معمای موجودی شعب
- خطوط: مشتری کالا را می‌خواهد، / شعبه ۱ می‌گوید: [r:موجود نداریم!]
- کارت‌ها: شعبه بازار (قفسه خالی، مشتری از دست رفت) | شعبه مرکزی (کارتن‌ها در انبار خاک می‌خورند)

Scene 2:

- عنوان: انتقال کالا بین [c:شعب و انبارها] بدون مغایرت

Scene 3:

- عنوان: مدیریت متمرکز [g:تمام فروشگاه‌ها] در یک پنل

Scene 4:

- عنوان: روش سنتی در برابر [c:همگام‌سازی ابری حسابچه]
- ستون‌ها:

Scene 5:

- تگ‌لاین: حسابچه | اتصال هوشمند تمام شعب و انبارها
- باکس‌ها: برای اتصال شعب و مدیریت متمرکز… [شعبه] | برای دریافت دموی رایگان چند شعبه… [حسابچه]

### CTA

کامنت کنید: شعبه | شروع رایگان در hisabche.com

## 4. Timeline

### Scene 01 — معمای موجودی شعب

**Time:** 0.00s – 7.00s (7s, Frames 0–210)

**Voiceover**
مشتری تو شعبه ۱ جنس می‌خواد؛ فروشنده می‌گه تموم کردیم! در حالی که همون کالا تو شعبه ۲ داره خاک می‌خوره!

**On-screen text**

- Label: معمای موجودی شعب
- Lines: مشتری کالا را می‌خواهد، / شعبه ۱ می‌گوید: [r:موجود نداریم!]
- Card [red]: شعبه بازار — قفسه خالی، مشتری از دست رفت
- Card [purple]: شعبه مرکزی — کارتن‌ها در انبار خاک می‌خورند

**Visuals**

- Spec Kind: `hook`
- Metaphor: `rising-chart`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `chart-rise`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.06 to 1.14 (pan: 1.2, -0.8)
- Readability Window: [1.4s, 6.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `whoosh`
- [t=0.80s / +0.80s] Sound: `alert`
- [t=1.00s / +1.00s] Sound: `pop`

**Source**

- Reel definition: `src/reels/reels-26-30.ts`

### Scene 02 — انتقال کالا بین [c:شعب و انبارها] بدون مغایرت

**Time:** 7.00s – 25.00s (18s, Frames 210–750)

**Voiceover**
در حسابچه، موجودی تمام شعب پای صندوق جلوی چشمته. با یک کلیک حواله انتقال داخلی صادر می‌شه و کالا بدون کسری جابه‌جا می‌گردد.

**On-screen text**

- Title: انتقال کالا بین [c:شعب و انبارها] بدون مغایرت

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

- Reel definition: `src/reels/reels-26-30.ts`

### Scene 03 — مدیریت متمرکز [g:تمام فروشگاه‌ها] در یک پنل

**Time:** 25.00s – 39.00s (14s, Frames 750–1170)

**Voiceover**
دیگر نیازی به تماس تلفنی و عکس فرستادن از فاکتور نیست. دخل، انبار و طلب‌های هر دو مغازه همزمان در جیب شماست.

**On-screen text**

- Title: مدیریت متمرکز [g:تمام فروشگاه‌ها] در یک پنل

**Visuals**

- Spec Kind: `hub`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.02 to 1.07 (pan: -0.8, 0.5)
- Readability Window: [1.4s, 13.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=25.50s / +0.50s] Sound: `sync`
- [t=26.40s / +1.40s] Sound: `tick`
- [t=26.85s / +1.85s] Sound: `tick`
- [t=27.30s / +2.30s] Sound: `tick`
- [t=27.75s / +2.75s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reels-26-30.ts`

### Scene 04 — روش سنتی در برابر [c:همگام‌سازی ابری حسابچه]

**Time:** 39.00s – 51.00s (12s, Frames 1170–1530)

**Voiceover**
سرعت گردش کالاهات رو دو برابر کن و جلوی خریدهای اشتباه و خواب سرمایه در شعب رو بگیر.

**On-screen text**

- Title: روش سنتی در برابر [c:همگام‌سازی ابری حسابچه]
- Row:
- Row:
- Row:

**Visuals**

- Spec Kind: `compare`
- Metaphor: `warning-impact`
- Theme: `procedural-spatial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.02 to 1.12 (pan: 0, -1.2)
- Readability Window: [1.4s, 11.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=39.25s / +0.25s] Sound: `impact`
- [t=39.40s / +0.40s] Sound: `whoosh`
- [t=40.10s / +1.10s] Sound: `tick`
- [t=40.55s / +1.55s] Sound: `tick`
- [t=41.00s / +2.00s] Sound: `tick`
- [t=41.65s / +2.65s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reels-26-30.ts`

### Scene 05 — Scene 5

**Time:** 51.00s – 59.00s (8s, Frames 1530–1770)

**Voiceover**
چند مغازه رو مثل یک فروشگاه منسجم مدیریت کن. همین حالا حسابچه رو رایگان شروع کن.

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

- Reel definition: `src/reels/reels-26-30.ts`

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

| Element | Animation       | Timing      | Easing                | Source                   |
| ------- | --------------- | ----------- | --------------------- | ------------------------ |
| Scene 1 | chart-rise      | 0.0s–7.0s   | cubic-bezier / spring | src/reels/reels-26-30.ts |
| Scene 2 | impact-ripple   | 7.0s–25.0s  | cubic-bezier / spring | src/reels/reels-26-30.ts |
| Scene 3 | entrance-spring | 25.0s–39.0s | cubic-bezier / spring | src/reels/reels-26-30.ts |
| Scene 4 | impact-ripple   | 39.0s–51.0s | cubic-bezier / spring | src/reels/reels-26-30.ts |
| Scene 5 | entrance-spring | 51.0s–59.0s | cubic-bezier / spring | src/reels/reels-26-30.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 3

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 21
- Sound Kinds: `alert`, `chime`, `impact`, `pop`, `scan`, `success`, `sync`, `tick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «کامنت کنید: شعبه | شروع رایگان در hisabche.com»
- Placement: Final Scene (51s–59s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `procedural-spatial`
- Zoom Constraint: `noZoom: false` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reels-26-30.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reels-26-30.ts) (Lines 1–657)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Story matrix (pain, action, outcome), Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Music mood

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-28/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
