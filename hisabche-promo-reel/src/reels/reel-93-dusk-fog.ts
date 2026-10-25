// ============================================
// Reel 93 — «عدد داخل مه» (dusk-fog bespoke film, open-loop mystery)
//
// A blurred figure floats in dusk fog and slowly sharpens — but every time
// the owner reaches for it, a fanned deck of blank sheets closes over it
// like a hand of cards. The deck then fans out, the fog lifts, and the
// figure publishes itself as the day's true net profit, with its three
// ledger footings beneath it.
//
// One persistent arithmetic:
//   ۲٬۴۶۰٬۰۰۰ فروش − ۱٬۶۲۰٬۰۰۰ بهای تمام‌شده − ۳۸۵٬۰۰۰ خرج = ۴۵۵٬۰۰۰ سود
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

const scenes = sequence(
  [
    // 1 (0–8s) — the figure spins in dusk fog, unreadable on purpose.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'dusk-fog',
        component: FogNumberScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 0.6, kind: 'whoosh' },
          { at: 2.0, kind: 'dataFlow' },
          { at: 4.8, kind: 'cinematicReveal' },
          { at: 7.0, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'امشب یک عدد سود در ذهنت داری، اما کجاست؟',
    },

    // 2 (8–16s) — a deck of blank sheets closes over the figure.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'dusk-fog',
        component: PaperWallScene,
        cues: [
          { at: 0, kind: 'cardEnter' },
          { at: 1.5, kind: 'paperRustle' },
          { at: 3.8, kind: 'paperTear' },
          { at: 5.5, kind: 'alert' },
          { at: 7.2, kind: 'sceneTransition' },
        ] as Cue[],
      },
      vo: 'پشت صد فاکتور و برگه، سود واقعیت پنهان مانده است.',
    },

    // 3 (16–25s) — the deck fans out, fog lifts, and figure starts to resolve.
    {
      dur: 9,
      spec: {
        kind: 'bespoke',
        theme: 'dusk-fog',
        component: PartClearScene,
        cues: [
          { at: 0, kind: 'cameraSwish' },
          { at: 1.2, kind: 'cardThock' },
          { at: 3.5, kind: 'dataFlow' },
          { at: 6.0, kind: 'insightReveal' },
          { at: 8.0, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'برگه‌ها کنار می‌روند و مه آرام‌آرام باز می‌شود.',
    },

    // 4 (25–35s) — the figure publishes itself: clean true net profit.
    {
      dur: 10,
      spec: {
        kind: 'bespoke',
        theme: 'dusk-fog',
        component: ClearRevealScene,
        cues: [
          { at: 0, kind: 'titleHit' },
          { at: 1.5, kind: 'bigReveal' },
          { at: 3.2, kind: 'financialMilestone' },
          { at: 6.5, kind: 'chime' },
          { at: 8.8, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'سود خالص چهارصد و پنجاه و پنج هزار؛ عدد واقعی آشکار می‌شود.',
    },

    // 5 (35–40s) — three ledger footings: sales, cogs, expenses.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'dusk-fog',
        component: LedgerFootScene,
        cues: [
          { at: 0, kind: 'cardEnter' },
          { at: 1.2, kind: 'cardEnter' },
          { at: 2.1, kind: 'cardEnter' },
          { at: 3.4, kind: 'successResolution' },
          { at: 4.5, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'فروش، بهای تمام‌شده و خرج‌ها؛ همه پایه‌های حساب زنده می‌مانند.',
    },

    // 6 (40–45s) — CTA over clean dusk ambiance.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'dusk-fog',
        component: FogCtaScene,
        cues: [
          { at: 0, kind: 'ctaResolution' },
          { at: 0.5, kind: 'bigReveal' },
          { at: 1.8, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ حساب روشن از امشب. رایگان شروع کن.',
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
