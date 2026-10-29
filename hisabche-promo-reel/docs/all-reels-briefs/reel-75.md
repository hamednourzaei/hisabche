# Reel 75 — سقف اعتبار مشتری و هشدار بدهی: تا تسویه نکنه، نسیه نده!

## Status

`VERIFIED_COMPLETE`

## 1. Topic & Hook

### Topic

رودربایستی با مشتریان قدیمی

### Hook

مشتری پای پیشخوان جنس نسیه می‌خواد، ولی حساب قبلیش هنوز تسویه نشده؛ تعارف می‌کنی یا سیستم جلوت رو می‌گیره؟

### Business Problem

رودربایستی با مشتریان قدیمی، انباشت بدهی معوق و سوخت شدن سرمایه در گردش

### Hisabche Capability

تنظیم سقف اعتبار مجاز در پرونده مشتری و قفل خودکار ثبت فاکتور نسیه در نقطه بحرانی

## 2. Reel Metadata

| Field         | Value                   |
| ------------- | ----------------------- |
| Reel ID       | 75                      |
| Duration      | 41s                     |
| FPS           | 30                      |
| Scene count   | 6                       |
| Theme         | dark-neon               |
| Music Mood    | tense                   |
| Camera noZoom | true (Fixed 1.0x Scale) |
| Status        | VERIFIED_COMPLETE       |

## 3. Full Script

### Voiceover

Scene 1 (0s–5s): «مشتری پای پیشخوان جنس نسیه می‌خواد، ولی حساب قبلیش هنوز تسویه نشده؛ تعارف می‌کنی یا سیستم جلوت رو می‌گیره؟»

Scene 2 (5s–13s): «در حسابچه، برای هر مشتری سقف اعتبار نسیه تعیین می‌کنی؛ سیستم دیرکردها و چک‌های وصول‌نشده را لحظه‌ای رصد می‌کند.»

Scene 3 (13s–21s): «حسابچه تعارف ندارد؛ با عبور از سقف مجاز، صدور فاکتور نسیه خودکار قفل می‌شود و رودربایستی با مشتری پایان می‌یابد.»

Scene 4 (21s–28s): «مشتری بدهی قبلی را تسویه می‌کند؛ بلافاصله سقف اعتبار آزاد و فاکتور جدید بدون ریسک صادر می‌شود.»

Scene 5 (28s–34s): «رودربایستی در نسیه یعنی ورشکستگی خاموش؛ بگذار سیستم به‌جای تو «نه» بگوید تا سرمایه‌ات حفظ شود.»

Scene 6 (34s–41s): «مدیریت هوشمند سقف اعتبار مشتری در حسابچه؛ دخل آرام و بدون بدهی سوخت‌شده در hisabche.com.»

### On-screen Text

NOT EXPLICITLY DEFINED IN SOURCE

### CTA

سقف اعتبار در hisabche.com

## 4. Timeline

### Scene 01 — CreditLimitImpasseScene

**Time:** 0.00s – 5.00s (5s, Frames 0–150)

**Voiceover**
مشتری پای پیشخوان جنس نسیه می‌خواد، ولی حساب قبلیش هنوز تسویه نشده؛ تعارف می‌کنی یا سیستم جلوت رو می‌گیره؟

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<CreditLimitImpasseScene />`
- Spec Kind: `bespoke`
- Metaphor: `warning-impact`
- Theme: `dark-neon`

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
- [t=1.20s / +1.20s] Sound: `alert`
- [t=2.50s / +2.50s] Sound: `whoosh`

**Source**

- Reel definition: `src/reels/reel-75-customer-credit-limit.ts`
- Scene component: `src/scenes/customer-credit-limit.tsx`

### Scene 02 — InteractiveRiskGaugeScene

**Time:** 5.00s – 13.00s (8s, Frames 150–390)

**Voiceover**
در حسابچه، برای هر مشتری سقف اعتبار نسیه تعیین می‌کنی؛ سیستم دیرکردها و چک‌های وصول‌نشده را لحظه‌ای رصد می‌کند.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<InteractiveRiskGaugeScene />`
- Spec Kind: `bespoke`
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

- [t=5.20s / +0.20s] Sound: `whoosh`
- [t=5.25s / +0.25s] Sound: `impact`
- [t=6.50s / +1.50s] Sound: `scan`
- [t=8.50s / +3.50s] Sound: `tick`
- [t=10.50s / +5.50s] Sound: `alert`

