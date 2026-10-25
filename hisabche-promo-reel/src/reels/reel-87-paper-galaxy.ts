// ============================================
// Reel 87 — «شبِ کاغذها» (paper-galaxy bespoke film)
//
// Deep-indigo merchant sky. Ghost receipts drift far beyond the shop's
// ceiling; unclaimed papers burn out like dying stars. The Hisabche core
// ignites as a gravity field, bends every drifting sheet along luminous
// field lines, and settles them into one orbiting ledger ring — which then
// re-enters the shop's phone as a live dashboard.
//
// One persistent arithmetic:
//   ۷٬۳۲۰٬۰۰۰ فروش − ۴٬۶۱۰٬۰۰۰ بهای تمام‌شده = ۲٬۷۱۰٬۰۰۰ سود
//   طلب ۱٬۹۵۰٬۰۰۰ · انبار ۲۱۴
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  GalaxyBurstScene,
  GalaxyCtaScene,
  GhostDriftScene,
  GravityIgniteScene,
  OrbitLedgerScene,
  ReentryDashScene,
} from '../scenes/paper-galaxy'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0–4s) — frame-0: one receipt burns mid-everyday, papers everywhere.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'paper-galaxy',
        component: GalaxyBurstScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 0.35, kind: 'whoosh' },
          { at: 0.8, kind: 'paperRustle' },
          { at: 1.2, kind: 'insightReveal' },
          { at: 2.9, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'شب فاکتور می‌نویسی، صبح اثرش در دخل نیست.',
    },

    // 2 (4–11s) — the unclaimed pile keeps drifting; the pile is the problem.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'paper-galaxy',
        component: GhostDriftScene,
        cues: [
          { at: 0, kind: 'cinematicReveal' },
          { at: 0.5, kind: 'paperRustle' },
          { at: 1.8, kind: 'cardEnter' },
          { at: 3.2, kind: 'softTransition' },
          { at: 5.6, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'همان رسیدها بی‌صاحب در آسمان سرگردان‌اند و می‌سوزند.',
    },

    // 3 (11–19s) — the Hisabche core ignites and bends the stream.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'paper-galaxy',
        component: GravityIgniteScene,
        cues: [
          { at: 0, kind: 'bigReveal' },
          { at: 0.3, kind: 'dataFlow' },
          { at: 1.2, kind: 'insightReveal' },
          { at: 2.7, kind: 'precisionSequence' },
          { at: 4.4, kind: 'financialMilestone' },
          { at: 6.8, kind: 'sync' },
        ] as Cue[],
      },
      vo: 'حسابچه همه کاغذها را به یک هسته می‌کشاند.',
    },

    // 4 (19–30s) — the orbit ledger: sales, cost, profit, receivable, stock.
    {
      dur: 11,
      spec: {
        kind: 'bespoke',
        theme: 'paper-galaxy',
        component: OrbitLedgerScene,
        cues: [
          { at: 0, kind: 'majorReveal' },
          { at: 0.25, kind: 'cardEnter' },
          { at: 0.7, kind: 'cardEnter' },
          { at: 1.15, kind: 'financialMilestone' },
          { at: 1.6, kind: 'financialMilestone' },
          { at: 3.6, kind: 'cash' },
          { at: 7.4, kind: 'precisionSequence' },
          { at: 9.8, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'فروش هفت میلیون و دویست و بیست هزار، بهای تمام‌شده چهار میلیون و ششصد و ده هزار، سود دو میلیون و هفتصد و ده هزار، طلب یک میلیون و نهصد و پنجاه هزار، انبار دویست و چهارده عدد.',
    },

    // 5 (30–40s) — re-entry: the orbit lands as the shop's phone dashboard.
    {
      dur: 10,
      spec: {
        kind: 'bespoke',
        theme: 'paper-galaxy',
        component: ReentryDashScene,
        cues: [
          { at: 0, kind: 'cameraSwish' },
          { at: 0.4, kind: 'whoosh' },
          { at: 2.2, kind: 'cinematicReveal' },
          { at: 3.0, kind: 'cardEnter' },
          { at: 4.4, kind: 'sync' },
          { at: 7.6, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'همان حلقه روی صفحه گوشی مغازه می‌نشیند و زنده می‌شود.',
    },

    // 6 (40–45s) — constellation lockup + CTA hold.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'paper-galaxy',
        component: GalaxyCtaScene,
        cues: [
          { at: 0, kind: 'ctaResolution' },
          { at: 0.3, kind: 'bigReveal' },
          { at: 0.95, kind: 'chime' },
          { at: 2.2, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'کاغذها دفتر می‌شوند؛ حسابچه، دفتر واقعی مغازه‌ات. شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel87: Reel = {
  id: '87',
  title: 'شبِ کاغذها — رسیدهای بی‌صاحب به حلقه‌ی دفتر می‌پیوندند',
  duration: total(scenes),
  scenes,
  theme: 'paper-galaxy',
  musicMood: 'tense',
  noZoom: true,
}
