// ============================================
// Reel #112 — «برگشت به گذشته» (Flashback Rewind)
//
// User brief: motion graphics with a FLASHBACK TRANSITION, Persian copy and
// the Hisabche brand. The rewind is the grammar: the film cuts back into the
// paper ledger of the past again and again, until the final reel spins
// FORWARD into one Hisabche invoice — five records, no going back.
//
// 42.0s · 5 scenes · dark cinematic-obsidian · noZoom · bespoke stages.
// The 42s master timeline is shared with the scene clocks and word cues by
// ../scenes/flashback-timing, so picture and sound stay on one timeline.
// Word plans are PROVISIONAL (no recorded voiceover yet). Every sounded
// action is drawn by src/components/Reel112FlashbackActors.tsx.
//
// ── TREND REFACTOR (2026/2027, published-breakdown driven) ──────────────
// Grounded in: Envato "Video & motion design trends 2027" (09 Nov 2026),
// Storyblocks "Collage & mixed media animation" (26 Jan 2026), the project's
// VIRAL_HOOKS.md formula 4 ("Stop Doing This" interrupt) and
// SAAS_MOTION_STANDARDS.md. The trends point ONE way: intentionality, not
// more effects. Applied here:
//   1. RESTRAINT AS STYLE — one focal point per second; every cue must earn
//      its place; silence carries the night. Cue counts kept lean.
//   2. SPECIFIC ANALOG MATERIAL (not a generic VHS filter) — the paper ledger
//      is a real, concept-led reference: handwritten marker, paper rustle/tear,
//      a broadcast-era tape rewind. Foley = markerScribble / paperRustle /
//      paperTear / cameraSwish / tick.
//   3. ONE MATERIAL + ONE CONTRASTING MEDIUM — analog paper (scenes 1–3) is
//      answered by digital precision (scenes 4–5): cardEnter / majorReveal /
//      dataFlow / successResolution / ctaResolution. The contrast IS the turn.
//   4. MATCH-CUT GRAMMAR — each rewind cuts back to the SAME ledger number;
//      the resolution match-cuts the handwritten number into the invoice line.
//   5. STOP-MOTION CADENCE — the paper memory holds on a stepped flipbook
//      rhythm (component renders 12/8fps feel); the clock tick marks the step.
//   6. FRAME-ZERO VIRAL HOOK — a sensory interrupt at 0.0s before the first
//      word (VIRAL_HOOKS formula 4), then the uncomfortable discovery.
//   7. STORY = THE SPECTACLE — one idea (you keep rewinding to paper; Hisabche
//      writes it once, forward, forever), one POV (the accountant at night),
//      one turn (scene 4 forward-lock).
//   8. KINETIC TYPOGRAPHY RTL — proper Persian half-spaces, emphasis on the
//      decisive words, numbers drawn as faNumber by the component.
//
// CONTRACT PRESERVED: engine types, SoundKind catalog, S112.factors, the five
// bespoke components, every action ID (drawn by Reel112FlashbackActors.tsx),
// scene boundaries, duration, theme, noZoom, and PROVISIONAL cadence discipline.
// ============================================

import type { Cue, Reel, Scene } from '../engine/types'
import type { WordCue, SentencePlan } from '../engine/speech-model'
import { S112 } from '../scenes/flashback-timing'
import {
  FlashbackEndCardScene,
  FlashbackHookScene,
  FourCopyRewindScene,
  ForwardResolutionScene,
  PaperMemoryScene,
} from '../scenes/flashback-rewind'

const theme = 'cinematic-obsidian' as const
const round = (v: number): number => Math.round(v * 100) / 100

/** Every word plan is explicitly provisional until a human records audio. */
function plan(
  text: string,
  intent: string,
  words: WordCue[],
  endingAt: number,
  endingAction: string,
  factor: number,
): SentencePlan {
  return {
    text,
    intent,
    alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE',
    isProvisional: true,
    confidence: null,
    words: words.map((word) => ({
      ...word,
      start: round(word.start * factor),
      end: round(word.end * factor),
    })),
    sentenceEnding: { at: round(endingAt * factor), action: endingAction },
  }
}

