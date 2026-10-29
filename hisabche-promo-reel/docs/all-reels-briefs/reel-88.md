# Reel 88 — ساعت صفر — مغازه‌ای که از گریبان دنده یک بازمی‌گردد

## Status

`VERIFIED_COMPLETE`

## 1. Topic & Hook

### Topic

ساعت صفر — مغازه‌ای که از گریبان دنده یک بازمی‌گردد

### Hook

یازده و پنجاه و نه! مغازه کار می‌کند اما جلو نمی‌رود.

### Business Problem

یازده و پنجاه و نه! مغازه کار می‌کند اما جلو نمی‌رود.

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                   |
| ------------- | ----------------------- |
| Reel ID       | 88                      |
| Duration      | 45s                     |
| FPS           | 30                      |
| Scene count   | 7                       |
| Theme         | clockwork-brass         |
| Music Mood    | tense                   |
| Camera noZoom | true (Fixed 1.0x Scale) |
| Status        | VERIFIED_COMPLETE       |

## 3. Full Script

### Voiceover

Scene 1 (0s–3.5s): «یازده و پنجاه و نه! مغازه کار می‌کند اما جلو نمی‌رود.»

Scene 2 (3.5s–9.5s): «صندوق، انبار و دفتر؛ سه چرخ‌دنده دندونه‌به‌دندونه گیر کرده‌اند.»

Scene 3 (9.5s–17s): «حسابچه چرخ اصلی می‌شود و اولین دنده واقعی را می‌گیرد.»

Scene 4 (17s–25s): «همه دنده‌ها جفت می‌شوند و عقربه سرانجام آزاد می‌شود.»

Scene 5 (25s–33s): «فروش هفتصد و شصت و دو هزار، بهای چهارصد و پنجاه هزار، خرج هفتاد و هفت هزار؛ سود دویست و بیست و پنج هزار — تراز.»

Scene 6 (33s–40s): «پرده پایین می‌آید و روز تراز بسته می‌شود.»

Scene 7 (40s–45s): «ساعت صفر شد؛ حسابچه، دخل را تراز نگه می‌دارد. شروع کن.»

### On-screen Text

NOT EXPLICITLY DEFINED IN SOURCE

### CTA

ساعت صفر شد؛ حسابچه، دخل را تراز نگه می‌دارد. شروع کن.

## 4. Timeline

### Scene 01 — ClockStuckScene

**Time:** 0.00s – 3.50s (3.5s, Frames 0–105)

**Voiceover**
یازده و پنجاه و نه! مغازه کار می‌کند اما جلو نمی‌رود.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<ClockStuckScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `clockwork-brass`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.05s, 3.1s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `impact`
- [t=0.40s / +0.40s] Sound: `clockTickRapid`
- [t=1.60s / +1.60s] Sound: `tick`
- [t=2.40s / +2.40s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

### Scene 02 — GrindingGearsScene

**Time:** 3.50s – 9.50s (6s, Frames 105–285)

**Voiceover**
صندوق، انبار و دفتر؛ سه چرخ‌دنده دندونه‌به‌دندونه گیر کرده‌اند.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<GrindingGearsScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `clockwork-brass`

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

- [t=3.50s / +0.00s] Sound: `cinematicReveal`
- [t=3.75s / +0.25s] Sound: `impact`
- [t=3.80s / +0.30s] Sound: `cardEnter`
- [t=4.25s / +0.75s] Sound: `cardEnter`
- [t=4.70s / +1.20s] Sound: `cardEnter`
- [t=7.40s / +3.90s] Sound: `majorReveal`
- [t=8.40s / +4.90s] Sound: `alert`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

### Scene 03 — HeroGearScene

**Time:** 9.50s – 17.00s (7.5s, Frames 285–510)

**Voiceover**
حسابچه چرخ اصلی می‌شود و اولین دنده واقعی را می‌گیرد.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<HeroGearScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `clockwork-brass`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 7.1s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=9.50s / +0.00s] Sound: `whoosh`
- [t=13.40s / +3.90s] Sound: `bigReveal`
- [t=13.70s / +4.20s] Sound: `titleHit`
- [t=14.10s / +4.60s] Sound: `insightReveal`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

### Scene 04 — TrainMeshScene

**Time:** 17.00s – 25.00s (8s, Frames 510–750)

**Voiceover**
همه دنده‌ها جفت می‌شوند و عقربه سرانجام آزاد می‌شود.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<TrainMeshScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `clockwork-brass`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 7.6s]

**Transition**

- Type: `swipe`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=17.00s / +0.00s] Sound: `precisionSequence`
- [t=20.20s / +3.20s] Sound: `cash`
- [t=21.20s / +4.20s] Sound: `chime`
- [t=23.00s / +6.00s] Sound: `successResolution`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

