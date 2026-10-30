# Reel 86 — شبکه‌ی حسابچه — دیورامای نئونی ایزومتریک

## Status

`VERIFIED_COMPLETE`

## 1. Topic & Hook

### Topic

شبکه‌ی حسابچه — دیورامای نئونی ایزومتریک

### Hook

مغازه‌ات زنده‌ست؛ پیشخوان، قفسه، صندوق، دفتر — ولی هیچ‌کدوم همدیگه رو نمی‌بینن.

### Business Problem

مغازه‌ات زنده‌ست؛ پیشخوان، قفسه، صندوق، دفتر — ولی هیچ‌کدوم همدیگه رو نمی‌بینن.

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                   |
| ------------- | ----------------------- |
| Reel ID       | 86                      |
| Duration      | 45s                     |
| FPS           | 30                      |
| Scene count   | 6                       |
| Theme         | isometric-neon          |
| Music Mood    | uplifting               |
| Camera noZoom | true (Fixed 1.0x Scale) |
| Status        | VERIFIED_COMPLETE       |

## 3. Full Script

### Voiceover

Scene 1 (0s–5s): «مغازه‌ات زنده‌ست؛ پیشخوان، قفسه، صندوق، دفتر — ولی هیچ‌کدوم همدیگه رو نمی‌بینن.»

Scene 2 (5s–12s): «هر ایستگاه جداگانه کار می‌کنه؛ شماره‌ها بینشان گم می‌شود و دوباره‌کاری بالا می‌گیرد.»

Scene 3 (12s–20s): «یک هسته وسط می‌نشیند و همه‌ی خطوط یک‌باره صاف و مرتب می‌شوند.»

Scene 4 (20s–30s): «حالا فروش، موجودی و سود روی همان اتاق شناورند؛ عدد لحظه‌ای، تصویر زنده.»

Scene 5 (30s–38s): «و هر شعبه به همان هسته وصل می‌شود؛ انگار نفس‌شان یکی شده است.»

Scene 6 (38s–45s): «حسابچه؛ وقتی شبکه‌ات یکی می‌شود، تصمیم هم ساده می‌شود. شروع کن.»

### On-screen Text

NOT EXPLICITLY DEFINED IN SOURCE

### CTA

hisabche.com

## 4. Timeline

### Scene 01 — IsoHookScene

**Time:** 0.00s – 5.00s (5s, Frames 0–150)

**Voiceover**
مغازه‌ات زنده‌ست؛ پیشخوان، قفسه، صندوق، دفتر — ولی هیچ‌کدوم همدیگه رو نمی‌بینن.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<IsoHookScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `isometric-neon`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 4.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `impact`
- [t=1.50s / +1.50s] Sound: `clockTickRapid`
- [t=3.00s / +3.00s] Sound: `alert`

**Source**

- Reel definition: `src/reels/reel-86-isometric-neon.ts`
- Scene component: `src/scenes/isometric-neon.tsx`

### Scene 02 — IsoBuildScene

**Time:** 5.00s – 12.00s (7s, Frames 150–360)

**Voiceover**
هر ایستگاه جداگانه کار می‌کنه؛ شماره‌ها بینشان گم می‌شود و دوباره‌کاری بالا می‌گیرد.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<IsoBuildScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `isometric-neon`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.6s]

**Transition**

- Type: `glitch`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=5.25s / +0.25s] Sound: `impact`
- [t=5.40s / +0.40s] Sound: `dataFlow`
- [t=7.60s / +2.60s] Sound: `scan`
- [t=9.40s / +4.40s] Sound: `alert`

**Source**

- Reel definition: `src/reels/reel-86-isometric-neon.ts`
- Scene component: `src/scenes/isometric-neon.tsx`

### Scene 03 — IsoCoreScene

**Time:** 12.00s – 20.00s (8s, Frames 360–600)

**Voiceover**
یک هسته وسط می‌نشیند و همه‌ی خطوط یک‌باره صاف و مرتب می‌شوند.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<IsoCoreScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `isometric-neon`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 7.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=12.60s / +0.60s] Sound: `cinematicReveal`
- [t=13.80s / +1.80s] Sound: `majorReveal`
- [t=15.20s / +3.20s] Sound: `bigReveal`

**Source**

- Reel definition: `src/reels/reel-86-isometric-neon.ts`
- Scene component: `src/scenes/isometric-neon.tsx`

### Scene 04 — IsoLiveScene

**Time:** 20.00s – 30.00s (10s, Frames 600–900)

