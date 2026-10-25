// ============================================
// Reel 103 — «موتور استنتاج هوش مصنوعی حسابچه» (Hisabche Inference Engine)
// Style Reference: Modern High-Performance AI Inference Startup Showreel
// Theme: Cyber-Indigo #818cf8 + Neon Cyan #00f5ff + Dark Obsidian #020617
// Duration: 41.2s
// Hard Rule 20: noZoom: true locked across reel & sequence.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AutonomousReasoningLassoScene,
  InferenceEdgeCtaScene,
  InferenceLatencyCrisisScene,
  NeuralTokenStreamScene,
  SpeculativeInferenceMatrixScene,
} from '../scenes/inference-engine'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–7.20s) — The Inference Bottleneck & Latency Wall
    {
      dur: 7.2,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: InferenceLatencyCrisisScene,
        cues: [
          { at: 0.1, kind: 'alert' },
          { at: 1.4, kind: 'clockTickRapid' },
          { at: 3.5, kind: 'titleHit' },
          { at: 5.8, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'مدل هوش مصنوعی داری ولی سرعت پاسخش کنده و کاربرات ثانیه‌ها پشت صفحه لودینگ معطل می‌مونن؟',
    },

    // 2 (7.20–14.40s) — Neural Token Stream & Dynamic KV-Cache Compactor
    {
      dur: 7.2,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: NeuralTokenStreamScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.1, kind: 'dataFlow' },
          { at: 4.8, kind: 'sync' },
          { at: 6.4, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'وقتی توکن‌ها پشت صف پردازش گیر می‌کنن، هم هزینه سرورها سر به فلک می‌کشه و هم کاربر کلافه میشه.',
    },

    // 3 (14.40–25.20s) — 3-Layer Speculative Decoding & Silicon Acceleration
    {
      dur: 10.8,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: SpeculativeInferenceMatrixScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.9, kind: 'precisionSequence' },
          { at: 4.8, kind: 'sparkle' },
          { at: 8.5, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'با موتور استنتاج اختصاصی حسابچه، سرعت پردازش توکن‌ها تا ده برابر بیشتر می‌شه؛ با کمترین تأخیر ممکن در مقیاس میلی‌ثانیه!',
    },

    // 4 (25.20–34.60s) — Autonomous Vector Clustering & Microsecond Anomaly Lock
    {
      dur: 9.4,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: AutonomousReasoningLassoScene,
        cues: [
          { at: 0.4, kind: 'cardEnter' },
          { at: 2.8, kind: 'scan' },
          { at: 6.5, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'کوچک‌ترین مغایرت، تقلب مالی یا الگوی رفتار خرید در کسری از میلی‌ثانیه کشف، تحلیل و قرنطینه میشه.',
    },

    // 5 (34.60–41.20s) — Global Edge Mesh & Developer Sandbox Key CTA
    {
      dur: 6.6,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: InferenceEdgeCtaScene,
        cues: [
          { at: 0.3, kind: 'typewriterClick' },
          { at: 2.0, kind: 'ctaResolution' },
          { at: 4.6, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'همین حالا کلمه «هوش» رو بفرست تا کلید دسترسی به موتور پردازش سریع رو آنی دریافت کنی!',
    },
  ],
  { noZoom: true },
)

export const reel103: Reel = {
  id: '103',
  title: 'موتور استنتاج هوش مصنوعی حسابچه — پردازش فوق‌سریع در مقیاس میلی‌ثانیه',
  duration: total(scenes),
  scenes,
  theme: 'cyber-emerald',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'services',
    customerPain: 'تأخیر بالا در استنتاج مدل‌های هوش مصنوعی و هزینه‌های گزاف کلاسترهای پردازش',
    oldWorkflow: 'صف‌بندی کند و ترتیبی با حباب‌های خالی در هسته‌های کارت گرافیک',
    friction: 'ریزش کاربران به دلیل معطلی و افت دقت در حجم بالای درخواست‌های هم‌زمان',
    hisabcheAction: 'موتور استنتاج با رمزگشایی گمانه‌زن و فشرده‌سازی خودکار کش حافظه',
    automatedResult: 'افزایش ۱۰ برابری توان عملیاتی توکن‌ها و کاهش ۸۵ درصدی تأخیر پاسخ',
    businessOutcome: 'پاسخ‌دهی آنی به میلیون‌ها کوئری مالی و شناسایی بلادرنگ تقلب و مغایرت',
    emotionalPayoff: 'افتخار به زیرساخت هوش مصنوعی فوق‌سریع و پایدار در کلاس جهانی',
    cta: 'ارسال کلمه «هوش» برای دریافت کلید دسترسی به ساندباکس تست رایگان',
    selectedOperators: [
      'MatrixSystolicGrid',
      'NeuralTokenStream',
      'SpeculativeSiliconCore',
      'VectorClusterRadar',
      'InstantApiGateway',
    ],
  },
}
