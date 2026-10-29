# Reel 64 — کوری بهای تمام‌شده کارگاه

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

فروش و تولید بالاست اما در پایان ماه دخل خالی است چون قیمت بر اساس حدس تعیین شده

### Hook

تولیدت رکورد زد؛ ولی چرا حسابت آخر ماه خالیه؟

### Business Problem

فروش و تولید بالاست اما در پایان ماه دخل خالی است چون قیمت بر اساس حدس تعیین شده

### Hisabche Capability

فرمول ساخت (BOM) حسابچه بهای چوب، اتصالات، دستمزد و ضایعات را خودکار تجمیع می‌کند

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 64                               |
| Duration      | 27s                              |
| FPS           | 30                               |
| Scene count   | 5                                |
| Theme         | swiss-editorial                  |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | false (Dynamic Push-in)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–3.8s): «تولیدت رکورد زد؛ ولی چرا حسابت آخر ماه خالیه؟»

Scene 2 (3.8s–9.2s): «چون قیمت فروش رو حسی بستی، نه با بهای تمام‌شده.»

Scene 3 (9.2s–15.6s): «چسب، یراق و ضایعات رو ندیدی؛ کارگاه با ضرر می‌فروخت!»

Scene 4 (15.6s–22s): «تو فرمول ساخت حسابچه، بهای هر قطعه دقیق محاسبه میشه.»

Scene 5 (22s–27s): «سود واقعی کارگاهت رو حساب کن؛ شروع رایگان در حسابچه.»

### On-screen Text

Scene 1:

- عنوان: تیراژ بالای کارگاه

Scene 2:

- عنوان: قیمت‌گذاری حسی

Scene 3:

- عنوان: شکست بهای تمام‌شده

Scene 4:

- عنوان: فرمول ساخت حسابچه

Scene 5:

- عنوان: دعوت به اقدام کارگاه

### CTA

شروع رایگان در hisabche.com

## 4. Timeline

### Scene 01 — تیراژ بالای کارگاه

**Time:** 0.00s – 3.80s (3.8s, Frames 0–114)

**Voiceover**
تولیدت رکورد زد؛ ولی چرا حسابت آخر ماه خالیه؟

**On-screen text**

- Title: تیراژ بالای کارگاه
- Word-sync words: تولیدت, رکورد, زد؛, ولی, چرا, حسابت, آخر, ماه, خالیه؟

**Visuals**

- Actor: `r64-hook`
- Spec Kind: `word-sync`
- Metaphor: `warning-impact`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.06 to 1.14 (pan: 1.2, -0.8)
- Readability Window: [1.14s, 3.4s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.20s / +0.20s] Sound: `impact`
- [t=0.25s / +0.25s] Sound: `impact`
- [t=2.13s / +2.13s] Sound: `cardEnter`

**Source**

- Reel definition: `src/reels/reel-64-cogs-blindspot.ts`

### Scene 02 — قیمت‌گذاری حسی

**Time:** 3.80s – 9.20s (5.4s, Frames 114–276)

**Voiceover**
چون قیمت فروش رو حسی بستی، نه با بهای تمام‌شده.

**On-screen text**

- Title: قیمت‌گذاری حسی
- Word-sync words: چون, قیمت, فروش, رو, حسی, بستی،, نه, با, بهای, تمام‌شده.

**Visuals**

- Actor: `r64-guess-leak`
- Spec Kind: `word-sync`
- Metaphor: `warning-impact`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.03 to 1.1 (pan: -1, 0.6)
- Readability Window: [1.4s, 4.999999999999999s]

**Transition**

- Type: `glitch`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=4.05s / +0.25s] Sound: `impact`
- [t=4.33s / +0.53s] Sound: `paperRustle`
- [t=6.83s / +3.03s] Sound: `whoosh`

**Source**

- Reel definition: `src/reels/reel-64-cogs-blindspot.ts`

### Scene 03 — شکست بهای تمام‌شده

**Time:** 9.20s – 15.60s (6.4s, Frames 276–468)

**Voiceover**
چسب، یراق و ضایعات رو ندیدی؛ کارگاه با ضرر می‌فروخت!

