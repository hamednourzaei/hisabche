# Reel 92 — میز نیمه‌شب — ساعت ۱۱ شب، حساب روشن در جیب

## Status

`VERIFIED_COMPLETE`

## 1. Topic & Hook

### Topic

میز نیمه‌شب — ساعت ۱۱ شب، حساب روشن در جیب

### Hook

ساعت یازده شب؛ برگه‌ها روی میز مانده‌اند و هنوز جمع دخل معلوم نیست.

### Business Problem

ساعت یازده شب؛ برگه‌ها روی میز مانده‌اند و هنوز جمع دخل معلوم نیست.

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                   |
| ------------- | ----------------------- |
| Reel ID       | 92                      |
| Duration      | 45s                     |
| FPS           | 30                      |
| Scene count   | 6                       |
| Theme         | midnight-desk           |
| Music Mood    | calm                    |
| Camera noZoom | true (Fixed 1.0x Scale) |
| Status        | VERIFIED_COMPLETE       |

## 3. Full Script

### Voiceover

Scene 1 (0s–8s): «ساعت یازده شب؛ برگه‌ها روی میز مانده‌اند و هنوز جمع دخل معلوم نیست.»

Scene 2 (8s–14s): «ساعت یازده و هفت دقیقه؛ حساب را به فردا نینداز.»

Scene 3 (14s–23s): «با یک حرکت، کل دخل و خرج و سود روز در جیبت مرتب می‌شود.»

Scene 4 (23s–34s): «کسری انبار قبل از اینکه مشتری متوجه شود، علامت سبز می‌گیرد.»

Scene 5 (34s–40s): «حالا می‌توانی با خیال راحت کرکره را پایین بکشی و بخوابی.»

Scene 6 (40s–45s): «حسابچه؛ حساب روشن از امشب. رایگان شروع کن.»

### On-screen Text

NOT EXPLICITLY DEFINED IN SOURCE

### CTA

حسابچه؛ حساب روشن از امشب. رایگان شروع کن.

## 4. Timeline

### Scene 01 — DeskPovScene

**Time:** 0.00s – 8.00s (8s, Frames 0–240)

