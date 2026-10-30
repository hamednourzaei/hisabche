# Reel 16 — تخفیف دادی، ضرر کردی!

## Status

`NO_CUSTOM_SCENE`

## 1. Topic & Hook

### Topic

تخفیف دادی، ضرر کردی!

### Hook

برای اینکه مشتری رو راضی نگه داری تخفیف دادی، اما حساب کردی که بعد از کسر هزینه‌ها چیزی برات موند یا نه؟

### Business Problem

برای اینکه مشتری رو راضی نگه داری تخفیف دادی، اما حساب کردی که بعد از کسر هزینه‌ها چیزی برات موند یا نه؟

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                            |
| ------------- | -------------------------------- |
| Reel ID       | 16                               |
| Duration      | 59s                              |
| FPS           | 30                               |
| Scene count   | 5                                |
| Theme         | dark-neon                        |
| Music Mood    | NOT EXPLICITLY DEFINED IN SOURCE |
| Camera noZoom | true (Fixed 1.0x Scale)          |
| Status        | NO_CUSTOM_SCENE                  |

## 3. Full Script

### Voiceover

Scene 1 (0s–6s): «برای اینکه مشتری رو راضی نگه داری تخفیف دادی، اما حساب کردی که بعد از کسر هزینه‌ها چیزی برات موند یا نه؟»

Scene 2 (6s–14s): «وقتی قیمت خرید کالاها با نوسان بالا میره، تخفیف‌های سنتی باعث میشن ناخواسته زیر قیمت خرید بفروشی.»

Scene 3 (14s–28s): «نمودار حسابچه دقیقاً نشون میده کدوم تخفیف سودت رو سوزونده و کدوم کالا بیشترین مارجین رو داره.»

Scene 4 (28s–44s): «سود کسب‌وکارت رو با تخفیف‌های بدون حساب نسوزون. با حسابچه با اطمینان بفروش.»

Scene 5 (44s–59s): «اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».»

### On-screen Text

Scene 1:

- برچسب: سود واقعی یا تخفیف پنهان؟
- خطوط: برای جلب مشتری تخفیف دادی… / اما حساب کردی [r:سودی هم موند]؟
- کارت‌ها: فروش ظاهری (عدد فاکتور بالا) | سود ناپدیدشده (تخفیف بیشتر از مارجین)

Scene 2:

- عنوان: یک فروش با [r:تخفیف اشتباه]
- مقایسه: [چپ: فروش با تخفیف (۹۵۰!)] در برابر [راست: بهای خرید کالا (۱٬۰۰۰)]
- نتیجه: هر دانه فروش یعنی [r:۵۰ تا ضرر خالص]!

Scene 3:

- عنوان: تحلیل حاشیه سود قبل و بعد از تخفیف

Scene 4:

- عنوان: حفاظت کامل از [g:سود کسب‌وکار]
- ستون‌ها:

Scene 5:

- تگ‌لاین: حسابچه | نرم‌افزار مالی ابری، با اپ آفلاین
- باکس‌ها: اگر می‌خواهید همین الان رایگان شروع کنید… [رایگان] | اگر لینک دانلود اپ و مشاوره می‌خواهید… [حسابچه]

### CTA

اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».

## 4. Timeline

### Scene 01 — سود واقعی یا تخفیف پنهان؟

**Time:** 0.00s – 6.00s (6s, Frames 0–180)

**Voiceover**
برای اینکه مشتری رو راضی نگه داری تخفیف دادی، اما حساب کردی که بعد از کسر هزینه‌ها چیزی برات موند یا نه؟

**On-screen text**

- Label: سود واقعی یا تخفیف پنهان؟
- Lines: برای جلب مشتری تخفیف دادی… / اما حساب کردی [r:سودی هم موند]؟
- Card [cyan]: فروش ظاهری — عدد فاکتور بالا
- Card [red]: سود ناپدیدشده — تخفیف بیشتر از مارجین

**Visuals**

- Spec Kind: `hook`
- Metaphor: `silent-leak`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `leak-drift`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 5.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `whoosh`
- [t=0.80s / +0.80s] Sound: `pop`
- [t=1.00s / +1.00s] Sound: `alert`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

### Scene 02 — یک فروش با [r:تخفیف اشتباه]

**Time:** 6.00s – 14.00s (8s, Frames 180–420)

**Voiceover**
وقتی قیمت خرید کالاها با نوسان بالا میره، تخفیف‌های سنتی باعث میشن ناخواسته زیر قیمت خرید بفروشی.

**On-screen text**

- Title: یک فروش با [r:تخفیف اشتباه]

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

### Scene 03 — تحلیل حاشیه سود قبل و بعد از تخفیف

**Time:** 14.00s – 28.00s (14s, Frames 420–840)

**Voiceover**
نمودار حسابچه دقیقاً نشون میده کدوم تخفیف سودت رو سوزونده و کدوم کالا بیشترین مارجین رو داره.

**On-screen text**

- Title: تحلیل حاشیه سود قبل و بعد از تخفیف

**Visuals**

- Spec Kind: `chart`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `dark-neon`

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

- [t=14.30s / +0.30s] Sound: `whoosh`
- [t=14.50s / +0.50s] Sound: `tick`
- [t=14.75s / +0.75s] Sound: `tick`
- [t=15.20s / +1.20s] Sound: `sync`
- [t=16.80s / +2.80s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reels-11-20.ts`

### Scene 04 — حفاظت کامل از [g:سود کسب‌وکار]

**Time:** 28.00s – 44.00s (16s, Frames 840–1320)

**Voiceover**
سود کسب‌وکارت رو با تخفیف‌های بدون حساب نسوزون. با حسابچه با اطمینان بفروش.

**On-screen text**

- Title: حفاظت کامل از [g:سود کسب‌وکار]
- Row:
- Row:
- Row:
- Row:

**Visuals**

- Spec Kind: `compare`
- Metaphor: `transformation`
- Theme: `dark-neon`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 15.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=28.40s / +0.40s] Sound: `whoosh`
- [t=29.10s / +1.10s] Sound: `tick`
- [t=29.90s / +1.90s] Sound: `tick`
- [t=30.70s / +2.70s] Sound: `tick`
- [t=31.50s / +3.50s] Sound: `tick`
- [t=32.50s / +4.50s] Sound: `chime`

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
| Scene 1 | leak-drift      | 0.0s–6.0s   | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 2 | impact-ripple   | 6.0s–14.0s  | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 3 | entrance-spring | 14.0s–28.0s | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 4 | value-transform | 28.0s–44.0s | cubic-bezier / spring | src/reels/reels-11-20.ts |
| Scene 5 | entrance-spring | 44.0s–59.0s | cubic-bezier / spring | src/reels/reels-11-20.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 3

## 8. Audio & Music

- Music Mood: `NOT EXPLICITLY DEFINED IN SOURCE`
- Total Sound Cues: 20
- Sound Kinds: `alert`, `chime`, `impact`, `pop`, `success`, `sync`, `tick`, `whoosh`
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

- Visual QA verified: captured in `.tmp/visual-qa/reel-16/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
