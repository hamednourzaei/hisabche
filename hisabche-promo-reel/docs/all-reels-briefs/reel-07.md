# Reel 07 — موجودی سیستم با قفسه فرق دارد

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

موجودی سیستم با قفسه فرق دارد

### Hook

اگر عدد سیستم با قفسه فرق داشته باشد، تصمیم خرید و فروش سخت می‌شود.

### Business Problem

اگر عدد سیستم با قفسه فرق داشته باشد، تصمیم خرید و فروش سخت می‌شود.

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 07                               |
| Duration      | 50s                              |
| FPS           | 30                               |
| Scene count   | 5                                |
| Theme         | obsidian-cinematic               |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | true (Fixed 1.0x Scale)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–5s): «اگر عدد سیستم با قفسه فرق داشته باشد، تصمیم خرید و فروش سخت می‌شود.»

Scene 2 (5s–13s): «حدس‌زدن کافی نیست؛ باید اختلاف را بررسی و ثبت کنی.»

Scene 3 (13s–27s): «اگر چند انبار داری، موجودی را در محل درستش پیگیری کن.»

Scene 4 (27s–39s): «شمارش فیزیکی را با عدد ثبت‌شده مقایسه کن و اصلاح را طبق روال مجاز انجام بده.»

Scene 5 (39s–50s): «اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».»

### On-screen Text

Scene 1:

- عنوان: سیستم: [c:۲۰ عدد] / قفسه: [r:۱۰ عدد]
- مقایسه: [چپ: عدد در سیستم (۲۰ واحد)] در برابر [راست: موجودی قفسه مغازه (۱۰ واحد)]
- نتیجه: مغایرت موجودی یعنی تصمیم اشتباه در خرید و فروش

Scene 2:

- عنوان: اختلاف را [c:پیدا و مستند] کن
- هدر: مسیر بررسی - اقدام انبارداری
- ردیف‌ها: شمارش فیزیکی دوره‌ای کالاها | کنترل حواله‌های خروج ثبت‌نشده | ثبت صریح ضایعات و شکستگی بار

Scene 3:

- عنوان: موجودی به تفکیک انبار
- نمایشگر: کاردکس تفکیکی انبارها | مجموع موجودی واقعی | ۱۶۰ کیسه

Scene 4:

- عنوان: شمارش و بررسی اختلاف
- ستون‌ها:

Scene 5:

- تگ‌لاین: حسابچه | نرم‌افزار مالی ابری، با اپ آفلاین
- باکس‌ها: اگر می‌خواهید همین الان رایگان شروع کنید… [رایگان] | اگر لینک دانلود اپ و مشاوره می‌خواهید… [حسابچه]

### CTA

اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».

## 4. Timeline

### Scene 01 — سیستم: [c:۲۰ عدد] / قفسه: [r:۱۰ عدد]

**Time:** 0.00s – 5.00s (5s, Frames 0–150)

**Voiceover**
اگر عدد سیستم با قفسه فرق داشته باشد، تصمیم خرید و فروش سخت می‌شود.

**On-screen text**

- Title: سیستم: [c:۲۰ عدد] / قفسه: [r:۱۰ عدد]

**Visuals**

- Spec Kind: `versus`
- Metaphor: `rising-chart`
- Theme: `obsidian-cinematic`

**Motion**

- Primary Motion: `chart-rise`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 4.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.70s / +0.70s] Sound: `tick`
- [t=1.20s / +1.20s] Sound: `alert`
- [t=2.00s / +2.00s] Sound: `impact`

**Source**

- Reel definition: `src/reels/reels-02-10.ts`

### Scene 02 — اختلاف را [c:پیدا و مستند] کن

**Time:** 5.00s – 13.00s (8s, Frames 150–390)

**Voiceover**
حدس‌زدن کافی نیست؛ باید اختلاف را بررسی و ثبت کنی.

**On-screen text**

- Title: اختلاف را [c:پیدا و مستند] کن
- Row: شمارش فیزیکی دوره‌ای کالاها
- Row: کنترل حواله‌های خروج ثبت‌نشده
- Row: ثبت صریح ضایعات و شکستگی بار

