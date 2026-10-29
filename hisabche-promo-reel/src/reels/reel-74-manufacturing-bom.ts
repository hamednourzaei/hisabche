// ============================================
// Reel 74: Manufacturing BOM - Accurate Unit Costing (Bespoke Cut)
//
// The Precision Workshop Alchemy & Real-time BOM Engine
// High-conversion industrial costing narrative for manufacturers & workshop producers.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AutomaticMaterialDeductionScene,
  ExactUnitCostBreakdownScene,
  GuessworkCostingCrisisScene,
  InteractiveBomRecipeMatrixScene,
  ManufacturingBomCtaScene,
  WorkshopIndustrialManifestoScene,
} from '../scenes/manufacturing-bom'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Visual Arrest: Guesswork Costing Crisis
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: GuessworkCostingCrisisScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'کارگاه شلوغه و تولید بالاست، ولی قیمت تمام‌شده هر دانه محصول را حدسی می‌زنی؛ سود می‌کنی یا ضرر؟',
    },

    // 2 — Interactive BOM Recipe Matrix
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: InteractiveBomRecipeMatrixScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'scan' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'precisionSequence' },
        ] as Cue[],
      },
      vo: 'در حسابچه فرمول ساخت استاندارد تعریف می‌کنی؛ ضریب مصرف مواد خام، بسته‌بندی و هزینه سربار کارگاه.',
    },

    // 3 — Automatic Material Deduction & Warehouse Sync
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: AutomaticMaterialDeductionScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'sync' },
          { at: 3.5, kind: 'financialMilestone' },
          { at: 5.5, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'با ۱ کلیک ثبت دستور تولید، مواد اولیه خودکار از انبار کسر و کالای ساخته‌شده دقیق به موجودی اضافه می‌شود.',
    },

    // 4 — Exact Unit Cost Breakdown & Real Profit Margin
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: ExactUnitCostBreakdownScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'بهای تمام‌شده هر واحد بر اساس آخرین نرخ خرید انبار محاسبه می‌شود؛ بدون یک ریال تخمین یا خطای انسانی.',
    },

    // 5 — Workshop Industrial Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: WorkshopIndustrialManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 3.2, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'تولید بدون فرمول یعنی قمار با سرمایه؛ با حسابچه ریال به ریال بهای تمام‌شده شفاف است.',
    },

    // 6 — Obsidian Monolith CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: ManufacturingBomCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'سامانه فرمول تولید و قیمت تمام‌شده حسابچه؛ مدیریت حرفه‌ای کارگاه در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel74: Reel = {
  id: '74',
  title: 'فرمول تولید و BOM: قیمت تمام‌شده را حدسی نزن!',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'workshop-producer',
    customerPain:
      'قیمت‌گذاری حسی محصولات تولیدی کارگاه بدون آگاهی از نوسان نرخ مواد اولیه و زیان پنهان',
    oldWorkflow: 'محاسبه دستی روی کاغذ یا تخمین سرانگشتی بهای تمام‌شده هر قلم کالا',
    friction:
      'تولیدکننده پس از ۶ ماه متوجه شد به خاطر گران شدن یکی از مواد خام، با ضرر می‌فروخته است',
    hisabcheAction:
      'ایجاد فرمول ساخت چندلایه (BOM)، کسر اتوماتیک مواد اولیه با ثبت تولید و نرخ‌گذاری لحظه‌ای',
    automatedResult: 'محاسبه آنی بهای تمام‌شده واقعی بر اساس میانگین موزون خرید انبار مواد خام',
    businessOutcome: 'تضمین حاشیه سود کارگاه و امکان رقابت قیمتی هوشمند در بازار تولید',
    emotionalPayoff: 'اطمینان قطعی از سودآوری هر قطعه خروجی از خط تولید',
    cta: 'فرمول تولید در hisabche.com',
    selectedOperators: ['IndustrialCrucible', 'SynchronizedStockTransfer', 'MonolithHoldCta'],
  },
}