### Scene 05 — ToothLedgerScene

**Time:** 25.00s – 33.00s (8s, Frames 750–990)

**Voiceover**
فروش هفتصد و شصت و دو هزار، بهای چهارصد و پنجاه هزار، خرج هفتاد و هفت هزار؛ سود دویست و بیست و پنج هزار — تراز.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<ToothLedgerScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `clockwork-brass`

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

- [t=25.00s / +0.00s] Sound: `dataFlow`
- [t=25.35s / +0.35s] Sound: `cardEnter`
- [t=25.85s / +0.85s] Sound: `cardEnter`
- [t=26.35s / +1.35s] Sound: `cardEnter`
- [t=26.85s / +1.85s] Sound: `financialMilestone`
- [t=30.00s / +5.00s] Sound: `majorReveal`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

### Scene 06 — ShutterLockScene

**Time:** 33.00s – 40.00s (7s, Frames 990–1200)

**Voiceover**
پرده پایین می‌آید و روز تراز بسته می‌شود.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<ShutterLockScene />`
- Spec Kind: `bespoke`
- Metaphor: `transformation`
- Theme: `clockwork-brass`

**Motion**

- Primary Motion: `value-transform`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.6s]

**Transition**

- Type: `zoom`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=33.00s / +0.00s] Sound: `cameraSwish`
- [t=37.05s / +4.05s] Sound: `titleHit`
- [t=38.00s / +5.00s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

### Scene 07 — BrassCtaScene

**Time:** 40.00s – 45.00s (5s, Frames 1200–1350)

**Voiceover**
ساعت صفر شد؛ حسابچه، دخل را تراز نگه می‌دارد. شروع کن.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<BrassCtaScene />`
- Spec Kind: `bespoke`
- Metaphor: `attention-ripple`
- Theme: `clockwork-brass`

**Motion**

- Primary Motion: `entrance-spring`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 4.6s]

**Transition**

- Type: `dissolve`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=40.00s / +0.00s] Sound: `ctaResolution`
- [t=40.30s / +0.30s] Sound: `bigReveal`
- [t=40.95s / +0.95s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-88-clockwork-brass.ts`
- Scene component: `src/scenes/clockwork-brass.tsx`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `full-bleed-kinetic`
- Art Direction: `cinematic-obsidian`

### Colors

- `WORKSHOP_NIGHT`: `#0c0a07`
- `BRASS`: `#d9a441`
- `COPPER`: `#b86a28`
- `AMBER`: `#ffb84d`
- `PATINA`: `#34d399`
- `CREAM`: `#f4ebd8`
- `FORGE_RED`: `#f87171`
- `BRASS_MUTED`: `rgba(244,235,216,0.68)`

### Typography

- JetBrains Mono / Fira Code (Telemetry & Numerals)
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- High-depth container-local cards with 1px glass border
- Sub-pixel telemetry indicators and status pills
- Real-time mathematical financial gauges and matrix grids

## 6. Motion Design

| Element            | Animation       | Timing      | Easing                | Source                               |
| ------------------ | --------------- | ----------- | --------------------- | ------------------------------------ |
| ClockStuckScene    | impact-ripple   | 0.0s–3.5s   | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |
| GrindingGearsScene | impact-ripple   | 3.5s–9.5s   | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |
| HeroGearScene      | entrance-spring | 9.5s–17.0s  | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |
| TrainMeshScene     | entrance-spring | 17.0s–25.0s | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |
| ToothLedgerScene   | entrance-spring | 25.0s–33.0s | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |
| ShutterLockScene   | value-transform | 33.0s–40.0s | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |
| BrassCtaScene      | entrance-spring | 40.0s–45.0s | cubic-bezier / spring | src/reels/reel-88-clockwork-brass.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 3

## 8. Audio & Music

- Music Mood: `tense`
- Total Sound Cues: 31
- Sound Kinds: `alert`, `bigReveal`, `cameraSwish`, `cardEnter`, `cash`, `chime`, `cinematicReveal`, `clockTickRapid`, `ctaResolution`, `dataFlow`, `financialMilestone`, `impact`, `insightReveal`, `majorReveal`, `precisionSequence`, `softTransition`, `successResolution`, `tick`, `titleHit`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «ساعت صفر شد؛ حسابچه، دخل را تراز نگه می‌دارد. شروع کن.»
- Placement: Final Scene (40s–45s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `clockwork-brass`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-88-clockwork-brass.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-88-clockwork-brass.ts) (Lines 1–162)
- Scene component: [`src/scenes/clockwork-brass.tsx`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/scenes/clockwork-brass.tsx) (Lines 1–1332)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Music mood, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Story matrix

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-88/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
