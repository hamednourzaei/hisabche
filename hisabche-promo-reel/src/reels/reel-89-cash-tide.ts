// ============================================
// Reel 89 — «موج روشن» (cash-tide bespoke film)
//
// The shop's cash is an underwater basin. Frame 0: a coin drops into
// complete darkness — its splash rippling where nobody can see. Three hidden
// vents (نسیه، خرج، اضافه) drain light out of the basin. Hisabche sends
// flow-lock rings that seal every vent one by one, the basins fill with
// measurable light, and the whole mechanism surfaces at dawn: the ledger
// breaks through the waterline as glowing reflections.
//
// One persistent arithmetic:
//   ۵٬۵۰۰٬۰۰۰ فروش − ۳٬۳۶۰٬۰۰۰ بهای تمام‌شده − ۷۶۰٬۰۰۰ خرج = ۱٬۳۸۰٬۰۰۰ سود
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  BasinLevelsScene,
  CoinFallScene,
  DawnSurfaceScene,
  FlowLockScene,
  LeakCurScene,
  TideCtaScene,
} from '../scenes/cash-tide'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0–4s) — frame-0: the coin drops where nobody watches.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'cash-tide',
        component: CoinFallScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 0.4, kind: 'whoosh' },
          { at: 1.05, kind: 'dataFlow' },
          { at: 1.35, kind: 'cash' },
          { at: 2.8, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'یک سکه تو تاریکی می‌افته و صداش گم می‌شه!',
    },

    // 2 (4–12s) — three hidden vents drain the light out of the basin.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'cash-tide',
        component: LeakCurScene,
        cues: [
          { at: 0, kind: 'cinematicReveal' },
          { at: 0.3, kind: 'cardEnter' },
          { at: 0.8, kind: 'cardEnter' },
          { at: 1.3, kind: 'cardEnter' },
          { at: 2.4, kind: 'alert' },
          { at: 5.6, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'نسیه و خرج و اضافه؛ سه نشت پنهان پولت را می‌برند.',
    },

    // 3 (12–20s) — flow-lock rings descend and seal every vent one by one.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'cash-tide',
        component: FlowLockScene,
        cues: [
          { at: 0, kind: 'precisionSequence' },
          { at: 1.6, kind: 'titleHit' },
          { at: 3.4, kind: 'titleHit' },
          { at: 5.2, kind: 'titleHit' },
          { at: 6.6, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'حسابچه حلقه‌های قفل را می‌فرستد و هر نشت بسته می‌شود.',
    },

    // 4 (20–31s) — the basins fill with measured light; profit surfaces big.
    {
      dur: 11,
      spec: {
        kind: 'bespoke',
        theme: 'cash-tide',
        component: BasinLevelsScene,
        cues: [
          { at: 0, kind: 'whoosh' },
          { at: 0.6, kind: 'dataFlow' },
          { at: 3.2, kind: 'cash' },
          { at: 4.9, kind: 'alert' },
          { at: 7.8, kind: 'bigReveal' },
          { at: 8.2, kind: 'financialMilestone' },
          { at: 9.1, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'فروش پنج میلیون و پانصد هزار، بهای سه میلیون و سیصد و شصت هزار، خرج هفتصد و شصت هزار؛ سود یک میلیون و سیصد و هشتاد هزار روشن می‌شود.',
    },

    // 5 (31–40s) — surfacing: the ledger breaks through the waterline at dawn.
    {
      dur: 9,
      spec: {
        kind: 'bespoke',
        theme: 'cash-tide',
        component: DawnSurfaceScene,
        cues: [
          { at: 0, kind: 'cameraSwish' },
          { at: 2.6, kind: 'insightReveal' },
          { at: 4.4, kind: 'cardEnter' },
          { at: 5.4, kind: 'cardEnter' },
          { at: 6.4, kind: 'financialMilestone' },
          { at: 7.9, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'صبح می‌شود؛ فروش، خرج و سود روی آب روشن می‌مانند.',
    },

    // 6 (40–45s) — buoy lockup + CTA over calm dawn water.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'cash-tide',
        component: TideCtaScene,
        cues: [
          { at: 0, kind: 'ctaResolution' },
          { at: 0.3, kind: 'bigReveal' },
          { at: 0.95, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ حساب روشن از امشب. رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel89: Reel = {
  id: '89',
  title: 'موج روشن — نشت‌های زیر آب قفل و حوض‌ها روشن می‌شوند',
  duration: total(scenes),
  scenes,
  theme: 'cash-tide',
  musicMood: 'uplifting',
  noZoom: true,
}
