# Hisabche Promo Reel — Zero-Discovery Fast-Track SDK & Context Index
> **Path:** `.claude/fast-track-sdk.md`  
> **Purpose:** Permanent, self-contained technical cheat sheet for instant `/new_reels` execution across ANY AI agent (Claude Code, Cursor, Copilot, Windsurf) without scanning or grepping `src/`.

---

## 1. Exact TypeScript Interfaces & Top-of-File Imports

When creating a new reel file `src/reels/reel-XX-<slug>.ts`, use these exact imports:

```ts
import type { Reel, Scene, SceneSpec, Cue, Tone, ThemeName, IconCard, Mark, OpeningArchetype } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue, SentencePlan } from '../engine/speech-model'
```

### Core Interface Shapes:

```ts
export interface Reel {
  id: string              // e.g. '55'
  title: string           // Persian title: e.g. 'سناریوی کلمه‌به‌کلمه: عنوان ریلز'
  duration: number        // Total duration in seconds (usually 26.0)
  theme?: ThemeName       // e.g. 'financial-intelligence', 'cinematic-obsidian', 'swiss-editorial'
  scenes: Scene[]
  storyMatrix?: SaaSStoryMatrix
}

export interface Scene {
  start: number           // Scene start in seconds on the reel timeline (e.g. 0.0)
  end: number             // Scene end in seconds on the reel timeline (e.g. 3.5)
  spec: SceneSpec         // Visual component spec (see SceneSpec dictionary below)
  vo: string              // Spoken voiceover line (Persian)
  sentence?: SentencePlan // Word-level karaoke & narrative turning point
}

export interface SentencePlan {
  text: string
  intent: string          // e.g. 'هوک اضطراری / زنگ خطر بازار'
  alignmentStatus?: AlignmentLifecycleStatus // 'PROVISIONAL_CADENCE_MODEL_ACTIVE' | 'REAL_WORD_ALIGNMENT_READY'
  isProvisional?: boolean // true before human audio ingestion
  confidence?: number | null // null when provisional, never fake a float!
  words: WordCue[]
  sentenceEnding?: {
    at: number            // Relative offset in scene seconds for turning point
    action: string        // e.g. 'freeze-alarm', 'crack-graph', 'snap-dashboard'
    sound?: SoundKind
  }
}

export interface WordCue {
  word: string            // Spoken Persian token
  start: number           // Start in seconds relative to scene.start
  end: number             // End in seconds relative to scene.start
  emphasis?: boolean      // Kinetic glow & spring scale
  action?: string         // Visual actor trigger (e.g. 'clock-countdown', 'stamp-reject')
  sound?: SoundKind       // Acoustic cue at this word
  confidence?: number | null // null when provisional
}

export interface Cue {
  at: number              // Seconds on the timeline
  kind: SoundKind         // Valid sound effect name
}
```

---

## 2. Complete Dictionary of All Supported `SceneSpec` Kinds

Every scene in `scenes: Scene[]` has a `spec: SceneSpec`.

### Category A: Core Story & Information Scenes

