# Reel 90 — سیل کاغذها — صد برگه، یک داشبورد روشن

## Status

`VERIFIED_COMPLETE`

## 1. Topic & Hook

### Topic

سیل کاغذها — صد برگه، یک داشبورد روشن

### Hook

صد فاکتور و رسید هر روز روی میزت می‌ریزد و آخرش نمی‌دانی چقدر واقعاً ماند.

### Business Problem

صد فاکتور و رسید هر روز روی میزت می‌ریزد و آخرش نمی‌دانی چقدر واقعاً ماند.

### Hisabche Capability

NOT EXPLICITLY DEFINED IN SOURCE

## 2. Reel Metadata

| Field         | Value                   |
| ------------- | ----------------------- |
| Reel ID       | 90                      |
| Duration      | 46s                     |
| FPS           | 30                      |
| Scene count   | 6                       |
| Theme         | ink-flood               |
| Music Mood    | uplifting               |
| Camera noZoom | true (Fixed 1.0x Scale) |
| Status        | VERIFIED_COMPLETE       |

## 3. Full Script

### Voiceover

Scene 1 (0s–7s): «صد فاکتور و رسید هر روز روی میزت می‌ریزد و آخرش نمی‌دانی چقدر واقعاً ماند.»

Scene 2 (7s–15s): «بعد همه‌چیز می‌ایستد؛ حسابچه برگه‌ها را به یک نقطهٔ روشن می‌کشد.»

Scene 3 (15s–24s): «فروش یک میلیون و هشتصد و چهل هزار، موجودی سیصد و دوازده قلم، سود چهارصد و هفتاد و پنج هزار، طلب دویست و هجده هزار.»

Scene 4 (24s–34s): «همین عددها الان داخل حسابچه روشن است؛ روی گوشی، بی‌کاغذ.»

Scene 5 (34s–41s): «خط روشن از راست رد می‌شود و هر جا گذشت، پاک و مرتب می‌ماند.»

Scene 6 (41s–46s): «حسابچه؛ حساب روشن از امشب. رایگان شروع کن.»

### On-screen Text

NOT EXPLICITLY DEFINED IN SOURCE

### CTA

حسابچه؛ حساب روشن از امشب. رایگان شروع کن.

## 4. Timeline

### Scene 01 — FloodArrivalScene

**Time:** 0.00s – 7.00s (7s, Frames 0–210)

**Voiceover**
صد فاکتور و رسید هر روز روی میزت می‌ریزد و آخرش نمی‌دانی چقدر واقعاً ماند.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<FloodArrivalScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `ink-flood`

**Motion**

- Primary Motion: `impact-ripple`
- Secondary Motion: `breathing-text`
- Typography Motion: `entrance-spring + breathing (no static hold > 1.2s)`
- Camera: from 1 to 1 (pan: 0, 0)
- Readability Window: [1.4s, 6.6s]

**Transition**

- Type: `cut`
- Visual behavior: Continuous timeline progression

**Audio**

- [t=0.00s / +0.00s] Sound: `impact`
- [t=0.50s / +0.50s] Sound: `whoosh`
- [t=2.20s / +2.20s] Sound: `paperRustle`
- [t=4.60s / +4.60s] Sound: `alert`
- [t=6.10s / +6.10s] Sound: `sceneTransition`

**Source**

- Reel definition: `src/reels/reel-90-ink-flood.ts`
- Scene component: `src/scenes/ink-flood.tsx`

### Scene 02 — SuctionFreezeScene

**Time:** 7.00s – 15.00s (8s, Frames 210–450)

**Voiceover**
بعد همه‌چیز می‌ایستد؛ حسابچه برگه‌ها را به یک نقطهٔ روشن می‌کشد.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<SuctionFreezeScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `ink-flood`

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

