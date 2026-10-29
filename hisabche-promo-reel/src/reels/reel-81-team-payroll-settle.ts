// ============================================
// Reel 81: Team & Payroll Settlement — Dispute-Free Wages (Bespoke Cut)
//
// The Precision Payroll Vault & Biometric Timesheet Matrix
// Arithmetic:
//   ۳۵٬۰۰۰٬۰۰۰ پایه + ۸٬۵۰۰٬۰۰۰ اضافه کاری − ۱۲٬۰۰۰٬۰۰۰ مساعده = ۳۱٬۵۰۰٬۰۰۰ خالص
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AdvanceDeductionScene,
  BiometricTimesheetScene,
  PayrollCtaScene,
  PayrollDilemmaScene,
  PayslipDoubleEntryScene,
  WorkplaceHarmonyScene,
} from '../scenes/team-payroll-settle'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Arrest: The First-of-the-Month Wage Dispute
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: PayrollDilemmaScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.4, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'پایان ماهه؛ کارمند می‌گه اضافه کار داشتم، مدیر می‌گه مساعده گرفتی؛ کی ثبتش کرده؟',
    },

    // 2 — Optical Biometric Timesheet & Realtime Roster
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: BiometricTimesheetScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.4, kind: 'scan' },
          { at: 3.4, kind: 'tick' },
          { at: 5.0, kind: 'success' },
        ] as Cue[],
      },
      vo: 'در حسابچه، ساعات تردد، شیفت‌ها و اضافه کاری هر پرسنل به شکل دیجیتال و دقیق ثبت می‌شود.',
    },

    // 3 — Mid-Month Advances Auto-Deduction
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: AdvanceDeductionScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'tick' },
          { at: 3.6, kind: 'cash' },
          { at: 5.4, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'مساعده‌های دریافتی در طول ماه خودکار از حقوق ناخالص کسر شده و خالص پرداختی شفاف به دست می‌آید.',
    },

    // 4 — Instant Official Payslip & Double-Entry Ledger Stamp
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: PayslipDoubleEntryScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.6, kind: 'scan' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'فیش رسمی صادر می‌شود، پیامک به دست کارمند می‌رسد و سند هزینه حقوق در دفاتر کل ثبت می‌گردد.',
    },

    // 5 — Workplace Harmony Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: WorkplaceHarmonyScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.4, kind: 'whoosh' },
          { at: 3.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حقوق شفاف، احترام متقابل و تیمی باانگیزه؛ بدون حتی یک ریال اختلاف حساب.',
    },

    // 6 — High-Impact Brand Monolith & Conversion CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: PayrollCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'ماژول حقوق و دستمزد حسابچه؛ همین امروز دوره رایگان خود را فعال کنید.',
    },
  ],
  { noZoom: true },
)

export const reel81: Reel = {
  id: '81',
  title: 'حقوق و دستمزد تیم: مساعده، غیبت، اضافه کاری؛ آخر ماه کی چقدر طلبکاره؟',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'درگیری هرماهه میان مدیر و پرسنل بر سر مساعده، اضافه کاری و جریمه تأخیر',
    oldWorkflow: 'نوشتن ساعت ورود و مساعده در سررسید رومیزی و مفقود شدن برگه‌ها',
    friction: 'کارمند احساس بی عدالتی می‌کند و مدیر فکر می‌کند پول اضافه پرداخت کرده است',
    hisabcheAction: 'لینک ثبت تردد اختصاصی کارمند، ثبت آنی مساعده در پرونده و صدور فیش رسمی',
    automatedResult: 'محاسبه ریاضی خودکار، کسر وام و مساعده و صدور سند دوبل هزینه حقوق در دفتر',
    businessOutcome: 'رضایت صد درصدی تیم، انگیزه کاری بالا و انضباط کامل مالی پرسنل',
    emotionalPayoff: 'پایان دعواهای اول ماه و تسویه با لبخند و احترام متقابل',
    cta: 'حقوق و دستمزد در hisabche.com',
    selectedOperators: ['VoxArchivalStamp', 'HighlighterSweep', 'DualBoxCtaHold'],
  },
}