| `spec.kind` | TypeScript Payload Shape | Purpose & Visual Architecture |
|---|---|---|
| **`hook`** | `{ kind: 'hook', theme?: ThemeName, openingArchetype?: OpeningArchetype, label?: string, lines: string[], cards?: IconCard[], consequence?: { alertBanner: string, stoppedAction: string, lossMetric?: string }, discovery?: { surfaceMetric: { label: string, value: string }, hiddenReality: { label: string, value: string }, discrepancyNote: string }, confrontation?: { speaker: string, dialogue: string, fadedEvidence: string }, interrupt?: { colossalHeadline: string, subHeadline?: string, shatteredTool: string }, quietDread?: { isolatedFact: string, unsettlingDetail: string, heartbeatBpm?: number }, deadline?: { targetTime: string, countdownLabel: string, unresolvedGap: string } }` | High-impact opening hook. Supports 6 archetypes: `immediate-consequence`, `uncomfortable-discovery`, `customer-confrontation`, `visual-pattern-interrupt`, `quiet-dread`, `deadline-pressure`. |
| **`branch`** | `{ kind: 'branch', theme?: ThemeName, cards: [IconCard, IconCard], question: string, answer: string, badge: string }` | Binary choice / dilemma between old painful way vs Hisabche way. |
| **`stagger`** | `{ kind: 'stagger', theme?: ThemeName, title: string, header: [string, string], rows: { icon: string, text: string }[], interval?: number, tone?: Tone }` | Waterfall list of friction points or operational steps falling sequentially. |
| **`hub`** | `{ kind: 'hub', theme?: ThemeName, title: string, core: string, coreSub: string, nodes: { icon: string, label: string }[] }` | Radial network diagram with central Hisabche core connecting 4-6 satellite nodes. |
| **`compare`** | `{ kind: 'compare', theme?: ThemeName, title: string, columns: [string, string, string, string], rows: { label: string, marks: [Mark, Mark, Mark] }[], interval?: number }` | 4-column comparison matrix (Feature \| Excel \| Legacy ERP \| Hisabche). Marks: `'yes'`, `'no'`, `'part'`. |
| **`bridge`** | `{ kind: 'bridge', theme?: ThemeName, title: string, left: IconCard, right: IconCard, merged: string, caption: string, summaries: [Summary, Summary] }` | Convergence of 2 disjointed systems into a single synchronized entity. |
| **`cta`** | `{ kind: 'cta', theme?: ThemeName, tagline: string, boxes: [CtaBox, CtaBox], switchAt: number }` | Dual-box conversion scene. Box 1: Problem resolution. Box 2: Search prompt `hisabche.com`. |
| **`pile`** | `{ kind: 'pile', theme?: ThemeName, title: string, papers: { icon: string, label: string }[], counter: string, merge: string }` | Stacking chaotic paper receipts that suddenly compress into structured digital ledger. |
| **`versus`** | `{ kind: 'versus', theme?: ThemeName, title: string, left: { label: string, value: string, tone: Tone }, right: { label: string, value: string, tone: Tone }, verdict: string }` | High-contrast split comparison (e.g. 430M Trapped vs 1.4M Bank). |
| **`ledger`** | `{ kind: 'ledger', theme?: ThemeName, title: string, name: string, lines: { label: string, amount: string }[], balanceFrom: number, balanceTo: number, unit: string, footer: string }` | Live merchant customer account statement with rolling balance calculations. |
| **`queue`** | `{ kind: 'queue', theme?: ThemeName, title: string, offlineLabel: string, items: string[], syncedLabel: string, reconnectAt: number }` | Offline POS sync demonstration. Items queue up then flush green upon reconnection. |
| **`day`** | `{ kind: 'day', theme?: ThemeName, title: string, moments: { time: string, icon: string, text: string }[], interval?: number }` | Day-in-the-life timeline (Morning, Noon, Closing) showing chaotic manual tasks. |

---

### Category B: Modern Motion & Editorial Scenes

