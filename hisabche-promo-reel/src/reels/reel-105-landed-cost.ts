// ============================================
// Reel 105 — «بهای تمام‌شده» (The Landed Cost)
//
// Story: the price tag on the carton reads the PURCHASE price. One after
// another, physical copper plates drop onto that tag — freight, customs,
// insurance — and the tag stretches until the number is bigger than the sale
// price. Frame 0 is the carton already on the counter with its tag hanging,
// not a logo.
//
// Arithmetic kept for the whole film:
//   خرید ۱٬۲۰۰٬۰۰۰ + کرایه ۱۸۰٬۰۰۰ + گمرک ۲۲۰٬۰۰۰ + بیمه ۴۰٬۰۰۰ = ۱٬۶۴۰٬۰۰۰
//   فروش ۱٬۵۰۰٬۰۰۰ − ۱٬۶۴۰٬۰۰۰ = ۱۴۰٬۰۰۰ ضرر در هر واحد · ۲۰ واحد = ۲٬۸۰۰٬۰۰۰
//
// Governance:
// - one focal stage per scene, subtitle is the only spoken text
// - no divider line, no zoom (noZoom: true), nothing within 24px of the edge
// - audio is cue-based on the bespoke scenes (no word-sync claims)
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  CrossOverScene,
  HiddenLossScene,
  LandedCtaScene,
  LandedDocumentScene,
  LandedHookScene,
  MarginHoldScene,
} from '../scenes/landed-cost-plates'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–6.00s) — Frame 0: the tag already hanging, the plates land
    {
      dur: 6.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: LandedHookScene,
        cues: [
          { at: 0.05, kind: 'paperRustle' },
          { at: 1.5, kind: 'impact' },
          { at: 2.7, kind: 'impact' },
          { at: 3.9, kind: 'impact' },
          { at: 4.4, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'قیمت روی برچسب را زده‌ای؛ ولی کرایه و گمرک هم روی همان کارتن نشسته.',
    },

    // 2 (6.00–12.50s) — The sale line and the cost stack cross over
    {
      dur: 6.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: CrossOverScene,
        cues: [
          { at: 0.1, kind: 'whoosh' },
          { at: 0.6, kind: 'dataFlow' },
          { at: 3.4, kind: 'titleHit' },
        ] as Cue[],
      },
      vo: 'خط فروش و پشته‌ی بهای تمام‌شده از هم رد می‌شوند؛ آن‌وقت تازه می‌فهمی هر واحد ضرر داشته.',
    },

    // 3 (12.50–19.00s) — Twenty cartons: the hidden loss multiplies
    {
      dur: 6.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: HiddenLossScene,
        cues: [
          { at: 0.1, kind: 'cardEnter' },
          { at: 0.4, kind: 'tick' },
          { at: 2.2, kind: 'financialMilestone' },
          { at: 4.6, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'بیست کارتن، بیست بار همان اختلاف؛ ضرری که هیچ‌جا نوشته نشده.',
    },

    // 4 (19.00–26.00s) — One landed-cost document, one real unit cost
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: LandedDocumentScene,
        cues: [
          { at: 0.2, kind: 'sceneTransition' },
          { at: 1.0, kind: 'typewriterClick' },
          { at: 3.0, kind: 'precisionSequence' },
          { at: 3.6, kind: 'success' },
        ] as Cue[],
      },
      vo: 'یک سند بهای تمام‌شده، خرید و کرایه و گمرک و بیمه را روی همان کالا می‌نشاند.',
    },

    // 5 (26.00–31.50s) — Margin, held
    {
      dur: 5.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: MarginHoldScene,
        cues: [
          { at: 0.1, kind: 'softTransition' },
          { at: 0.5, kind: 'pop' },
          { at: 1.4, kind: 'cash' },
          { at: 2.4, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حالا قیمت روی بهای واقعی می‌نشیند و سود هر واحد روی کاغذ نمی‌ماند.',
    },

    // 6 (31.50–37.00s) — End card
    {
      dur: 5.5,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: LandedCtaScene,
        cues: [
          { at: 0.2, kind: 'chime' },
          { at: 1.0, kind: 'pop' },
          { at: 2.4, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'بهای واقعی را ببین، سود واقعی را بگیر؛ همین حالا رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel105: Reel = {
  id: '105',
  title: 'بهای تمام‌شده — سود کاغذی، ضرر واقعی',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'tense',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'قیمت روی کالا فقط قیمت خرید است؛ کرایه و گمرک و بیمه دیده نمی‌شود و هر فروش بی‌صدا ضرر می‌سازد.',
    oldWorkflow: 'هزینه‌های جانبی در دفتر جدا نوشته می‌شود و روی بهای کالا نمی‌نشیند.',
    friction: 'سود روی کاغذ مثبت است، در حالی که هر واحد زیر بهای واقعی فروخته می‌شود.',
    hisabcheAction: 'یک سند بهای تمام‌شده که خرید، کرایه، گمرک و بیمه را روی همان کالا جمع می‌کند.',
    automatedResult: 'بهای واقعی هر واحد، حاشیه‌ی واقعی و ضرر پنهان یک‌جا دیده می‌شود.',
    businessOutcome: 'قیمت‌گذاری روی بهای واقعی و پایان فروش زیر قیمت جایگزینی.',
    emotionalPayoff: 'اطمینان از این‌که هیچ هزینه‌ای بیرون از حساب کالا نمی‌ماند.',
    cta: 'شروع رایگان در hisabche.com',
    selectedOperators: [
      'HangingPriceTagStretch',
      'CostPlateDrop',
      'CostStackCrossOver',
      'CartonGridMultiplier',
      'LandedCostDocument',
      'MarginBarHold',
    ],
  },
}