**Visuals**

- Spec Kind: `stagger`
- Metaphor: `warning-impact`
- Theme: `obsidian-cinematic`

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

- [t=5.00s / +0.00s] Sound: `whoosh`
- [t=5.25s / +0.25s] Sound: `impact`
- [t=6.00s / +1.00s] Sound: `tick`
- [t=6.80s / +1.80s] Sound: `tick`
- [t=7.60s / +2.60s] Sound: `tick`
- [t=8.50s / +3.50s] Sound: `success`

**Source**

- Reel definition: `src/reels/reels-02-10.ts`

### Scene 03 — موجودی به تفکیک انبار

**Time:** 13.00s – 27.00s (14s, Frames 390–810)

**Voiceover**
اگر چند انبار داری، موجودی را در محل درستش پیگیری کن.

**On-screen text**

- Title: موجودی به تفکیک انبار

**Visuals**

- Spec Kind: `mockup`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `obsidian-cinematic`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 13.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=13.40s / +0.40s] Sound: `whoosh`
- [t=14.00s / +1.00s] Sound: `scan`
- [t=14.20s / +1.20s] Sound: `tick`
- [t=14.45s / +1.45s] Sound: `tick`

**Source**

- Reel definition: `src/reels/reels-02-10.ts`

### Scene 04 — شمارش و بررسی اختلاف

**Time:** 27.00s – 39.00s (12s, Frames 810–1170)

**Voiceover**
شمارش فیزیکی را با عدد ثبت‌شده مقایسه کن و اصلاح را طبق روال مجاز انجام بده.

**On-screen text**

- Title: شمارش و بررسی اختلاف
- Row:
- Row:
- Row:

**Visuals**

- Spec Kind: `compare`
- Metaphor: `transformation`
- Theme: `obsidian-cinematic`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 11.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=27.40s / +0.40s] Sound: `whoosh`
- [t=28.10s / +1.10s] Sound: `tick`
- [t=28.90s / +1.90s] Sound: `tick`
- [t=29.70s / +2.70s] Sound: `tick`
- [t=30.70s / +3.70s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reels-02-10.ts`

### Scene 05 — Scene 5

**Time:** 39.00s – 50.00s (11s, Frames 1170–1500)

**Voiceover**
اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Spec Kind: `cta`
- Metaphor: `attention-ripple`
- Theme: `obsidian-cinematic`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 10.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=40.00s / +1.00s] Sound: `success`
- [t=44.20s / +5.20s] Sound: `pop`

**Source**

- Reel definition: `src/reels/reels-02-10.ts`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `asymmetrical-swiss-grid`
- Art Direction: `swiss-editorial`

### Colors

- Theme Palette: `obsidian-cinematic` tokens (solid, soft, glow)
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
| Scene 1 | chart-rise      | 0.0s–5.0s   | cubic-bezier / spring | src/reels/reels-02-10.ts |
| Scene 2 | impact-ripple   | 5.0s–13.0s  | cubic-bezier / spring | src/reels/reels-02-10.ts |
| Scene 3 | entrance-spring | 13.0s–27.0s | cubic-bezier / spring | src/reels/reels-02-10.ts |
| Scene 4 | value-transform | 27.0s–39.0s | cubic-bezier / spring | src/reels/reels-02-10.ts |
| Scene 5 | entrance-spring | 39.0s–50.0s | cubic-bezier / spring | src/reels/reels-02-10.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 3

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 20
- Sound Kinds: `alert`, `chime`, `impact`, `pop`, `scan`, `success`, `tick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».»
- Placement: Final Scene (39s–50s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `obsidian-cinematic`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reels-02-10.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reels-02-10.ts) (Lines 1–754)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)
- Test file: [`src/__tests__/motion-engine.test.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/__tests__/motion-engine.test.ts)
- Test file: [`src/__tests__/motion-plan-wiring.test.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/__tests__/motion-plan-wiring.test.ts)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Story matrix, Music mood

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-07/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
