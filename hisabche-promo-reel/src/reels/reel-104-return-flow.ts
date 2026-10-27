// ============================================
// Reel 104 — «سند مرجوعی» (The Return Document)
//
// Story: the customer brings the goods back. The carton crosses the counter
// and the stock goes up — but the ledger and the customer's balance never
// hear about it. Frame 0 is the carton already sliding back, not a logo.
// Hisabche answers with ONE return document that splits into three effects in
// the same beat (stock at cost, cost of goods reversed, receivable down) and
// the trial balance stays level.
//
// Arithmetic kept for the whole film:
//   مرجوعی ۴٬۸۰۰٬۰۰۰ = بهای ۳٬۲۰۰٬۰۰۰ + سود ۱٬۶۰۰٬۰۰۰
//
// Governance:
// - one focal stage per scene, subtitle is the only spoken text
// - no divider line, no zoom (noZoom: true)
// - audio is cue-based on the bespoke scenes (no word-sync claims)
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AtomicReturnScene,
  BalancedScene,
  BooksDontMoveScene,
  ReturnArrivesScene,
  ReturnCtaScene,
  StockOnlyScene,
} from '../scenes/return-flow'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–5.50s) — Frame 0: the carton is already coming back
    {
      dur: 5.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: ReturnArrivesScene,
        cues: [
          { at: 0.05, kind: 'paperRustle' },
          { at: 1.2, kind: 'whoosh' },
          { at: 2.9, kind: 'impact' },
          { at: 4.6, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'جنس برگشت؛ صندوق برگشت؛ اما دفتر حساب هنوز خبر نداره!',
    },

    // 2 (5.50–12.50s) — Only one of the three books noticed
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: StockOnlyScene,
        cues: [
          { at: 0.2, kind: 'cardEnter' },
          { at: 0.7, kind: 'success' },
          { at: 0.95, kind: 'alert' },
          { at: 3.2, kind: 'titleHit' },
        ] as Cue[],
      },
      vo: 'انبار عدد را بالا می‌برد؛ ولی بهای تمام‌شده و طلب مشتری سر جایشان می‌مانند.',
    },

    // 3 (12.50–19.50s) — The books never heard about it: the beam tilts
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: BooksDontMoveScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.1, kind: 'precisionSequence' },
          { at: 3.0, kind: 'alert' },
          { at: 4.4, kind: 'typewriterClick' },
        ] as Cue[],
      },
      vo: 'همین یک ردیف ثبت‌نشده، ترازِ دفتر را از تعادل بیرون می‌برد و مغایرت می‌سازد.',
    },

    // 4 (19.50–27.50s) — One document, three effects, one beat
    {
      dur: 8.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: AtomicReturnScene,
        cues: [
          { at: 0.15, kind: 'chime' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 2.3, kind: 'sync' },
          { at: 3.1, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در حسابچه، یک سند مرجوعی هم‌زمان انبار، بهای تمام‌شده و طلب مشتری را در همان لحظه اصلاح می‌کند.',
    },

    // 5 (27.50–34.50s) — Level again: the trial balance holds
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: BalancedScene,
        cues: [
          { at: 0.1, kind: 'whoosh' },
          { at: 1.2, kind: 'impact' },
          { at: 2.2, kind: 'cardEnter' },
          { at: 3.0, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'انبار بالا، بهای تمام‌شده پایین، طلب کم‌تر؛ تراز آزمایشی دوباره صفر می‌شود.',
    },

    // 6 (34.50–40.50s) — End card
    {
      dur: 6.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: ReturnCtaScene,
        cues: [
          { at: 0.2, kind: 'chime' },
          { at: 0.85, kind: 'pop' },
          { at: 2.4, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'مرجوعی را هم مثل فروش ثبت کن؛ همین حالا رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel104: Reel = {
  id: '104',
  title: 'سند مرجوعی — برگشت کالا، برگشت دفتر',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'tense',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'مشتری جنس را برمی‌گرداند؛ انبار و صندوق عوض می‌شوند اما دفتر و طلب مشتری دست‌نخورده می‌مانند و مغایرت می‌ماند.',
    oldWorkflow: 'ثبت دستی مرجوعی در دفتر کاغذی و فراموش‌کردن بهای تمام‌شده و اصلاح طلب.',
    friction: 'یک ردیف مرجوعی ثبت‌نشده، تراز را از تعادل بیرون می‌برد و سود را کاغذی می‌کند.',
    hisabcheAction:
      'یک سند مرجوعی که هم‌زمان موجودی، بهای تمام‌شده، طلب مشتری و سود را در یک گام اصلاح می‌کند.',
    automatedResult: 'انبار بالا، بهای تمام‌شده پایین، طلب کم‌تر و تراز آزمایشی دوباره متعادل.',
    businessOutcome: 'پایان مغایرت انبار و دفتر در مرجوعی‌ها و سود واقعی به‌جای سود کاغذی.',
    emotionalPayoff: 'اطمینان از این‌که هیچ مرجوعی‌ای بی‌صدا از دفتر جا نمی‌ماند.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'CartonCounterReturn',
      'ThreeLaneBooksSplit',
      'TiltedBalanceBeam',
      'AtomicReturnDocument',
      'LevelBalanceHold',
    ],
  },
}