**Voiceover**
ساعت یازده شب؛ برگه‌ها روی میز مانده‌اند و هنوز جمع دخل معلوم نیست.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<DeskPovScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `midnight-desk`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 7.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `impact`
- [t=0.60s / +0.60s] Sound: `paperRustle`
- [t=1.50s / +1.50s] Sound: `typewriterClick`
- [t=3.20s / +3.20s] Sound: `tick`
- [t=5.50s / +5.50s] Sound: `alert`
- [t=7.20s / +7.20s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-92-midnight-desk.ts`
- Scene component: `src/scenes/midnight-desk.tsx`

### Scene 02 — DeadpanLookScene

**Time:** 8.00s – 14.00s (6s, Frames 240–420)

**Voiceover**
ساعت یازده و هفت دقیقه؛ حساب را به فردا نینداز.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<DeadpanLookScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `midnight-desk`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 5.6s]

**Transition**

- Type: `glitch`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=8.00s / +0.00s] Sound: `clockTickRapid`
- [t=8.25s / +0.25s] Sound: `impact`
- [t=9.20s / +1.20s] Sound: `cardEnter`
- [t=11.50s / +3.50s] Sound: `cinematicReveal`
- [t=13.20s / +5.20s] Sound: `sceneTransition`

**Source**

- Reel definition: `src/reels/reel-92-midnight-desk.ts`
- Scene component: `src/scenes/midnight-desk.tsx`

### Scene 03 — PhoneWhipScene

**Time:** 14.00s – 23.00s (9s, Frames 420–690)

**Voiceover**
با یک حرکت، کل دخل و خرج و سود روز در جیبت مرتب می‌شود.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<PhoneWhipScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `midnight-desk`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 8.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=14.00s / +0.00s] Sound: `whoosh`
- [t=14.80s / +0.80s] Sound: `cameraSwish`
- [t=16.00s / +2.00s] Sound: `dataFlow`
- [t=18.50s / +4.50s] Sound: `cardThock`
- [t=21.00s / +7.00s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-92-midnight-desk.ts`
- Scene component: `src/scenes/midnight-desk.tsx`

### Scene 04 — StockAlertScene

**Time:** 23.00s – 34.00s (11s, Frames 690–1020)

**Voiceover**
کسری انبار قبل از اینکه مشتری متوجه شود، علامت سبز می‌گیرد.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<StockAlertScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `midnight-desk`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 10.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=23.00s / +0.00s] Sound: `alert`
- [t=23.25s / +0.25s] Sound: `impact`
- [t=24.50s / +1.50s] Sound: `scan`
- [t=26.80s / +3.80s] Sound: `sync`
- [t=29.20s / +6.20s] Sound: `success`
- [t=32.00s / +9.00s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-92-midnight-desk.ts`
- Scene component: `src/scenes/midnight-desk.tsx`

### Scene 05 — MicroSmileScene

**Time:** 34.00s – 40.00s (6s, Frames 1020–1200)

**Voiceover**
حالا می‌توانی با خیال راحت کرکره را پایین بکشی و بخوابی.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<MicroSmileScene />`
- Spec Kind: `bespoke`
- Metaphor: `transformation`
- Theme: `midnight-desk`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 5.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=34.00s / +0.00s] Sound: `insightReveal`
- [t=35.50s / +1.50s] Sound: `financialMilestone`
- [t=37.50s / +3.50s] Sound: `successResolution`
- [t=39.00s / +5.00s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-92-midnight-desk.ts`
- Scene component: `src/scenes/midnight-desk.tsx`

### Scene 06 — DeskCtaScene

**Time:** 40.00s – 45.00s (5s, Frames 1200–1350)

**Voiceover**
حسابچه؛ حساب روشن از امشب. رایگان شروع کن.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<DeskCtaScene />`
- Spec Kind: `bespoke`
- Metaphor: `attention-ripple`
- Theme: `midnight-desk`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 4.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=40.00s / +0.00s] Sound: `ctaResolution`
- [t=40.50s / +0.50s] Sound: `bigReveal`
- [t=41.80s / +1.80s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-92-midnight-desk.ts`
- Scene component: `src/scenes/midnight-desk.tsx`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `spatial-2.5d-portal`
- Art Direction: `cinematic-obsidian`

### Colors

- `DESK_NIGHT`: `#070a10`
- `WOOD_TOP`: `#0f141f`
- `LAMP_GOLD`: `#f59e0b`
- `ALERT_RED`: `#f43f5e`
- `OK_GREEN`: `#10b981`
- `NIGHT_MIST`: `#f8fafc`
- `BORDER_SUBTLE`: `rgba(255, 255, 255, 0.08)`
- `TEXT_SLATE`: `#94a3b8`

### Typography

- Vazirmatn / Dana (Persian Display Headlines & UI)
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- High-depth container-local cards with 1px glass border
- Sub-pixel telemetry indicators and status pills
- Real-time mathematical financial gauges and matrix grids

## 6. Motion Design

| Element          | Animation       | Timing      | Easing                | Source                             |
| ---------------- | --------------- | ----------- | --------------------- | ---------------------------------- |
| DeskPovScene     | impact-ripple   | 0.0s–8.0s   | cubic-bezier / spring | src/reels/reel-92-midnight-desk.ts |
| DeadpanLookScene | impact-ripple   | 8.0s–14.0s  | cubic-bezier / spring | src/reels/reel-92-midnight-desk.ts |
| PhoneWhipScene   | entrance-spring | 14.0s–23.0s | cubic-bezier / spring | src/reels/reel-92-midnight-desk.ts |
| StockAlertScene  | impact-ripple   | 23.0s–34.0s | cubic-bezier / spring | src/reels/reel-92-midnight-desk.ts |
| MicroSmileScene  | value-transform | 34.0s–40.0s | cubic-bezier / spring | src/reels/reel-92-midnight-desk.ts |
| DeskCtaScene     | entrance-spring | 40.0s–45.0s | cubic-bezier / spring | src/reels/reel-92-midnight-desk.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 5

## 8. Audio & Music

- Music Mood: `calm`
- Total Sound Cues: 29
- Sound Kinds: `alert`, `bigReveal`, `cameraSwish`, `cardEnter`, `cardThock`, `chime`, `cinematicReveal`, `clockTickRapid`, `ctaResolution`, `dataFlow`, `financialMilestone`, `impact`, `insightReveal`, `paperRustle`, `scan`, `sceneTransition`, `softTransition`, `success`, `successResolution`, `sync`, `tick`, `typewriterClick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «حسابچه؛ حساب روشن از امشب. رایگان شروع کن.»
- Placement: Final Scene (40s–45s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `midnight-desk`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-92-midnight-desk.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-92-midnight-desk.ts) (Lines 1–145)
- Scene component: [`src/scenes/midnight-desk.tsx`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/scenes/midnight-desk.tsx) (Lines 1–918)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Music mood, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Story matrix

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-92/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