**On-screen text**

- Title: شکست بهای تمام‌شده
- Word-sync words: چسب،, یراق, و, ضایعات, رو, ندیدی؛, کارگاه, با, ضرر, می‌فروخت!

**Visuals**

- Actor: `r64-cogs-breakdown`
- Spec Kind: `word-sync`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.04 to 1.16 (pan: 1.4, -1)
- Readability Window: [1.4s, 6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=9.45s / +0.25s] Sound: `cardEnter`
- [t=12.63s / +3.43s] Sound: `alert`

**Source**

- Reel definition: `src/reels/reel-64-cogs-blindspot.ts`

### Scene 04 — فرمول ساخت حسابچه

**Time:** 15.60s – 22.00s (6.4s, Frames 468–660)

**Voiceover**
تو فرمول ساخت حسابچه، بهای هر قطعه دقیق محاسبه میشه.

**On-screen text**

- Title: فرمول ساخت حسابچه
- Word-sync words: تو, فرمول, ساخت, حسابچه،, بهای, هر, قطعه, دقیق, محاسبه, میشه.

**Visuals**

- Actor: `r64-bom-solution`
- Spec Kind: `word-sync`
- Metaphor: `warning-impact`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.02 to 1.12 (pan: 0, -1.2)
- Readability Window: [1.4s, 6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=15.85s / +0.25s] Sound: `impact`
- [t=16.03s / +0.43s] Sound: `sync`
- [t=18.53s / +2.93s] Sound: `success`

**Source**

- Reel definition: `src/reels/reel-64-cogs-blindspot.ts`

### Scene 05 — دعوت به اقدام کارگاه

**Time:** 22.00s – 27.00s (5s, Frames 660–810)

**Voiceover**
سود واقعی کارگاهت رو حساب کن؛ شروع رایگان در حسابچه.

**On-screen text**

- Title: دعوت به اقدام کارگاه
- Word-sync words: سود, واقعی, کارگاهت, رو, حساب, کن؛, شروع, رایگان, در, حسابچه.

**Visuals**

- Actor: `r64-cta`
- Spec Kind: `word-sync`
- Metaphor: `attention-ripple`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.03 to 1.08 (pan: 0, 0)
- Readability Window: [1.4s, 4.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=22.20s / +0.20s] Sound: `cardEnter`
- [t=24.70s / +2.70s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-64-cogs-blindspot.ts`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `single-focal-stage`
- Art Direction: `swiss-editorial`

### Colors

- Theme Palette: `swiss-editorial` tokens (solid, soft, glow)
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

| Element | Animation       | Timing      | Easing                | Source                              |
| ------- | --------------- | ----------- | --------------------- | ----------------------------------- |
| Scene 1 | impact-ripple   | 0.0s–3.8s   | cubic-bezier / spring | src/reels/reel-64-cogs-blindspot.ts |
| Scene 2 | impact-ripple   | 3.8s–9.2s   | cubic-bezier / spring | src/reels/reel-64-cogs-blindspot.ts |
| Scene 3 | entrance-spring | 9.2s–15.6s  | cubic-bezier / spring | src/reels/reel-64-cogs-blindspot.ts |
| Scene 4 | impact-ripple   | 15.6s–22.0s | cubic-bezier / spring | src/reels/reel-64-cogs-blindspot.ts |
| Scene 5 | entrance-spring | 22.0s–27.0s | cubic-bezier / spring | src/reels/reel-64-cogs-blindspot.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 1

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 13
- Sound Kinds: `alert`, `cardEnter`, `chime`, `impact`, `paperRustle`, `success`, `sync`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «شروع رایگان در hisabche.com»
- Placement: Final Scene (22s–27s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `swiss-editorial`
- Zoom Constraint: `noZoom: false` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-64-cogs-blindspot.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-64-cogs-blindspot.ts) (Lines 1–235)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)
- Test file: [`src/__tests__/motion-engine.test.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/__tests__/motion-engine.test.ts)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Story matrix (pain, action, outcome), Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Music mood

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-64/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