const scenes: Scene[] = [
  // 1 (0.00–6.00) — HOOK · the present rewinds into the paper ledger.
  // Shot intent: locked-off frame; a broadcast-era tape REWIND interrupts frame
  // zero (scanline + swish), the picture snaps back into a handwritten ledger.
  // Texture: scanned paper, marker ink. Pace: one decisive move, then a freeze.
  // Emotion: the uncomfortable discovery — you are back at the paper again.
  {
    start: 0,
    end: 6,
    noZoom: true,
    spec: {
      kind: 'bespoke',
      theme,
      component: FlashbackHookScene,
      // Frame-zero sensory interrupt (VIRAL_HOOKS formula 4) + the freeze punctuation.
      cues: [
        { at: 0, kind: 'scan' },
        { at: 4.55, kind: 'chime' },
      ] as Cue[],
    },
    vo: 'دوباره برگشتی سر دفتر کاغذی؟',
    sentence: plan(
      'دوباره برگشتی سر دفتر کاغذی؟',
      'هوک بازگشت / بازگشت ناخواسته به دفتر دستی',
      [
        { word: 'دوباره', start: 0.15, end: 0.45, sound: 'whoosh', action: 'rewind-start' },
        {
          word: 'برگشتی',
          start: 0.55,
          end: 0.95,
          emphasis: true,
          sound: 'cameraSwish',
          action: 'paper-flashback',
        },
        { word: 'سر', start: 1.0, end: 1.15 },
        {
          word: 'دفتر',
          start: 1.2,
          end: 1.6,
          emphasis: true,
          sound: 'paperRustle',
          action: 'paper-ledger',
        },
        {
          word: 'کاغذی؟',
          start: 1.65,
          end: 2.1,
          emphasis: true,
          sound: 'titleHit',
          action: 'question-stamp',
        },
      ],
      2.1,
      'freeze-question',
      S112.factors[0]!,
    ),
  },
  // 2 (6.00–15.00) — PAPER MEMORY · the same night, the same numbers.
  // Shot intent: match-cut onto the SAME ledger number the hook rewound to; the
  // frame holds on a stepped stop-motion cadence (12/8fps flipbook feel). A quiet
  // night clock ticks; a hand re-writes the number with a marker. Texture: paper
  // grain, ink, soft shadow. Pace: slow, restrained — quiet dread. Emotion: déjà vu.
  {
    start: 6,
    end: 15,
    noZoom: true,
    spec: {
      kind: 'bespoke',
      theme,
      component: PaperMemoryScene,
      // Match-cut anchor (the rewind lands) + one quiet punctuation. Restraint:
      // the night is carried by silence and the word-level tick, not a cue bed.
      cues: [
        { at: 0.09, kind: 'cameraSwish' },
        { at: 7.65, kind: 'chime' },
      ] as Cue[],
    },
    vo: 'همون شب، همون اعداد، دوباره از اول.',
    sentence: plan(
      'همون شب، همون اعداد، دوباره از اول.',
      'تشدید خاطره / تکرار شبانهی کار دستی',
      [
        { word: 'همون', start: 0.3, end: 0.6 },
        { word: 'شب', start: 0.7, end: 1.0, sound: 'tick', action: 'clock-tick' },
        { word: 'همون', start: 1.3, end: 1.6 },
        // Handwritten, not typed: the analog material is a marker on paper.
        {
          word: 'اعداد',
          start: 1.7,
          end: 2.1,
          emphasis: true,
          sound: 'markerScribble',
          action: 'handwrite',
        },
        { word: 'دوباره', start: 2.4, end: 2.7 },
        { word: 'از', start: 2.8, end: 2.95 },
        { word: 'اول', start: 3.1, end: 3.5, sound: 'paperTear', action: 'page-tear' },
      ],
      3.5,
      'memory-hold',
      S112.factors[1]!,
    ),
  },
  // 3 (15.00–26.00) — FOUR COPIES · one number in four places; three rewinds.
  // Shot intent: the single number splits into four copies (ledger, excel,
  // calculator, phone note); three tape-rewind match-cuts snap back to the SAME
  // number between them. Texture: torn-paper edges, layered scanned grain.
  // Pace: escalating but single-focus — one copy lights at a time. Emotion: doubt.
  {
    start: 15,
    end: 26,
    noZoom: true,
    spec: {
      kind: 'bespoke',
      theme,
      component: FourCopyRewindScene,
      // The three structural rewinds between the four copies (match-cut grammar).
      cues: [
        { at: 2.03, kind: 'cameraSwish' },
        { at: 4.4, kind: 'cameraSwish' },
        { at: 6.77, kind: 'cameraSwish' },
      ] as Cue[],
    },
    vo: 'هر عدد رو چهار جا می\u200cنویسی؛ بازم مطمئن نیستی.',
    sentence: plan(
      'هر عدد رو چهار جا می\u200cنویسی؛ بازم مطمئن نیستی.',
      'ریشهی مشکل / کپی شدن یک عدد در چهار جا',
      [
        { word: 'هر', start: 0.2, end: 0.4 },
        { word: 'عدد', start: 0.5, end: 0.9, sound: 'markerScribble', action: 'copy-one' },
        { word: 'رو', start: 1.0, end: 1.15 },
        { word: 'چهار', start: 1.35, end: 1.75, emphasis: true },
        { word: 'جا', start: 1.8, end: 1.95 },
        {
          word: 'می\u200cنویسی',
          start: 2.0,
          end: 2.5,
          sound: 'markerScribble',
          action: 'copy-four',
        },
        {
          word: 'بازم',
          start: 3.1,
          end: 3.45,
          emphasis: true,
          sound: 'alert',
          action: 'doubt-flash',
        },
        { word: 'مطمئن', start: 3.55, end: 4.0 },
        { word: 'نیستی', start: 4.3, end: 4.9, sound: 'impact', action: 'four-way-split' },
      ],
      4.9,
      'split-hold',
      S112.factors[2]!,
    ),
  },
  // 4 (26.00–37.00) — FORWARD RESOLUTION · the rewind reverses; one invoice, five records.
  // Shot intent: THE TURN. Match-cut the handwritten number into a clean invoice
  // line; the reel spins FORWARD. Material flips from analog paper to digital
  // precision: the invoice enters, the brand reveals, five records post as one
  // data flow, the paper past is torn away and locked out. Texture: crisp UI,
  // soft key shadow, no grain. Pace: confident, staggered 50–120ms. Emotion: relief.
  {
    start: 26,
    end: 37,
    noZoom: true,
    spec: {
      kind: 'bespoke',
      theme,
      component: ForwardResolutionScene,
      // One soft match-cut into the digital stage; the precision is carried by
      // word-level UI sounds (cardEnter / majorReveal / dataFlow), not a cue pile.
      cues: [{ at: 0.08, kind: 'softTransition' }] as Cue[],
    },
    vo: 'یه فاکتور در حسابچه، پنج سند هم\u200cزمان؛ دیگه برگشتی به دفتر نیست.',
    sentence: plan(
      'یه فاکتور در حسابچه، پنج سند هم\u200cزمان؛ دیگه برگشتی به دفتر نیست.',
      'موتور محصول / یک فاکتور، پنج ثبت مستند',
      [
        { word: 'یه', start: 0.3, end: 0.5 },
        { word: 'فاکتور', start: 0.6, end: 1.0, sound: 'cardEnter', action: 'invoice-enter' },
        { word: 'در', start: 1.1, end: 1.2 },
        {
          word: 'حسابچه',
          start: 1.3,
          end: 1.8,
          emphasis: true,
          sound: 'majorReveal',
          action: 'brand-reveal',
        },
        { word: 'پنج', start: 2.15, end: 2.45, sound: 'tick', action: 'five-count' },
        { word: 'سند', start: 2.5, end: 2.8 },
        // Five records posting at once = a data flow, not a generic success chime.
        {
          word: 'هم\u200cزمان',
          start: 2.9,
          end: 3.4,
          emphasis: true,
          sound: 'dataFlow',
          action: 'five-post',
        },
        { word: 'دیگه', start: 3.7, end: 4.0 },
        { word: 'برگشتی', start: 4.05, end: 4.35 },
        { word: 'به', start: 4.4, end: 4.5 },
        { word: 'دفتر', start: 4.55, end: 4.75, sound: 'paperTear', action: 'past-cut' },
        {
          word: 'نیست',
          start: 4.8,
          end: 5.0,
          sound: 'successResolution',
          action: 'no-return-lock',
        },
      ],
      5.0,
      'forward-lock',
      S112.factors[3]!,
    ),
  },
  // 5 (37.00–42.00) — END CARD · the brand curtain; full-opacity CTA holds 4+ seconds.
  // Shot intent: locked brand frame; the paper past dissolves for good; the URL
  // settles. Texture: clean obsidian, one accent. Pace: still. Emotion: closure.
  {
    start: 37,
    end: 42,
    noZoom: true,
    spec: {
      kind: 'bespoke',
      theme,
      component: FlashbackEndCardScene,
      cues: [{ at: 4.0, kind: 'chime' }] as Cue[],
    },
    vo: 'حسابچه؛ دیگه دفتر کاغذی برنمی\u200cگرده. hisabche.com',
    sentence: plan(
      'حسابچه؛ دیگه دفتر کاغذی برنمی\u200cگرده. hisabche.com',
      'دعوت به اقدام / حسابچه، بدون بازگشت به کاغذ',
      [
        {
          word: 'حسابچه',
          start: 0.3,
          end: 0.8,
          emphasis: true,
          sound: 'ctaResolution',
          action: 'cta-brand',
        },
        { word: 'دیگه', start: 1.0, end: 1.2 },
        { word: 'دفتر', start: 1.25, end: 1.55 },
        { word: 'کاغذی', start: 1.6, end: 2.0 },
        {
          word: 'برنمی\u200cگرده',
          start: 2.05,
          end: 2.6,
          emphasis: true,
          sound: 'successResolution',
          action: 'past-dissolve',
        },
        { word: 'hisabche.com', start: 2.9, end: 3.4 },
      ],
      2.6,
      'end-hold',
      S112.factors[4]!,
    ),
  },
]

