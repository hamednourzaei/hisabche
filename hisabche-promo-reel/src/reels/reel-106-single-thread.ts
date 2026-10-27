// ============================================
// Reel 106 — «یک خط» (One Thread) · معرفی حسابچه
//
// Story: the merchant runs five books that never meet — credit, cheques,
// warehouse, cash drawer, ledger. Frame 0 is that knot ALREADY drawn on
// screen (no logo, no greeting). The film pulls the same thread straight,
// threads five beads on it in one pass, cuts it (offline) and shows the
// thread does not break, then hangs real numbers on it and loops it into
// the mark.
//
// One architecture for the whole film: a single continuous rope.
// Nothing shared with return-flow (104) or landed-cost plates (105).
//
// Governance:
// - one focal stage per scene, subtitle is the only spoken text
// - no divider line, no zoom (noZoom: true), nothing within 24px of the edge
// - audio is cue-based on the bespoke scenes (no word-sync claims)
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  BeadsScene,
  PullStraightScene,
  TangleScene,
  ThreadCtaScene,
  ThreadHoldsScene,
  ThreadLedgerScene,
} from '../scenes/single-thread'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–7.00s) — Frame 0: the knot is already there
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: TangleScene,
        cues: [
          { at: 0.05, kind: 'paperRustle' },
          { at: 0.9, kind: 'pop' },
          { at: 1.6, kind: 'pop' },
          { at: 2.3, kind: 'pop' },
          { at: 4.5, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'نسیه، چک، انبار، صندوق، دفتر؛ هر کدام یک جا، و هیچ‌کدام به هم وصل نیستند.',
    },

    // 2 (7.00–14.00s) — The same thread is pulled straight
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: PullStraightScene,
        cues: [
          { at: 0.15, kind: 'whoosh' },
          { at: 1.1, kind: 'precisionSequence' },
          { at: 2.7, kind: 'impact' },
        ] as Cue[],
      },
      vo: 'حسابچه همین پنج رشته را به یک خط تبدیل می‌کند.',
    },

    // 3 (14.00–21.50s) — Five beads threaded in one pass
    {
      dur: 7.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: BeadsScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.9, kind: 'tick' },
          { at: 1.5, kind: 'tick' },
          { at: 2.1, kind: 'tick' },
          { at: 2.7, kind: 'tick' },
          { at: 3.3, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'هر فروش یک ثبت است؛ و همان یک ثبت، پنج جا را با هم به‌روز می‌کند.',
    },

    // 4 (21.50–28.50s) — Offline: the thread holds instead of breaking
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: ThreadHoldsScene,
        cues: [
          { at: 0.2, kind: 'sceneTransition' },
          { at: 1.0, kind: 'alert' },
          { at: 3.5, kind: 'success' },
        ] as Cue[],
      },
      vo: 'اینترنت قطع شود، نخ پاره نمی‌شود؛ فقط منتظر می‌ماند.',
    },

    // 5 (28.50–36.00s) — Real numbers hang on the thread
    {
      dur: 7.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: ThreadLedgerScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.5, kind: 'cardEnter' },
          { at: 1.4, kind: 'cardEnter' },
          { at: 2.3, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'و وقتی وصل شد، عددهای واقعی — فروش، طلب، سود — سر جایشان می‌نشینند.',
    },

    // 6 (36.00–42.00s) — The thread loops into the mark
    {
      dur: 6.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: ThreadCtaScene,
        cues: [
          { at: 0.2, kind: 'chime' },
          { at: 0.85, kind: 'pop' },
          { at: 2.4, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ یک خط به‌جای پنج دفتر. همین حالا رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel106: Reel = {
  id: '106',
  title: 'یک خط — معرفی حسابچه',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'tense',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'پنج دفتر جدا — نسیه، چک، انبار، صندوق، دفتر — که هیچ‌کدام به هم وصل نیستند و هر عددی را باید دستی جفت کرد.',
    oldWorkflow: 'دفتر کاغذی برای نسیه، تقویم برای چک، شمارش دستی قفسه و صندوق جدا از همه.',
    friction: 'هر فروش باید در پنج جا تکرار شود؛ و هر جا که فراموش شود، یک مغایرت تازه می‌ماند.',
    hisabcheAction:
      'یک ثبت، و همان یک ثبت هم‌زمان موجودی، صندوق، طلب، چک و دفتر را به‌روز می‌کند؛ آفلاین هم نخ پاره نمی‌شود.',
    automatedResult:
      'پنج رشته به یک خط تبدیل می‌شود و عددهای فروش، طلب و سود از همان یک مسیر می‌آیند.',
    businessOutcome: 'پایان کار دوباره و مغایرت بین دفترها؛ یک منبع حقیقت برای کل مغازه.',
    emotionalPayoff: 'خیال راحت از این‌که هیچ فروشی بیرون از دفتر نمی‌ماند.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'TangleRopeReveal',
      'SingleLinePull',
      'BeadThreading',
      'OfflineThreadHold',
      'LedgerOnThread',
      'LoopIntoMark',
    ],
  },
}
