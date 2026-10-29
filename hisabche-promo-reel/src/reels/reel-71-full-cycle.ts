// ============================================
// Reel 71: Full Cycle - Unified Commerce Loop (Bespoke Cut)
//
// The Grand Unified Commerce Loop & 5-in-1 Atomic Synchronization
// High-conversion enterprise ERP narrative for modern merchants & distributors.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  Atomic5In1InvoicePulseScene,
  FragmentedSilosImpasseScene,
  FullCycleCtaScene,
  LiveBusinessHealthTelemetryScene,
  QuantumCoreNexusScene,
  UnifiedEmpireManifestoScene,
} from '../scenes/full-cycle'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — Frame-0 Visual Arrest: Fragmented Silos Impasse
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: FragmentedSilosImpasseScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'alert' },
          { at: 2.5, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'یک فاکتور فروش صادر می‌شه، ولی انبار، بانک، دفتر کل و تولید هرکدوم یک ساز می‌زنند؛ چقدر دوباره‌کاری و مغایرت؟',
    },

    // 2 — Quantum Core Nexus (Unified Engine)
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: QuantumCoreNexusScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.5, kind: 'scan' },
          { at: 3.5, kind: 'tick' },
          { at: 5.5, kind: 'precisionSequence' },
        ] as Cue[],
      },
      vo: 'در حسابچه، تمام ارکان کسب‌وکار به یک هسته متمرکز متصل هستند؛ با یک تغییر، تمام دفاتر همزمان تراز می‌شوند.',
    },

    // 3 — Atomic 5-in-1 Invoice Pulse
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: Atomic5In1InvoicePulseScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.8, kind: 'sync' },
          { at: 3.5, kind: 'financialMilestone' },
          { at: 5.5, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'با ۱ کلیک تایید فاکتور، ۵ ثبت همزمان در کسری از ثانیه انجام می‌شود: کسر انبار، سند دوبل، ثبت طلب، هشدار چک و سود قطعی.',
    },

    // 4 — Live Business Health Telemetry
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'financial-intelligence',
        component: LiveBusinessHealthTelemetryScene,
        cues: [
          { at: 0.2, kind: 'cinematicReveal' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 3.8, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'مدیر در هر لحظه روی موبایل یا دسکتاپ، سود واقعی، مانده نقدینگی و ترازنامه زنده کسب‌وکار را شفاف می‌بیند.',
    },

    // 5 — Unified Empire Manifesto
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: UnifiedEmpireManifestoScene,
        cues: [
          { at: 0.2, kind: 'titleHit' },
          { at: 1.5, kind: 'whoosh' },
          { at: 3.2, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'کسب‌وکار جزیره نیست، همه چیز به هم پیوسته است؛ با حسابچه صفر خطای انسانی و آرامش کامل را تجربه کنید.',
    },

    // 6 — Obsidian Monolith CTA
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'obsidian-cinematic',
        component: FullCycleCtaScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.5, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'سامانه یکپارچه مالی، انبار و فروش حسابچه؛ چرخه کامل کسب‌وکار در hisabche.com.',
    },
  ],
  { noZoom: true },
)

export const reel71: Reel = {
  id: '71',
  title: 'سناریوی ترکیبی: چرخه کامل کسب‌وکار از فروش تا تسویه',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain:
      'ناهماهنگی بین بخش‌های فروش، انبارداری، حسابداری مالی و چک‌های صیادی و اتلاف وقت مکرر',
    oldWorkflow:
      'ثبت فاکتور در اکسل، کنترل موجودی روی کاغذ، ثبت سند دستی با تاخیر چندماهه در دفاتر',
    friction:
      'سفارش ثبت شد اما کالا در انبار نبود، چک مشتری برگشت خورد و سود واقعی معامله مشخص نشد',
    hisabcheAction:
      'اتصال همزمان تمام ارکان تجارت به یک هسته زنده با ثبت اتمیک فاکتور و تراز خودکار',
    automatedResult:
      'یک کلیک = همگام‌سازی ۵ گانه کاردکس، سند حسابداری، پرونده مشتری، چک و حاشیه سود',
    businessOutcome: 'حذف کامل مغایرت‌های مالی، تسریع ۱۰۰ درصدی تسویه و دسترسی به سود قطعی در لحظه',
    emotionalPayoff: 'تسلط امپراتوری‌وار بر تمام جنبه‌های تجارت و خواب آرام شبانه',
    cta: 'چرخه کامل در hisabche.com',
    selectedOperators: ['QuantumCoreOrbit', 'Atomic5SyncPulse', 'MonolithHoldCta'],
  },
}