export const reel112: Reel = {
  id: '112',
  title: 'فلشبک — از دفتر کاغذی تا حسابچه',
  duration: 42,
  theme,
  noZoom: true,
  musicMood: 'tense',
  storyMatrix: {
    targetCustomer: 'accountant',
    customerPain: 'یک عدد در چهار جای مختلف نوشته میشود و هیچکدام به دیگری اعتبار ندارد.',
    oldWorkflow:
      'دفتر دستی، اکسل، ماشین\u200cحساب و یادداشت گوشی؛ همان شب و همان اعداد، دوباره از اول.',
    friction: 'با وجود چهار کپی، هنوز مطمئن نیستی کدام عدد درست است.',
    hisabcheAction:
      'یک فاکتور در حسابچه پنج سند هم\u200cزمان مینویسد و همان لحظه به\u200cهم وصل میکند.',
    automatedResult: 'انبار، صندوق، دفتر، طلب و سود بدون دوباره\u200cکاری ثبت و قابل خواندناند.',
    businessOutcome: 'پایان بازگشت\u200cهای مکرر به کاغذ؛ نتیجهی شب همان روز قابل اعتماد است.',
    emotionalPayoff:
      'دیگر لازم نیست گذشته را دوباره زنده کنی؛ حسابچه آن را یک\u200cبار برای همیشه ثبت کرده است.',
    cta: 'حسابچه — دیگه دفتر کاغذی برنمی\u200cگرده · hisabche.com',
    selectedOperators: [
      'FlashbackRewindHook',
      'PaperMemoryHold',
      'FourCopyRewind',
      'ForwardFivePost',
      'FlashbackEndCard',
    ],
  },
  scenes,
}
