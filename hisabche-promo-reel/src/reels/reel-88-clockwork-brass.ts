// ============================================
// Reel 88 — «ساعت صفر» (clockwork-brass bespoke film)
//
// The shop's day is a hand-wound brass movement that can never reach
// midnight: three jammed gear clusters (صندوق، انبار، دفتر) grind against
// each other at ۱۱:۵۹. One polished Hisabche hub-gear descends, meshes, and
// the whole train engages — the hands sweep cleanly to ۱۲:۰۰:۰۰, the gear
// teeth become ledger rows, the balance seals «تراز.», and the shutter
// locks itself for the night.
//
// One persistent arithmetic:
//   ۷۶۲٬۰۰۰ فروش − ۴۵۰٬۰۰۰ بهای تمام‌شده − ۸۷٬۰۰۰ خرج = ۲۲۵٬۰۰۰ سود
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  BrassCtaScene,
  ClockStuckScene,
  GrindingGearsScene,
  HeroGearScene,
  ShutterLockScene,
  ToothLedgerScene,
  TrainMeshScene,
} from '../scenes/clockwork-brass'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0–3.5s) — frame-0: the movement stops one tooth short of closing.
    {
      dur: 3.5,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: ClockStuckScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 0.4, kind: 'clockTickRapid' },
          { at: 1.6, kind: 'tick' },
          { at: 2.4, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'یازده و پنجاه و نه! مغازه کار می‌کند اما جلو نمی‌رود.',
    },

    // 2 (3.5–9.5s) — three clusters grind against each other; sparks of seize.
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: GrindingGearsScene,
        cues: [
          { at: 0, kind: 'cinematicReveal' },
          { at: 0.3, kind: 'cardEnter' },
          { at: 0.75, kind: 'cardEnter' },
          { at: 1.2, kind: 'cardEnter' },
          { at: 3.9, kind: 'majorReveal' },
          { at: 4.9, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'صندوق، انبار و دفتر؛ سه چرخ‌دنده دندونه‌به‌دندونه گیر کرده‌اند.',
    },

    // 3 (9.5–17s) — the Hisabche hub descends and takes the first real mesh.
    {
      dur: 7.5,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: HeroGearScene,
        cues: [
          { at: 0, kind: 'whoosh' },
          { at: 3.9, kind: 'bigReveal' },
          { at: 4.2, kind: 'titleHit' },
          { at: 4.6, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'حسابچه چرخ اصلی می‌شود و اولین دنده واقعی را می‌گیرد.',
    },

    // 4 (17–25s) — the full train engages; the hands reach ۱۲:۰۰:۰۰.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: TrainMeshScene,
        cues: [
          { at: 0, kind: 'precisionSequence' },
          { at: 3.2, kind: 'cash' },
          { at: 4.2, kind: 'chime' },
          { at: 6.0, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'همه دنده‌ها جفت می‌شوند و عقربه سرانجام آزاد می‌شود.',
    },

    // 5 (25–33s) — teeth become ledger rows; the balance seals «تراز.»
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: ToothLedgerScene,
        cues: [
          { at: 0, kind: 'dataFlow' },
          { at: 0.35, kind: 'cardEnter' },
          { at: 0.85, kind: 'cardEnter' },
          { at: 1.35, kind: 'cardEnter' },
          { at: 1.85, kind: 'financialMilestone' },
          { at: 5.0, kind: 'majorReveal' },
        ] as Cue[],
      },
      vo: 'فروش هفتصد و شصت و دو هزار، بهای چهارصد و پنجاه هزار، خرج هفتاد و هفت هزار؛ سود دویست و بیست و پنج هزار — تراز.',
    },

    // 6 (33–40s) — the day closes itself: shutter cascades, key turns, glow.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: ShutterLockScene,
        cues: [
          { at: 0, kind: 'cameraSwish' },
          { at: 4.05, kind: 'titleHit' },
          { at: 5.0, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'پرده پایین می‌آید و روز تراز بسته می‌شود.',
    },

    // 7 (40–45s) — engraved brass plate + CTA hold.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'clockwork-brass',
        component: BrassCtaScene,
        cues: [
          { at: 0, kind: 'ctaResolution' },
          { at: 0.3, kind: 'bigReveal' },
          { at: 0.95, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'ساعت صفر شد؛ حسابچه، دخل را تراز نگه می‌دارد. شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel88: Reel = {
  id: '88',
  title: 'ساعت صفر — مغازه‌ای که از گریبان دنده یک بازمی‌گردد',
  duration: total(scenes),
  scenes,
  theme: 'clockwork-brass',
  musicMood: 'tense',
  noZoom: true,
}