**Voiceover**
حالا فروش، موجودی و سود روی همان اتاق شناورند؛ عدد لحظه‌ای، تصویر زنده.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<IsoLiveScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `isometric-neon`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 9.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=20.50s / +0.50s] Sound: `dataFlow`
- [t=22.50s / +2.50s] Sound: `tick`
- [t=24.50s / +4.50s] Sound: `cash`
- [t=27.00s / +7.00s] Sound: `financialMilestone`

**Source**

- Reel definition: `src/reels/reel-86-isometric-neon.ts`
- Scene component: `src/scenes/isometric-neon.tsx`

### Scene 05 — IsoMultiScene

**Time:** 30.00s – 38.00s (8s, Frames 900–1140)

**Voiceover**
و هر شعبه به همان هسته وصل می‌شود؛ انگار نفس‌شان یکی شده است.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<IsoMultiScene />`
- Spec Kind: `bespoke`
- Metaphor: `transformation`
- Theme: `isometric-neon`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 7.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=30.80s / +0.80s] Sound: `whoosh`
- [t=32.60s / +2.60s] Sound: `sync`
- [t=35.00s / +5.00s] Sound: `successResolution`

**Source**

- Reel definition: `src/reels/reel-86-isometric-neon.ts`
- Scene component: `src/scenes/isometric-neon.tsx`

### Scene 06 — IsoLogoScene

**Time:** 38.00s – 45.00s (7s, Frames 1140–1350)

**Voiceover**
حسابچه؛ وقتی شبکه‌ات یکی می‌شود، تصمیم هم ساده می‌شود. شروع کن.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<IsoLogoScene />`
- Spec Kind: `bespoke`
- Metaphor: `attention-ripple`
- Theme: `isometric-neon`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=38.40s / +0.40s] Sound: `bigReveal`
- [t=40.00s / +2.00s] Sound: `chime`
- [t=41.40s / +3.40s] Sound: `ctaResolution`

**Source**

- Reel definition: `src/reels/reel-86-isometric-neon.ts`
- Scene component: `src/scenes/isometric-neon.tsx`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `NOT EXPLICITLY DEFINED IN SOURCE`
- Art Direction: `NOT EXPLICITLY DEFINED IN SOURCE`

### Colors

- `VOID`: `#04060f`
- `NEON_GREEN`: `#00ff9f`
- `NEON_BLUE`: `#00d2ff`
- `NEON_PINK`: `#ff3b81`
- `WIRE`: `#6366f1`
- `ALERT_CRIMSON`: `#f87171`
- `ISO_MUTED`: `rgba(238,242,255,0.7)`

### Typography

- JetBrains Mono / Fira Code (Telemetry & Numerals)
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- High-depth container-local cards with 1px glass border
- Sub-pixel telemetry indicators and status pills
- Real-time mathematical financial gauges and matrix grids

## 6. Motion Design

| Element       | Animation       | Timing      | Easing                | Source                              |
| ------------- | --------------- | ----------- | --------------------- | ----------------------------------- |
| IsoHookScene  | impact-ripple   | 0.0s–5.0s   | cubic-bezier / spring | src/reels/reel-86-isometric-neon.ts |
| IsoBuildScene | impact-ripple   | 5.0s–12.0s  | cubic-bezier / spring | src/reels/reel-86-isometric-neon.ts |
| IsoCoreScene  | entrance-spring | 12.0s–20.0s | cubic-bezier / spring | src/reels/reel-86-isometric-neon.ts |
| IsoLiveScene  | entrance-spring | 20.0s–30.0s | cubic-bezier / spring | src/reels/reel-86-isometric-neon.ts |
| IsoMultiScene | value-transform | 30.0s–38.0s | cubic-bezier / spring | src/reels/reel-86-isometric-neon.ts |
| IsoLogoScene  | entrance-spring | 38.0s–45.0s | cubic-bezier / spring | src/reels/reel-86-isometric-neon.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 1

## 8. Audio & Music

- Music Mood: `uplifting`
- Total Sound Cues: 20
- Sound Kinds: `alert`, `bigReveal`, `cash`, `chime`, `cinematicReveal`, `clockTickRapid`, `ctaResolution`, `dataFlow`, `financialMilestone`, `impact`, `majorReveal`, `scan`, `successResolution`, `sync`, `tick`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «hisabche.com»
- Placement: Final Scene (38s–45s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `isometric-neon`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-86-isometric-neon.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-86-isometric-neon.ts) (Lines 1–137)
- Scene component: [`src/scenes/isometric-neon.tsx`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/scenes/isometric-neon.tsx) (Lines 1–1217)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Music mood, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Story matrix

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-86/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
