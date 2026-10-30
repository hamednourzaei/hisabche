# Reel 11 — چک و قسط فراموش‌شده

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

چک و قسط فراموش‌شده

### Hook

چک دست مشتری بود و موعدش گذشت، یا سررسید قسطی که یادت رفت پیگیری کنی؟

### Business Problem

چک دست مشتری بود و موعدش گذشت، یا سررسید قسطی که یادت رفت پیگیری کنی؟

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 11                               |
| Duration      | 59s                              |
| FPS           | 30                               |
| Scene count   | 5                                |
| Theme         | dark-neon                        |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | true (Fixed 1.0x Scale)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–6s): «چک دست مشتری بود و موعدش گذشت، یا سررسید قسطی که یادت رفت پیگیری کنی؟»

Scene 2 (6s–14s): «وقتی موعد چک‌ها سردرگم باشه، کل برنامه‌ریزی مالی و خرید بار مغازه به خطر می‌افته.»

Scene 3 (14s–30s): «در حسابچه دفترچه اقساط مشتری ثانیه به ثانیه آپدیت میشه و با هر وصولی، مانده به صفر می‌رسه.»

Scene 4 (30s–44s): «حسابچه تقویم سررسید تمام چک‌ها و اقساط رو بهت نشون میده؛ از ثبت تا وصول و تأثیر آنی روی صندوق.»

Scene 5 (44s–59s): «اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».»

### On-screen Text

Scene 1:

- برچسب: مدیریت سررسید و اقساط
- خطوط: چک دست مشتری… / یا [r:سررسید قسط] که یادت رفت؟
- کارت‌ها: چک و اقساط (موعد وصول گذشت؟) | خالی بودن حساب (کسری نقدینگی)

Scene 2:

- عنوان: چک‌های [r:در راه] و تعهدات نقدی
- مقایسه: [چپ: چک پاس نشده (۳۵٬۰۰۰)] در برابر [راست: چک دریافتی این هفته (۵۰٬۰۰۰)]
- نتیجه: اگر به موقع یادآوری نشه، [r:نقدینگی قفل میشه]!

Scene 3:

- عنوان: دفترچه اقساط [c:حسابچه]
- خطوط: [object Object] / [object Object] / [object Object]

Scene 4:

- عنوان: در [c:حسابچه] هیچ سررسیدی پنهان نمی‌ماند
- هدر: چک و اقساط - ره‌گیری خودکار تا وصول
- ردیف‌ها: تقویم سررسید چک‌های دریافتی و پرداختی | دفترچه اقساط مشتری با آلارم هوشمند | وصول یا برگشت چک با ثبت خودکار در دفتر کل | پیش‌بینی نقدینگی صندوق در هفته آینده

Scene 5:

- تگ‌لاین: حسابچه | نرم‌افزار مالی ابری، با اپ آفلاین
- باکس‌ها: اگر می‌خواهید همین الان رایگان شروع کنید… [رایگان] | اگر لینک دانلود اپ و مشاوره می‌خواهید… [حسابچه]

### CTA

اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».

## 4. Timeline

### Scene 01 — مدیریت سررسید و اقساط

**Time:** 0.00s – 6.00s (6s, Frames 0–180)

**Voiceover**
چک دست مشتری بود و موعدش گذشت، یا سررسید قسطی که یادت رفت پیگیری کنی؟

**On-screen text**

- Label: مدیریت سررسید و اقساط
- Lines: چک دست مشتری… / یا [r:سررسید قسط] که یادت رفت؟
- Card [red]: چک و اقساط — موعد وصول گذشت؟
- Card [purple]: خالی بودن حساب — کسری نقدینگی

**Visuals**

- Spec Kind: `hook`
- Metaphor: `warning-impact`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 5.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `whoosh`
- [t=0.25s / +0.25s] Sound: `impact`
- [t=0.80s / +0.80s] Sound: `alert`
- [t=1.00s / +1.00s] Sound: `pop`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

