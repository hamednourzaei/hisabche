// ============================================
// Reel 93 — «عدد داخل مه — سود واقعی پشت صد فاکتور» (dusk-fog bespoke film) · 45 s
//
// Bespoke Motion Engine: LiDAR Prism & Volumetric Profit Beacon
// (سامانه لایدار فوتونیک و منشور شکست مه مالی)
//
// One persistent arithmetic:
//   ۲٬۴۶۰٬۰۰۰ فروش − ۱٬۶۲۰٬۰۰۰ بهای تمام‌شده − ۳۸۵٬۰۰۰ خرج = ۴۵۵٬۰۰۰ سود خالص
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  ClearRevealScene,
  FogCtaScene,
  FogNumberScene,
  LedgerFootScene,
  PaperWallScene,
  PartClearScene,
} from '../scenes/dusk-fog'
import { sequence, total } from './shared'

const scene = (component: typeof FogNumberScene, cues: Cue[]) =>
  ({ kind: 'bespoke', theme: 'dusk-fog', component, cues }) as const

const scenes = sequence(
  [
    // 1 (0–8s, 8s) — The figure spins in dusk fog, unreadable on purpose.
    {
      dur: 8,
      spec: scene(FogNumberScene, [
        { at: 0.05, kind: 'impact' },
        { at: 0.6, kind: 'whoosh' },
        { at: 2.0, kind: 'dataFlow' },
        { at: 4.8, kind: 'cinematicReveal' },
      ]),
      vo: 'امشب یک عدد سود در ذهنت داری؛ اما کجاست؟ میان انبوه تراکنش‌ها ناپدید شده است.',
    },

    // 2 (8–16s, 8s) — Cascade of acrylic invoice panes blocking the view.
    {
      dur: 8,
      spec: scene(PaperWallScene, [
        { at: 0.02, kind: 'cardEnter' },
        { at: 1.1, kind: 'paperRustle' },
        { at: 2.0, kind: 'paperTear' },
        { at: 5.5, kind: 'alert' },
      ]),
      vo: 'پشت صد فاکتور، رسید انبار و قبض کرایه، سود واقعیت مدفون شده و دیده نمی‌شود.',
    },

    // 3 (16–25s, 9s) — LiDAR laser sweeps, fog lifts, and the figure sharpens.
    {
      dur: 9,
      spec: scene(PartClearScene, [
        { at: 0.02, kind: 'cameraSwish' },
        { at: 1.0, kind: 'precisionSequence' },
        { at: 3.5, kind: 'dataFlow' },
        { at: 6.0, kind: 'insightReveal' },
      ]),
      vo: 'سیستم لایدار حسابچه اسناد را منظم می‌کند، مه را کنار می‌زند و عدد واقعی شفاف می‌شود.',
    },

    // 4 (25–35s, 10s) — Monolithic crystalline prism reveals the pure net profit.
    {
      dur: 10,
      spec: scene(ClearRevealScene, [
        { at: 0.05, kind: 'titleHit' },
        { at: 0.8, kind: 'bigReveal' },
        { at: 2.5, kind: 'financialMilestone' },
        { at: 6.5, kind: 'chime' },
      ]),
      vo: 'سود خالص واقعی؛ چهارصد و پنجاه و پنج هزار. عددی تمیز، بدون حتی یک ریال خطا.',
    },

    // 5 (35–40s, 5s) — The three decomposition rails (sales, cogs, expenses).
    {
      dur: 5,
      spec: scene(LedgerFootScene, [
        { at: 0.02, kind: 'cardEnter' },
        { at: 0.9, kind: 'cardEnter' },
        { at: 1.6, kind: 'cardEnter' },
        { at: 2.5, kind: 'successResolution' },
      ]),
      vo: 'فروش، بهای تمام‌شده و خرج‌ها؛ همه پایه‌های حساب زنده و هماهنگ پیش چشمان توست.',
    },

    // 6 (40–45s, 5s) — Clear horizon & tactile CTA with seamless loop.
    {
      dur: 5,
      spec: scene(FogCtaScene, [
        { at: 0.02, kind: 'ctaResolution' },
        { at: 0.5, kind: 'chime' },
        { at: 4.6, kind: 'pop' },
      ]),
      vo: 'حسابچه؛ پایان ابهام دخل و سود. همین امشب رایگان امتحان کن و حساب شفاف داشته باش.',
    },
  ],
  { noZoom: true },
)

export const reel93: Reel = {
  id: '93',
  title: 'عدد داخل مه — سود واقعی پشت صد فاکتور',
  duration: total(scenes),
  scenes,
  theme: 'dusk-fog',
  musicMood: 'uplifting',
  noZoom: true,
}