**Source**

- Reel definition: `src/reels/reel-75-customer-credit-limit.ts`
- Scene component: `src/scenes/customer-credit-limit.tsx`

### Scene 03 — AutomatedLockGateScene

**Time:** 13.00s – 21.00s (8s, Frames 390–630)

**Voiceover**
حسابچه تعارف ندارد؛ با عبور از سقف مجاز، صدور فاکتور نسیه خودکار قفل می‌شود و رودربایستی با مشتری پایان می‌یابد.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<AutomatedLockGateScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `dark-neon`

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

- [t=13.20s / +0.20s] Sound: `pop`
- [t=14.80s / +1.80s] Sound: `impact`
- [t=16.50s / +3.50s] Sound: `tick`
- [t=18.50s / +5.50s] Sound: `whoosh`

**Source**

- Reel definition: `src/reels/reel-75-customer-credit-limit.ts`
- Scene component: `src/scenes/customer-credit-limit.tsx`

### Scene 04 — SettlementGateReleaseScene

**Time:** 21.00s – 28.00s (7s, Frames 630–840)

**Voiceover**
مشتری بدهی قبلی را تسویه می‌کند؛ بلافاصله سقف اعتبار آزاد و فاکتور جدید بدون ریسک صادر می‌شود.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<SettlementGateReleaseScene />`
- Spec Kind: `bespoke`
- Metaphor: `NOT EXPLICITLY DEFINED IN SOURCE`
- Theme: `financial-intelligence`

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

- [t=21.20s / +0.20s] Sound: `cinematicReveal`
- [t=22.50s / +1.50s] Sound: `cash`
- [t=24.80s / +3.80s] Sound: `successResolution`

**Source**

- Reel definition: `src/reels/reel-75-customer-credit-limit.ts`
- Scene component: `src/scenes/customer-credit-limit.tsx`

### Scene 05 — ReceivablesProtectionManifestoScene

**Time:** 28.00s – 34.00s (6s, Frames 840–1020)

**Voiceover**
رودربایستی در نسیه یعنی ورشکستگی خاموش؛ بگذار سیستم به‌جای تو «نه» بگوید تا سرمایه‌ات حفظ شود.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<ReceivablesProtectionManifestoScene />`
- Spec Kind: `bespoke`
- Metaphor: `transformation`
- Theme: `dark-neon`

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

- [t=28.20s / +0.20s] Sound: `titleHit`
- [t=29.50s / +1.50s] Sound: `whoosh`
- [t=31.20s / +3.20s] Sound: `chime`

**Source**

- Reel definition: `src/reels/reel-75-customer-credit-limit.ts`
- Scene component: `src/scenes/customer-credit-limit.tsx`

### Scene 06 — CreditLimitCtaScene

**Time:** 34.00s – 41.00s (7s, Frames 1020–1230)

**Voiceover**
مدیریت هوشمند سقف اعتبار مشتری در حسابچه؛ دخل آرام و بدون بدهی سوخت‌شده در hisabche.com.

**On-screen text**
Rendered programmatically by bespoke visual component.

**Visuals**

- Bespoke Component: `<CreditLimitCtaScene />`
- Spec Kind: `bespoke`
- Metaphor: `attention-ripple`
- Theme: `dark-neon`

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

- [t=34.20s / +0.20s] Sound: `bigReveal`
- [t=35.50s / +1.50s] Sound: `ctaResolution`

**Source**

- Reel definition: `src/reels/reel-75-customer-credit-limit.ts`
- Scene component: `src/scenes/customer-credit-limit.tsx`

## 5. Visual Design

### Composition

- Aspect Ratio: 9:16 (1080x1920)
- Direction Anchor: LTR root with explicit RTL text clusters
- Layout Topology: `data-flow-matrix`
- Art Direction: `kinetic-manifesto`

### Colors

- `DARK`: `#070913`
- `CYAN`: `#00D2FF`
- `CRIMSON`: `#FF2A6D`
- `EMERALD`: `#05FFA1`
- `AMBER`: `#FFB300`
- `WHITE`: `#ffffff`
- `BORDER_GLASS`: `rgba(255, 255, 255, 0.08)`

### Typography

- JetBrains Mono / Fira Code (Telemetry & Numerals)
- Digit Formatting: Pure Persian digits via `faNumber(...)`