### Scene 02 — چک‌های [r:در راه] و تعهدات نقدی

**Time:** 6.00s – 14.00s (8s, Frames 180–420)

**Voiceover**
وقتی موعد چک‌ها سردرگم باشه، کل برنامه‌ریزی مالی و خرید بار مغازه به خطر می‌افته.

**On-screen text**

- Title: چک‌های [r:در راه] و تعهدات نقدی

**Visuals**

- Spec Kind: `versus`
- Metaphor: `warning-impact`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 7.6s]

**Transition**

- Type: `glitch`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=6.25s / +0.25s] Sound: `impact`
- [t=6.70s / +0.70s] Sound: `alert`
- [t=7.20s / +1.20s] Sound: `tick`
- [t=8.00s / +2.00s] Sound: `impact`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

### Scene 03 — دفترچه اقساط [c:حسابچه]

**Time:** 14.00s – 30.00s (16s, Frames 420–900)

**Voiceover**
در حسابچه دفترچه اقساط مشتری ثانیه به ثانیه آپدیت میشه و با هر وصولی، مانده به صفر می‌رسه.

**On-screen text**

- Title: دفترچه اقساط [c:حسابچه]
- Lines: [object Object] / [object Object] / [object Object]

**Visuals**

- Spec Kind: `ledger`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 15.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=15.10s / +1.10s] Sound: `pop`
- [t=15.60s / +1.60s] Sound: `pop`
- [t=16.10s / +2.10s] Sound: `pop`
- [t=18.40s / +4.40s] Sound: `success`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

### Scene 04 — در [c:حسابچه] هیچ سررسیدی پنهان نمی‌ماند

**Time:** 30.00s – 44.00s (14s, Frames 900–1320)

**Voiceover**
حسابچه تقویم سررسید تمام چک‌ها و اقساط رو بهت نشون میده؛ از ثبت تا وصول و تأثیر آنی روی صندوق.

**On-screen text**

- Title: در [c:حسابچه] هیچ سررسیدی پنهان نمی‌ماند
- Row: تقویم سررسید چک‌های دریافتی و پرداختی
- Row: دفترچه اقساط مشتری با آلارم هوشمند
- Row: وصول یا برگشت چک با ثبت خودکار در دفتر کل
- Row: پیش‌بینی نقدینگی صندوق در هفته آینده

**Visuals**

- Spec Kind: `stagger`
- Metaphor: `transformation`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 13.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=30.00s / +0.00s] Sound: `whoosh`
- [t=31.00s / +1.00s] Sound: `tick`
- [t=32.10s / +2.10s] Sound: `tick`
- [t=33.20s / +3.20s] Sound: `tick`
- [t=34.30s / +4.30s] Sound: `tick`
- [t=35.50s / +5.50s] Sound: `success`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

### Scene 05 — Scene 5

**Time:** 44.00s – 59.00s (15s, Frames 1320–1770)

**Voiceover**
اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Spec Kind: `cta`
- Metaphor: `attention-ripple`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 14.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=45.00s / +1.00s] Sound: `success`
- [t=51.10s / +7.10s] Sound: `pop`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `split-screen-horizon`
- Art Direction: `cinematic-obsidian`

### Colors

- Theme Palette: `dark-neon` tokens (solid, soft, glow)
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
| Scene 1 | impact-ripple   | 0.0s–6.0s   | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 2 | impact-ripple   | 6.0s–14.0s  | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 3 | entrance-spring | 14.0s–30.0s | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 4 | value-transform | 30.0s–44.0s | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 5 | entrance-spring | 44.0s–59.0s | cubic-bezier / spring | src/reels/reels-11-20.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 2

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 20
- Sound Kinds: `alert`, `impact`, `pop`, `success`, `tick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».»
- Placement: Final Scene (44s–59s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `dark-neon`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reels-11-20.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reels-11-20.ts) (Lines 1–772)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Story matrix, Music mood

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-11/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