- [t=7.00s / +0.00s] Sound: `softTransition`
- [t=7.25s / +0.25s] Sound: `impact`
- [t=7.80s / +0.80s] Sound: `cinematicReveal`
- [t=9.20s / +2.20s] Sound: `dataFlow`
- [t=11.90s / +4.90s] Sound: `whoosh`
- [t=13.30s / +6.30s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-90-ink-flood.ts`
- Scene component: `src/scenes/ink-flood.tsx`

### Scene 03 — ClarityCardsScene

**Time:** 15.00s – 24.00s (9s, Frames 450–720)

**Voiceover**
فروش یک میلیون و هشتصد و چهل هزار، موجودی سیصد و دوازده قلم، سود چهارصد و هفتاد و پنج هزار، طلب دویست و هجده هزار.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<ClarityCardsScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `ink-flood`

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

- [t=15.50s / +0.50s] Sound: `cardThock`
- [t=16.70s / +1.70s] Sound: `cardThock`
- [t=18.00s / +3.00s] Sound: `cardThock`
- [t=19.30s / +4.30s] Sound: `cardThock`
- [t=20.60s / +5.60s] Sound: `precisionSequence`
- [t=22.00s / +7.00s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-90-ink-flood.ts`
- Scene component: `src/scenes/ink-flood.tsx`

### Scene 04 — PhoneDashboardScene

**Time:** 24.00s – 34.00s (10s, Frames 720–1020)

**Voiceover**
همین عددها الان داخل حسابچه روشن است؛ روی گوشی، بی‌کاغذ.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<PhoneDashboardScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `ink-flood`

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

- [t=24.00s / +0.00s] Sound: `whoosh`
- [t=25.00s / +1.00s] Sound: `dataFlow`
- [t=27.60s / +3.60s] Sound: `financialMilestone`
- [t=29.20s / +5.20s] Sound: `cash`
- [t=30.80s / +6.80s] Sound: `insightReveal`

**Source**

- Reel definition: `src/reels/reel-90-ink-flood.ts`
- Scene component: `src/scenes/ink-flood.tsx`

### Scene 05 — CureSweepSlideScene

**Time:** 34.00s – 41.00s (7s, Frames 1020–1230)

**Voiceover**
خط روشن از راست رد می‌شود و هر جا گذشت، پاک و مرتب می‌ماند.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<CureSweepSlideScene />`
- Spec Kind: `bespoke`
- Metaphor: `transformation`
- Theme: `ink-flood`

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

- [t=34.00s / +0.00s] Sound: `cameraSwish`
- [t=35.20s / +1.20s] Sound: `scan`
- [t=38.60s / +4.60s] Sound: `success`
- [t=39.80s / +5.80s] Sound: `softTransition`

**Source**

- Reel definition: `src/reels/reel-90-ink-flood.ts`
- Scene component: `src/scenes/ink-flood.tsx`

### Scene 06 — InkCtaScene

**Time:** 41.00s – 46.00s (5s, Frames 1230–1380)

**Voiceover**
حسابچه؛ حساب روشن از امشب. رایگان شروع کن.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<InkCtaScene />`
- Spec Kind: `bespoke`
- Metaphor: `attention-ripple`
- Theme: `ink-flood`

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

- [t=41.00s / +0.00s] Sound: `ctaResolution`
- [t=41.40s / +0.40s] Sound: `bigReveal`
- [t=42.10s / +1.10s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-90-ink-flood.ts`
- Scene component: `src/scenes/ink-flood.tsx`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `single-focal-stage`
- Art Direction: `kinetic-manifesto`

### Colors

- `INK_CANVAS`: `#060810`
- `PAPER_WARM`: `#f4ebd9`
- `FLOOD_AMBER`: `#ffb954`
- `CLARITY_TEAL`: `#4fe3c4`
- `EMERALD_OK`: `#34d399`
- `ALERT_CRIMSON`: `#f87171`
- `INK_MIST`: `#ece6d8`
- `INK_MUTED`: `rgba(236,230,216,0.68)`
- `OBSIDIAN_CARD`: `rgba(14, 18, 30, 0.78)`

### Typography

- Persian Display: Vazirmatn / Dana (font-weight: 700–900)
- Telemetry Numerals: JetBrains Mono / ui-monospace
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- High-depth container-local cards with 1px glass border
- Sub-pixel telemetry indicators and status pills
- Real-time mathematical financial gauges and matrix grids

## 6. Motion Design

| Element             | Animation       | Timing      | Easing                | Source                         |
| ------------------- | --------------- | ----------- | --------------------- | ------------------------------ |
| FloodArrivalScene   | impact-ripple   | 0.0s–7.0s   | cubic-bezier / spring | src/reels/reel-90-ink-flood.ts |
| SuctionFreezeScene  | impact-ripple   | 7.0s–15.0s  | cubic-bezier / spring | src/reels/reel-90-ink-flood.ts |
| ClarityCardsScene   | entrance-spring | 15.0s–24.0s | cubic-bezier / spring | src/reels/reel-90-ink-flood.ts |
| PhoneDashboardScene | entrance-spring | 24.0s–34.0s | cubic-bezier / spring | src/reels/reel-90-ink-flood.ts |
| CureSweepSlideScene | value-transform | 34.0s–41.0s | cubic-bezier / spring | src/reels/reel-90-ink-flood.ts |
| InkCtaScene         | entrance-spring | 41.0s–46.0s | cubic-bezier / spring | src/reels/reel-90-ink-flood.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 6

## 8. Audio & Music

- Music Mood: `uplifting`
- Total Sound Cues: 29
- Sound Kinds: `alert`, `bigReveal`, `cameraSwish`, `cardThock`, `cash`, `chime`, `cinematicReveal`, `ctaResolution`, `dataFlow`, `financialMilestone`, `impact`, `insightReveal`, `paperRustle`, `precisionSequence`, `scan`, `sceneTransition`, `softTransition`, `success`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «حسابچه؛ حساب روشن از امشب. رایگان شروع کن.»
- Placement: Final Scene (41s–46s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `ink-flood`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-90-ink-flood.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-90-ink-flood.ts) (Lines 1–145)
- Scene component: [`src/scenes/ink-flood.tsx`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/scenes/ink-flood.tsx) (Lines 1–1479)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Music mood, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** Story matrix

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-90/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