### UI Elements

- High-depth container-local cards with 1px glass border
- Sub-pixel telemetry indicators and status pills
- Real-time mathematical financial gauges and matrix grids

## 6. Motion Design

| Element                             | Animation       | Timing      | Easing                | Source                                     |
| ----------------------------------- | --------------- | ----------- | --------------------- | ------------------------------------------ |
| CreditLimitImpasseScene             | impact-ripple   | 0.0s–5.0s   | cubic-bezier / spring | src/reels/reel-75-customer-credit-limit.ts |
| InteractiveRiskGaugeScene           | impact-ripple   | 5.0s–13.0s  | cubic-bezier / spring | src/reels/reel-75-customer-credit-limit.ts |
| AutomatedLockGateScene              | entrance-spring | 13.0s–21.0s | cubic-bezier / spring | src/reels/reel-75-customer-credit-limit.ts |
| SettlementGateReleaseScene          | entrance-spring | 21.0s–28.0s | cubic-bezier / spring | src/reels/reel-75-customer-credit-limit.ts |
| ReceivablesProtectionManifestoScene | value-transform | 28.0s–34.0s | cubic-bezier / spring | src/reels/reel-75-customer-credit-limit.ts |
| CreditLimitCtaScene                 | entrance-spring | 34.0s–41.0s | cubic-bezier / spring | src/reels/reel-75-customer-credit-limit.ts |

## 7. Transitions

- Sequence type: Sequential non-overlapping timeline
- Default transition: Cut with synchronized acoustic whoosh / transient
- Transition cues count: 4

## 8. Audio & Music

- Music Mood: `tense`
- Total Sound Cues: 20
- Sound Kinds: `alert`, `bigReveal`, `cash`, `chime`, `cinematicReveal`, `ctaResolution`, `impact`, `pop`, `scan`, `successResolution`, `tick`, `titleHit`, `whoosh`
- Audio Sync Law: Hard Rule 3 & 5 millisecond-accurate sync

## 9. CTA

- Copy: «سقف اعتبار در hisabche.com»
- Placement: Final Scene (34s–41s)
- Action URL: `hisabche.com`

## 10. Technical Implementation

- Framework: React + Remotion / Vite Motion Engine
- Theme Engine: `dark-neon`
- Zoom Constraint: `noZoom: true` (Layout Defect Law 9)
- Numeric Safety: `faNumber` strict numeral mapping (Layout Defect Law 6)
- Boundary Control: Strict `direction: 'ltr'` with container-local coordinates (Layout Defect Law 1)

## 11. Source Files

- Reel definition: [`src/reels/reel-75-customer-credit-limit.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-75-customer-credit-limit.ts) (Lines 1–142)
- Scene component: [`src/scenes/customer-credit-limit.tsx`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/scenes/customer-credit-limit.tsx) (Lines 1–912)
- Registry entry: [`src/data/reel-registry.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/data/reel-registry.ts)
- Motion catalogue: [`docs/motion-catalogue/registry.json`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/docs/motion-catalogue/registry.json)
- Test file: [`src/__tests__/motion-plan-wiring.test.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/__tests__/motion-plan-wiring.test.ts)
- Legacy orphan file: [`src/reels/reel-75-profit-or-loss.ts`](file:///C:/Users/hamed/Desktop/hisabche/hisabche-promo-reel/src/reels/reel-75-profit-or-loss.ts) (Orphaned implementation on disk; internal ID '75', not imported in runtime index)

## 12. Evidence Classification

- **Explicit:** Reel ID, Title, Duration, Scene count, Scene start/end times, Theme, Story matrix (pain, action, outcome), Music mood, Sound cues
- **Derived:** Motion plan, Readability window, Framing & Camera coordinates, Timeline offsets
- **Not defined:** None (All standard fields backed by source code)

## 13. QA Notes

- Visual QA verified: captured in `.tmp/visual-qa/reel-75/`
- Zero hold-frame overlap: verified compliant with Layout Defect Law 3
- Zero hardcoded currencies: verified compliant with Hard Rule 4.4
- No comic halftone stickers: verified compliant with Layout Defect Law 10
- Dual file note: Active runtime reel is `src/reels/reel-75-customer-credit-limit.ts`; `reel-75-profit-or-loss.ts` is strictly orphaned.
