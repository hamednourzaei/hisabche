// ============================================
// Reel 75: Customer Credit Limit - Receivables Risk Shield (Bespoke Cut)
//
// The Titanium Credit Sentinel & Holographic Risk Gate
// High-conversion receivables risk control narrative for merchants & wholesalers.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AutomatedLockGateScene,
  CreditLimitCtaScene,
  CreditLimitImpasseScene,
  InteractiveRiskGaugeScene,
  ReceivablesProtectionManifestoScene,
  SettlementGateReleaseScene,
} from '../scenes/customer-credit-limit'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Visual Arrest: The Credit Limit Impasse
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: CreditLimitImpasseScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'مشتری پای پیشخوان جنس نسیه می‌خواد، ولی حساب قبلیش هنوز تسویه نشده؛ تعارف می‌کنی یا سیستم جلوت رو می‌گیره؟',
    },

    // 2 — Interactive Risk Gauge & Customer Credit Ledger
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: InteractiveRiskGaugeScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'scan' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'در حسابچه، برای هر مشتری سقف اعتبار نسیه تعیین می‌کنی؛ سیستم دیرکردها و چک‌های وصول‌نشده را لحظه‌ای رصد می‌کند.',
    },

    // 3 — Automated Lock Gate & Frictionless Rejection
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: AutomatedLockGateScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'impact' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'حسابچه تعارف ندارد؛ با عبور از سقف مجاز، صدور فاکتور نسیه خودکار قفل می‌شود و رودربایستی با مشتری پایان می‌یابد.',
    },

    // 4 — Instant Settlement & Gate Release
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: SettlementGateReleaseScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.5, kind: 'cash' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'مشتری بدهی قبلی را تسویه می‌کند؛ بلافاصله سقف اعتبار آزاد و فاکتور جدید بدون ریسک صادر می‌شود.',
    },

    // 5 — Receivables Protection Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: ReceivablesProtectionManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 3.2, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'رودربایستی در نسیه یعنی ورشکستگی خاموش؛ بگذار سیستم به‌جای تو «نه» بگوید تا سرمایه‌ات حفظ شود.',
    },

    // 6 — Obsidian Monolith CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'dark-neon',
        component: CreditLimitCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'مدیریت هوشمند سقف اعتبار مشتری در حسابچه؛ دخل آرام و بدون بدهی سوخت‌شده در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel75: Reel = {
  id: '75',
  title: 'سقف اعتبار مشتری و هشدار بدهی: تا تسویه نکنه، نسیه نده!',
  duration: total(scenes),
  scenes,
  theme: 'dark-neon',
  musicMood: 'tense',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'رودربایستی با مشتریان قدیمی، انباشت بدهی معوق و سوخت شدن سرمایه در گردش',
    oldWorkflow: 'نسیه دادن سنتی با تکیه بر حافظه یا اعتماد بی‌قاعده بدون کنترل سررسید',
    friction:
      'شاگرد بدون اطلاع مدیر فاکتور نسیه کلان صادر کرد در حالی که مشتری بدهی میلیونی تسویه‌نشده داشت',
    hisabcheAction:
      'تنظیم سقف اعتبار مجاز در پرونده مشتری و قفل خودکار ثبت فاکتور نسیه در نقطه بحرانی',
    automatedResult: 'مسدودسازی آنی فاکتور نسیه مازاد بر سقف تا زمان تسویه بدهی‌های معوق',
    businessOutcome: 'کاهش ۱۰۰ درصدی مطالبات سوخت‌شده و تسریع چشمگیر در وصول نقدی',
    emotionalPayoff: 'رهایی از تعارف و اضطراب طلب‌های وصول‌نشده',
    cta: 'سقف اعتبار در hisabche.com',
    selectedOperators: ['SentinelLockGate', 'HolographicGaugeSweep', 'MonolithHoldCta'],
  },
}
