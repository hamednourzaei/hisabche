// ============================================
// Reel 73: Till Shift Balance - Zero Cash Shortage (Bespoke Cut)
//
// The Golden Till Vault, Precision Shift Cash Reconciler & Soulful Night Closure
// Complies strictly with Layout Defect Law 11
// High-conversion cash integrity narrative for retailers & multi-shift stores.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  CashierIntegrityManifestoScene,
  InteractiveCashReconciliationScene,
  ShiftDiscrepancyPanicScene,
  ShiftHandoverProtocolScene,
  SoulfulNightClosureScene,
  TillShiftCtaScene,
} from '../scenes/till-shift-balance'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Visual Arrest: Shift Discrepancy Panic
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: ShiftDiscrepancyPanicScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'ساعت ۱۰ شب موقع بستن دخل، صندوق و سیستم با هم نمی‌خوانند؛ کسری صندوق از جیب کی می‌ره؟',
    },

    // 2 — Interactive Cash Reconciliation Matrix
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: InteractiveCashReconciliationScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'scan' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'cash' },
        ] as Cue[],
      },
      vo: 'در حسابچه، فروش نقدی و تراکنش‌های پوز هوشمندانه تطبیق داده می‌شوند؛ مغایرت دخل به صفر مطلق می‌رسد.',
    },

    // 3 — Digital Shift Handover Protocol
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: ShiftHandoverProtocolScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'sync' },
          { at: 3.5, kind: 'financialMilestone' },
          { at: 5.5, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'با صورت‌جلسه دیجیتال، صندوقدار صبح تحویل می‌دهد و صندوقدار عصر تایید می‌کند؛ بدون سوءتفاهم یا اختلاف.',
    },

    // 4 — Soulful Night Closure (Layout Defect Law 11)
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: SoulfulNightClosureScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.8, kind: 'whoosh' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'کرکره مغازه پایین می‌آید، قفل زده می‌شود؛ دخل تراز و شب آرام بازار، با خیالی آسوده به خانه برگرد.',
    },

    // 5 — Cashier Integrity Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: CashierIntegrityManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 3.2, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'صندوق شفاف، احترام و عزت پرسنل است؛ با حسابچه ریال به ریال زحمت شما محفوظ است.',
    },

    // 6 — Obsidian Monolith CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-gold',
        component: TillShiftCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'مدیریت شیفت و بستن صندوق در حسابچه؛ دخل تراز و آرامش کامل در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel73: Reel = {
  id: '73',
  title: 'تحویل شیفت و بستن صندوق: دخل و سیستم یک ریال هم اختلاف ندارند!',
  duration: total(scenes),
  scenes,
  theme: 'midnight-gold',
  musicMood: 'calm',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'کسری صندوق در پایان روز کاری، مشاجره بین شیفت صبح و عصر و سوءظن میان همکاران',
    oldWorkflow: 'شمارش سرانگشتی پول نقد و مقایسه با فیش‌های کارتخوان روی کاغذهای پاره',
    friction: 'صندوقدار ۵۰۰ هزار تومان کسری آورد و شیفت قبل مدعی شد پول را کامل تحویل داده است',
    hisabcheAction:
      'ماژول بستن شیفت، تطبیق خودکار تراکنش‌های بانکی پوز با اسکناس‌های ثبت‌شده و رسید دیجیتال تحویل',
    automatedResult: 'گزارش مغایرت صفر و ثبت تاییدیه دوطرفه تحویل کشوی دخل با ساعت دقیق',
    businessOutcome: 'حذف کامل کسری‌های پنهان نقدینگی و حفظ اعتماد و صمیمیت در تیم فروش',
    emotionalPayoff: 'آرامش عمیق شبانه هنگام بستن کرکره مغازه و پایان شیفت',
    cta: 'بستن صندوق در hisabche.com',
    selectedOperators: ['GoldenTillVault', 'SoulfulNightShutter', 'MonolithHoldCta'],
  },
}
