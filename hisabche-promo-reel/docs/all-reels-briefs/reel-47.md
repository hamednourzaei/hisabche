# Reel 47 — حسابداری دقیق کسب‌وکار با حسابچه (نوار قطاری عمودی و کلاژ کاغذی)

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

سردرگمی در مدیریت فاکتور

### Hook

حسابداری دقیق کسب‌وکار با حسابچه، صفر ریال خطا و مغایرت بدون نیاز به دفتر کاغذی و اکسل‌های پیچیده. یه اصل مهم: دقیق بدون امروز پول و جنست کجاست! فقط یک فاکتور بزن، بقیه‌ش با حسابچه. راه‌اندازی در ۳ دقیقه، لینک شروع رایگان رو برات می‌فرستم، فالو کن و همین الان کامنت کن: حسابچه.

### Business Problem

سردرگمی در مدیریت فاکتور، انبار و نسیه در دفاتر کاغذی و اکسل‌های پیچیده

### Hisabche Capability

اتوماسیون کامل صدور فاکتور، کسر از کاردکس و ثبت سند دوطرفه در ۳ ثانیه

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 47                               |
| Duration      | 59s                              |
| FPS           | 30                               |
| Scene count   | 1                                |
| Theme         | swiss-editorial                  |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | false (Dynamic Push-in)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–59s): «حسابداری دقیق کسب‌وکار با حسابچه، صفر ریال خطا و مغایرت بدون نیاز به دفتر کاغذی و اکسل‌های پیچیده. یه اصل مهم: دقیق بدون امروز پول و جنست کجاست! فقط یک فاکتور بزن، بقیه‌ش با حسابچه. راه‌اندازی در ۳ دقیقه، لینک شروع رایگان رو برات می‌فرستم، فالو کن و همین الان کامنت کن: حسابچه.»

### On-screen Text

Scene 1:

- عنوان: حسابداری دقیق کسب‌وکار با Hisabche

### CTA

کامنت کن: حسابچه

## 4. Timeline

### Scene 01 — حسابداری دقیق کسب‌وکار با Hisabche

**Time:** 0.00s – 59.00s (59s, Frames 0–1770)

**Voiceover**
حسابداری دقیق کسب‌وکار با حسابچه، صفر ریال خطا و مغایرت بدون نیاز به دفتر کاغذی و اکسل‌های پیچیده. یه اصل مهم: دقیق بدون امروز پول و جنست کجاست! فقط یک فاکتور بزن، بقیه‌ش با حسابچه. راه‌اندازی در ۳ دقیقه، لینک شروع رایگان رو برات می‌فرستم، فالو کن و همین الان کامنت کن: حسابچه.

**On-screen text**

- Title: حسابداری دقیق کسب‌وکار با Hisabche

**Visuals**

- Spec Kind: `tactile-train`
- Metaphor: `warning-impact`
- Theme: `swiss-editorial`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1.02 to 1.09 (pan: 1, 0.8)
- Readability Window: [1.4s, 58.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.20s / +0.20s] Sound: `cameraSwish`
- [t=0.25s / +0.25s] Sound: `impact`
- [t=0.80s / +0.80s] Sound: `markerScribble`
- [t=1.40s / +1.40s] Sound: `paperTear`
- [t=2.20s / +2.20s] Sound: `cameraSwish`
- [t=3.50s / +3.50s] Sound: `clockTickRapid`

**Source**

- Reel definition: `src/reels/reel-47-tactile-train.ts`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `asymmetrical-swiss-grid`
- Art Direction: `procedural-spatial`

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

| Element | Animation     | Timing     | Easing                | Source                             |
| ------- | ------------- | ---------- | --------------------- | ---------------------------------- |
| Scene 1 | impact-ripple | 0.0s–59.0s | cubic-bezier / spring | src/reels/reel-47-tactile-train.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 0

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 6
- Sound Kinds: `cameraSwish`, `clockTickRapid`, `impact`, `markerScribble`, `paperTear`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «کامنت کن: حسابچه»
- Placement: Final Scene (0s–59s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `swiss-editorial`
- Zoom Constraint: `noZoom: false` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-47-tactile-train.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-47-tactile-train.ts) (Lines 1–53)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)
- Test file: [`src/__tests__/motion-engine.test.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/__tests__/motion-engine.test.ts)
- Test file: [`src/__tests__/tactile-templates.test.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/__tests__/tactile-templates.test.ts)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Story matrix (pain, action, outcome), Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Music mood

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-47/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