| `spec.kind` | TypeScript Payload Shape | Purpose |
|---|---|---|
| **`kinetic`** | `{ kind: 'kinetic', theme?: ThemeName, headline: string, words: string[], sub?: string, tone?: Tone }` | Big-type bold typography cascade with word-by-word reveal. |
| **`mockup`** | `{ kind: 'mockup', theme?: ThemeName, device: 'window' \| 'phone', title: string, subtitle?: string, screen: { type: 'pos' \| 'invoice' \| 'dashboard' \| 'sync', header: string, items: { name: string, qty?: string, price: string, badge?: string }[], totalLabel?: string, totalValue?: string }, toast?: { icon: string, text: string, time: number }, cursor?: { x: number, y: number, clickAt: number } }` | High-fidelity software UI simulation (Invoice, POS checkout, or Dashboard) with cursor click and toast. |
| **`chart`** | `{ kind: 'chart', theme?: ThemeName, title: string, chartType: 'area' \| 'bar', kpis: { label: string, value: number, unit: string, trend?: string, tone?: Tone }[], data: { label: string, value: number }[] }` | Neon SVG metric graph with live KPI metrics and trend percentages. |
| **`split`** | `{ kind: 'split', theme?: ThemeName, title: string, left: { title: string, subtitle?: string, points: string[], tone: Tone }, right: { title: string, subtitle?: string, points: string[], tone: Tone }, dividerLabel?: string }` | Clean vertical split comparing chaos vs clarity with bullet points. |
| **`cinematic-product`** | `{ kind: 'cinematic-product', theme?: ThemeName, title: string, subtitle?: string, floatingBadge?: string, layers: { title: string, desc: string, icon: string, tone?: Tone, z?: number }[] }` | 2.5D exploded UI planes floating with parallax depth along the Z-axis. |
| **`kinetic-manifesto`** | `{ kind: 'kinetic-manifesto', theme?: ThemeName, headline: string[], subheadline?: string, statements: string[], accentTone?: Tone }` | Bold, full-bleed philosophical proclamations for business owners. |
| **`financial-intelligence`** | `{ kind: 'financial-intelligence', theme?: ThemeName, title: string, revenue: number, cogs: number, grossProfit: number, verdict: string }` | Double-entry financial breakdown: Revenue - Cost of Goods = Real Gross Profit. |
| **`continuous-transform`** | `{ kind: 'continuous-transform', theme?: ThemeName, title: string, subtitle?: string, stages: { at: number, label: string, sub: string }[], tone?: Tone }` | Multi-phase progressive state shift from manual pain to full automation. |
| **`daylight-editorial`** | `{ kind: 'daylight-editorial', theme?: ThemeName, category: string, headline: string, points: { label: string, value: string }[], quote?: string }` | High-craft Swiss editorial style on warm alabaster daylight canvas (#F7F6F2). |

---

### Category C: Customer Conversion Interactive Demos

| `spec.kind` | TypeScript Payload Shape | Purpose |
|---|---|---|
| **`offline-sync-demo`** | `{ kind: 'offline-sync-demo', theme?: ThemeName, title: string, subtitle?: string, reconnectAt?: number, syncCompleteAt?: number }` | Real-time POS checkout when internet is cut; instant background sync on reconnect. |
| **`fragmented-tools-demo`** | `{ kind: 'fragmented-tools-demo', theme?: ThemeName, title: string, convergeAt?: number }` | Fragmented tools (Excel, Paper, Calculator) collapsing into one unified Hisabche hub. |
| **`profit-waterfall-demo`** | `{ kind: 'profit-waterfall-demo', theme?: ThemeName, title: string, grossRevenue?: number, cogs?: number, expenses?: number }` | Visual waterfall showing where sales money leaks before reaching the owner's pocket. |
| **`warehouse-movement-demo`** | `{ kind: 'warehouse-movement-demo', theme?: ThemeName, title: string, transitAt?: number, arriveAt?: number }` | Multi-warehouse stock transfer with live cardex movement and balance adjustments. |
| **`dual-perspective-demo`** | `{ kind: 'dual-perspective-demo', theme?: ThemeName, title: string, saleAt?: number, journalAt?: number }` | Simultaneous split-view: Store POS sale triggers instant double-entry journal posting. |

---

### Category D: 12 Viral Short-Form Template Archetypes

| `spec.kind` | TypeScript Payload Shape |
|---|---|
| **`tactile-train`** | `{ kind: 'tactile-train', theme?: ThemeName, title?: string }` |
| **`thermal-receipt`** | `{ kind: 'thermal-receipt', theme?: ThemeName, title?: string }` |
| **`infinite-spatial`** | `{ kind: 'infinite-spatial', theme?: ThemeName, title?: string }` |
| **`vox-documentary`** | `{ kind: 'vox-documentary', theme?: ThemeName, title?: string, headline?: string, documentNumber?: string, badgeText?: string, clippingTitle?: string, clippingText?: string, dark?: boolean }` |
| **`minimal-vector`** | `{ kind: 'minimal-vector', theme?: ThemeName, title?: string }` |
| **`chat-panic`** | `{ kind: 'chat-panic', theme?: ThemeName, title?: string }` |
| **`liquid-glass`** | `{ kind: 'liquid-glass', theme?: ThemeName, title?: string }` |
| **`kinetic-color`** | `{ kind: 'kinetic-color', theme?: ThemeName }` |
| **`split-stopwatch`** | `{ kind: 'split-stopwatch', theme?: ThemeName, topTitle?: string, topSub?: string, topBody?: string, topFooter?: string, bottomTitle?: string, bottomSub?: string, bottomBody?: string, bottomFooter?: string, finishAt?: number }` |
| **`isometric-exploded`**| `{ kind: 'isometric-exploded', theme?: ThemeName, title?: string }` |
| **`continuous-line`** | `{ kind: 'continuous-line', theme?: ThemeName, title?: string }` |
| **`swiss-terminal`** | `{ kind: 'swiss-terminal', theme?: ThemeName, title?: string }` |
| **`premium-motion`** | `{ kind: 'premium-motion', theme?: ThemeName, title?: string, subtitle?: string, kicker?: string, statValue?: string, statLabel?: string, contrastValue?: string, contrastLabel?: string, badge?: string }` |

---

### Category E: The Gold Standard Word-Driven Stage (`word-sync`)

```ts
{
  kind: 'word-sync',
  actor: 'cheque-countdown' | 'capital-trap' | 'overdue-cards' | 'sms-settlement' | 'cta-conversion-54' | 'hook-sales' | 'broken-chart' | 'leak-cards' | 'unified-dashboard' | 'cta-finish' | (string & {}),
  title?: string,
  sentencePlan?: SentencePlan
}
```
*Directly drives custom or registered actors where every spoken word moves the visual canvas.*

---

## 3. Valid Token Lists (NO GUESSING ALLOWED)

### Valid `Tone` Strings (`export type Tone`):
- `'cyan'` (#22d3ee)
- `'purple'` (#c084fc)
- `'red'` (#fb7185)
- `'green'` (#4ade80)

### Valid `ThemeName` Strings (`export type ThemeName`):
`'dark-neon'` | `'light-editorial'` | `'midnight-gold'` | `'cyber-emerald'` | `'obsidian-cinematic'` | `'cinematic-obsidian'` | `'swiss-editorial'` | `'alabaster-daylight'` | `'kinetic-manifesto'` | `'procedural-spatial'` | `'financial-intelligence'`

### Complete List of All 40 Valid Icon Names (`<Icon name="..." />`):
`barcode`, `book`, `boxes`, `briefcase`, `calculator`, `calendar`, `check`, `clipboard`, `cloud`, `coins`, `factory`, `sheet`, `file`, `drive`, `history`, `bank`, `laptop`, `chat`, `notebook`, `package`, `receipt`, `sync`, `scale`, `shield`, `smartphone`, `sparkles`, `store`, `sun`, `moon`, `trash`, `trend`, `truck`, `user`, `users`, `wallet`, `offline`, `gem`, `dollar`, `question`.

### Inline `<Rich text="..." />` Formatting Syntax:
- `[c:متن فیروزه‌ای]` -> Cyan highlight
- `[p:متن بنفش]` -> Purple highlight
- `[g:متن گرادینت]` -> Cyan-to-Purple gradient highlight
- `[r:متن قرمز]` -> Red danger highlight
- `[w:متن سفید بولد]` -> Pure white bold text

### Complete List of Valid `SoundKind` Audio Triggers:
`'whoosh'` | `'tick'` | `'pop'` | `'cash'` | `'alert'` | `'impact'` | `'chime'` | `'sync'` | `'scan'` | `'success'` | `'cinematicReveal'` | `'titleHit'` | `'dataFlow'` | `'bigReveal'` | `'insightReveal'` | `'precisionSequence'` | `'softTransition'` | `'financialMilestone'` | `'cardEnter'` | `'sceneTransition'` | `'majorReveal'` | `'successResolution'` | `'ctaResolution'` | `'markerScribble'` | `'paperRustle'` | `'paperTear'` | `'cameraSwish'` | `'typewriterClick'` | `'clockTickRapid'` | `'chatPop'` | `'receiptPrint'`

---

## 4. Golden Reference Example (Reel #54 Pattern)

```ts
import type { Reel } from '../engine/types'
import type { AlignmentLifecycleStatus, WordCue } from '../engine/speech-model'
import alignmentData from './alignments/reel-54-alignment.json'

function getSceneWords(sceneIndex: number, defaultWords: WordCue[]): WordCue[] {
  const alignedScene = alignmentData.scenes[sceneIndex]
  if (!alignedScene?.words) return defaultWords
  return defaultWords.map((def) => {
    const aw = alignedScene.words.find((w: any) => w.word === def.word)
    return aw ? { ...def, start: aw.start, end: aw.end, confidence: aw.confidence } : def
  })
}

export const reel54: Reel = {
  id: '54',
  title: 'سناریوی کلمه‌به‌کلمه: ساعت ۱۲ ظهر چکت برگشت می‌خوره!',
  duration: 26.0,
  theme: 'financial-intelligence',
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'سررسید چک سنگین در بانک با موجودی ناکافی به دلیل طلب‌های معوق',
    oldWorkflow: 'دفتر نسیه دستی بدون راس‌گیری و تماس‌های تلفنی بی‌نتیجه',
    friction: 'قفل شدن ۴۳۰ میلیون تومان سرمایه در دست بدهکاران بازار',
    hisabcheAction: 'یادآور خودکار پیامکی و راس‌گیری هوشمند فاکتورها',
    automatedResult: 'وصول سریع طلب‌ها پیش از سررسید و پاس شدن چک',
    businessOutcome: 'حفظ اعتبار تجاری و نقد شدن مطالبات راکد',
    emotionalPayoff: 'آرامش خاطر و تسلط کامل بر تاریخ سررسیدها',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: ['word-synchronized-choreography', 'tactile-leaks'],
  },
  scenes: [
    {
      start: 0.0,
      end: 3.5,
      vo: 'ساعت ۱۲ ظهر چکت برگشت می‌خوره!',
      spec: { kind: 'word-sync', actor: 'cheque-countdown', title: 'هشدار چک صیادی' },
      sentence: {
        text: 'ساعت ۱۲ ظهر چکت برگشت می‌خوره!',
        intent: 'هوک اضطراری / زنگ خطر بازار',
        alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE',
        isProvisional: true,
        confidence: null,
        words: getSceneWords(0, [
          { word: 'ساعت', start: 0.2, end: 0.55, sound: 'tick' },
          { word: '۱۲', start: 0.6, end: 1.05, emphasis: true, action: 'clock-countdown', sound: 'clockTickRapid' },
          { word: 'ظهر', start: 1.1, end: 1.35, sound: 'tick' },
          { word: 'چکت', start: 1.4, end: 1.85, emphasis: true, action: 'cheque-reveal', sound: 'titleHit' },
          { word: 'برگشت', start: 1.9, end: 2.15, emphasis: true, sound: 'alert' },
          { word: 'می‌خوره!', start: 2.0, end: 2.45, emphasis: true, action: 'stamp-reject', sound: 'impact' },
        ]),
        sentenceEnding: { at: 2.2, action: 'freeze-alarm', sound: 'alert' },
      },
    },
    // ... Scenes 2, 3, 4, 5 follow the exact same word-synchronized pattern
  ],
}
```

---

## 5. The Exact 4-File Registration Recipe

To register a new Reel (e.g. Reel 55):

1. **Create Definition File:**  
   `src/reels/reel-55-<slug>.ts` (exporting `export const reel55: Reel = { ... }`).
2. **Create Strategy Prompt File:**  
   `docs/prompts/reel-55-prompt.md` (containing Persian script, director's notes, voiceover guidance, and word actions).
3. **Register in Array:**  
   In `src/reels/index.ts`:
   - Add import: `import { reel55 } from './reel-55-<slug>'`
   - Add to `export const REELS: Reel[] = [ ..., reel55 ]`
   - Add to bottom exports: `export { ..., reel55 }`
4. **Append Entry in Ledger:**  
   In `src/data/reel-ledger.json`, add an entry to the `reels` array:
   ```json
   {
     "id": "55",
     "title": "عنوان ریلز ۵۵",
     "theme": "financial-intelligence",
     "hookFormula": "immediate-consequence",
     "dominantLayout": "spatial-2.5d-portal",
     "cardQuotaPercent": 15,
     "components": ["word-sync", "word-sync", "word-sync", "word-sync", "word-sync"]
   }
   ```
5. **Fast Verify:**
   ```bash
   cd hisabche-promo-reel && npm run typecheck
   ```

---

## 6. The 12 Motion System Production Hard Rules (Mandatory for Reel 58+)

Every new reel must conform to the 12 production rules established in `.claude/reel-plugin/production-guardrails.md`:
1. **Numbers Must Never Blink:** Introduce -> Hold -> Transform -> Hold -> Exit. No `opacity: 0 -> 1 -> 0 -> 1`. Monotonic sliding odometer without modulo wraps or mask toggling.
2. **Real Physical Motion:** Cards, charts, tables, and alerts must move (`translateY`, `scale`, `clipReveal`, `studioSpring`), not merely fade.
3. **Motion Continuity:** Smooth handoffs between states; elements morph rather than hard-cut.
4. **9:16 Safe Composition & Optical Centering:**
   - Title Zone: Top 10%–22%
   - Primary Visual Zone: 25%–65% (center of gravity around Y: 45%–55%)
   - Subtitle: Bottom 80%–94% as a pure floating overlay. Never push cards to the bottom third!
5. **Final CTA Timing & Minimum 3s Hold:** Final CTA scene starts 4–5s before end. CTA card enters at `t = 0.3s` and holds at 100% full opacity for at least 3.0 seconds.
6. **Scene Timing Budget:** Entry -> Build -> Climax (hold >= 1.5s) -> Exit (last 0.18s max).
7. **No Micro-Flashes:** No unneeded key remounts, no un-clamped math, no binary mask pops.
8. **One Master Timeline:** Pure deterministic functions of scene time `t`.
9. **Subtitle Does Not Control Layout:** Subtitle is an absolute overlay (`position: absolute; pointer-events: none`). Never participates in flex calculation.
10. **Motion Presets:** Use standard primitives (`enterUp`, `enterDown`, `scaleReveal`, `clipReveal`, `highlightSweep`, `staggerEnter`, `stableHold`).
11. **Context Position Audit:** Diagnostic bounding-box verification (`src/engine/composition-audit.ts`).
12. **Final Slide Validation:** Perfect end card: CTA visible, brand centered, zero clipped cards, zero blinking.

## 7. HARD RULE 13 — AV SYNC LAW (owner, 17 Oct 2026)

«صدا با تصویر هماهنگ نیست» is no longer a review note; it is a number, and the export refuses the file.
Code: `scripts/sync-law.mjs` (pure, one definition — mixer, gate and browser preview all import it) ·
`scripts/sound-design.mjs` (`cuePlacements`) · `scripts/check-av-sync.mjs` (the gate).
Tests: `scripts/__tests__/av-sync-law.test.mjs` (library) · `src/__tests__/av-sync-law.test.ts` (scripts, reel ≥ 60).

**Script (reel ≥ 60)**
1. A word with a `sound` has an `action`, and the actor reads that action's time with `cueAt(plan, '<action>', fallback)`. The action string must appear in the actor file.
2. A `sentenceEnding` carries **no sound** — a hold is not an event.
3. Two cues closer than 120 ms share one sound (`placedCues`).

**Library (every file in `assets/sfx/manifest.json`)**
4. The hit point is the first onset (5 ms RMS above 300 Hz, 2.2× the previous 40 ms) that reaches half the file's loudest frame within 30 ms. That frame lands on the cue.
5. At most 20 ms is kept before the hit (faded in) — a shimmer ahead of the hit is heard as «early».
6. Every event file is a transient whose FIRST hit leads (no later hit > 1.25× the first). Swells, rustle textures and «riffle then slap» files are not allowed for event kinds.
7. Files normalised (after the trim) to a 0.5 peak; raw peak below −45 dB refused.

**Mix**
8. Choke: each sound fades out (60 ms) and is silent 40 ms before the next hit.
9. Music bed by average level (RMS 0.008), never peak — a dense track at the events' level buried them.
10. Master make-up gain stops where the loudest hit is 80% of the ceiling; loudness never flattens the hits.
11. The scene-cut thump is 0.25 s, under the scene's first event.

**Gate** — every export measures the finished file: each transient must start within ±45 ms of its cue, or the export fails (`blockedBy: 'AV_SYNC'`).
Fast check while writing: `node scripts/check-av-sync.mjs <id> --mix` (seconds). On a file: `node scripts/check-av-sync.mjs <id>`.

What it found on reel 60 (before): clockTick +585 ms, alert +600 ms, impact/markerScribble not heard at all, sparkle 145 ms early — causes: lead silence in files, music too loud after peak-normalising, master loudness raising the bed back up, swell files used for hits.

---

## 8. HARD RULE 14 — ONE FOCAL STAGE & ON-STAGE TEXT BUDGET (owner, 17 Oct 2026)

- **One Focal Stage:** The 9:16 vertical canvas must have exactly ONE dominant visual focal area and one stable subtitle bar.
- **Dedicated Safe Zones:** Subtitle Zone anchored exclusively at bottom safe area (`bottom: 80px`). Primary Visual Zone kept strictly centered in the central frame ($Y \in [42\%, 58\%]$).
- **Zero Duplicated Narration:** Never render the spoken voiceover sentence as a headline or card title above the subtitle bar.
- **No Floating Commentary:** Never introduce independent textual commentary competing with narrator.
- **Hard Text Budget:** Default to ZERO decorative text. Functional labels only (e.g., shelf code `B-04`, product name, quantity). Hard ceiling: at most 6 words of total non-subtitle on-stage text visible at once.

---

## 9. HARD RULE 15 — NATURAL PERSIAN COPY & ZERO BROKEN FRAGMENTS (owner, 17 Oct 2026)

- **Natural Bazaar Idioms:** All on-screen copy and voiceover dialogue must use authentic, natural Persian phrasing suited for Iranian merchants.
- **Banned Copy Fragments:** Reject unnatural, clipped, or stilted fragments (`«بار گم»`, `«آدرس بار»`, `«بار رو بی‌تلفن پیدا کن»`).
- **Communicate Through Visual State:** Show consequences through object state and motion, not awkward text tags.

---

## 10. HARD RULE 16 — ELIMINATION OF HORIZONTAL DIVIDERS & LINE ARTIFACTS (owner, 17 Oct 2026)

- **No Accidental Dividers:** The background and stage must NEVER contain accidental horizontal divider lines, neon boundary bars, or split-screen borders (such as `.r61-horizon` or `.topology-split-screen-horizon::before`).
- **Unified Spatial Canvas:** Every scene occupies a cohesive, unified 9:16 coordinate plane.

---

## 11. HARD RULE 17 — EVIDENCE-BASED AUDIO & SUBTITLE SYNCHRONIZATION (owner, 17 Oct 2026)

- **No Unsupported Synchronization Claims:** Never claim millisecond-accurate word-level synchronization without verified forced-alignment JSON.
- **Honest Alignment Lifecycle States:**
  - `WORD_SYNC_VERIFIED`: Only with verified forced alignment.
  - `PHRASE_SYNC_VERIFIED`: Anchored to measured acoustic speech intervals, word positions are anchored estimates.
  - `PROVISIONAL_CADENCE_MODEL_ACTIVE`: Voiceover pending or estimated via cadence math (`isProvisional: true`).
- **Timing Alignment to Actual Speech:** Words appear when spoken, not stretched across trailing silence.

