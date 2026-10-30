// ============================================
// Reel 108 — «رادار نقدینگی» (The Cashflow Radar)
//
// The Quantum Sonar & Live Telemetry Cockpit
// High-tech financial observability engine for modern enterprise merchants.
//
// Creative Innovation:
// - A completely new visual paradigm: Dark Holographic Oscilloscope & Sonar Radar HUD.
// - 360-degree radial sweep identifying latent anomalies (unconfirmed invoice, inventory gap, due cheque).
// - Interactive financial turbulence waveform harmonizing into a stable green carrier wave.
// - 5-satellite telemetry convergence with the central Hisabche core.
// - 100% compliant with Layout Defect Laws (no zoom, safe area margins >= 24px, no divider lines).
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  AnomalyBlipScene,
  CockpitStabilityScene,
  RadarCtaScene,
  RadarSweepScene,
  TelemetryLockScene,
  WaveformHarmonicsScene,
} from '../scenes/cashflow-radar'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0.00–7.00s) — Blind Radar Sweep
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: RadarSweepScene,
        cues: [
          { at: 0.1, kind: 'scan' },
          { at: 2.5, kind: 'whoosh' },
          { at: 4.8, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'کسب‌وکارت دخل شلوغی داره، اما ته ماه پول کجاست؟',
    },

    // 2 (7.00–14.00s) — Anomaly Blips Target Lock
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: AnomalyBlipScene,
        cues: [
          { at: 0.3, kind: 'alert' },
          { at: 1.2, kind: 'impact' },
          { at: 2.1, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'خرده‌نشت‌های پنهان، بدون رادار، آرام‌آرام به بهمن مغایرت تبدیل می‌شوند.',
    },

    // 3 (14.00–21.00s) — Oscilloscope Waveform Harmonization
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: WaveformHarmonicsScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'precisionSequence' },
          { at: 4.0, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'وقتی دفاتر مالی همگام نیستند، جریان وجوه دچار نوسان کور است؛ اما با حسابچه تراز می‌شود.',
    },

    // 4 (21.00–28.00s) — Telemetry Lock: 5-Satellite Convergence
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: TelemetryLockScene,
        cues: [
          { at: 0.2, kind: 'dataFlow' },
          { at: 1.0, kind: 'sync' },
          { at: 3.5, kind: 'success' },
        ] as Cue[],
      },
      vo: 'یکپارچگی یعنی هر ثبت فاکتور، در همان ثانیه در تمام ستون‌ها منعکس شود.',
    },

    // 5 (28.00–35.00s) — Executive Cockpit Stability
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: CockpitStabilityScene,
        cues: [
          { at: 0.2, kind: 'chime' },
          { at: 0.8, kind: 'tick' },
          { at: 1.4, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'خواب آرام شبانه، محصول اشراف در لحظه به تمام ارکان تجارت است.',
    },

    // 6 (35.00–42.00s) — Command Flight Deck CTA
    {
      dur: 7.0,
      spec: {
        kind: 'bespoke',
        theme: 'cyber-emerald',
        component: RadarCtaScene,
        cues: [
          { at: 0.1, kind: 'titleHit' },
          { at: 2.0, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'رادار هوشمند مدیریت مالی و حسابداری با حسابچه. شروع در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel108: Reel = {
  id: '108',
  title: 'رادار نقدینگی و سنسور پالس زنده کسب‌وکار',
  duration: total(scenes),
  scenes,
  theme: 'cyber-emerald',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'بی‌اطلاعی از نشت‌های پنهان سود و کسری نقدینگی در پایان ماه با وجود دخل شلوغ',
    oldWorkflow: 'بررسی دیرهنگام گزارش‌های ماهانه حسابداری وقتی مغایرت‌ها به بحران تبدیل شده‌اند',
    friction: 'تعهدات چک و نسیه‌ها غافلگیرکننده می‌شوند و سود واقعی پنهان می‌ماند',
    hisabcheAction: 'پایش راداری و بلادرنگ تمام جریان‌های ورودی و خروجی با سنسورهای هشدار هوشمند',
    automatedResult:
      'شناسایی لحظه‌ای مغایرت‌ها، تراز خودکار دفاتر و تثبیت پیش‌بینانه جریان نقدینگی',
    businessOutcome: 'کنترل ۱۰۰ درصدی بر تمام ابعاد سرمایه و جلوگیری از غافلگیری مالی',
    emotionalPayoff: 'فرماندهی مقتدرانه بر امپراتوری تجاری و آرامش کامل شبانه',
    cta: 'رادار هوشمند در hisabche.com',
    selectedOperators: ['CashflowSonarSweep', 'OscilloscopeHarmonics', 'TelemetryNexusLock'],
  },
}
