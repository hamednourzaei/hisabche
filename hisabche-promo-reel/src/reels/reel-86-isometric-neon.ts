// ============================================
// Reel 86 — «شبکه‌ی حسابچه» (Isometric Neon Diorama)
//
// A distinct SaaS commercial: the owner's shop is a glowing 3D isometric
// wireframe room that constructs itself station by station, with neon
// data-streams (green/blue/pink) routing through a central Hisabche core,
// then multiplying into a synced multi-branch grid. Dark obsidian, kinetic
// typography, 2.5D layering + slow virtual-camera orbit.
//
// Six beats: hook (out-of-sync) → build (tangle) → core (snap) → live (KPIs)
// → multi-branch (sync) → logo + CTA.
// One arithmetic thread: ۱۲٬۸۵۰٬۰۰۰ فروش − هزینه = سود; موجودی ۳۴۸; سود ۲۴٪.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  IsoBuildScene,
  IsoCoreScene,
  IsoHookScene,
  IsoLiveScene,
  IsoLogoScene,
  IsoMultiScene,
} from '../scenes/isometric-neon'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — hook: lone counter on the grid, stations blinking out of sync.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'isometric-neon',
        component: IsoHookScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.5, kind: 'clockTickRapid' },
          { at: 3.0, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'مغازه‌ات زنده‌ست؛ پیشخوان، قفسه، صندوق، دفتر — ولی هیچ‌کدوم همدیگه رو نمی‌بینن.',
    },

    // 2 — build: stations rise, data lines cross and tangle.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'isometric-neon',
        component: IsoBuildScene,
        cues: [
          { at: 0.4, kind: 'dataFlow' },
          { at: 2.6, kind: 'scan' },
          { at: 4.4, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'هر ایستگاه جداگانه کار می‌کنه؛ شماره‌ها بینشان گم می‌شود و دوباره‌کاری بالا می‌گیرد.',
    },

    // 3 — core: the Hisabche core descends, tangles snap straight.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'isometric-neon',
        component: IsoCoreScene,
        cues: [
          { at: 0.6, kind: 'cinematicReveal' },
          { at: 1.8, kind: 'majorReveal' },
          { at: 3.2, kind: 'bigReveal' },
        ] as Cue[],
      },
      vo: 'یک هسته وسط می‌نشیند و همه‌ی خطوط یک‌باره صاف و مرتب می‌شوند.',
    },

    // 4 — live: KPI holograms orbit, character calm and in control.
    {
      dur: 10,
      spec: {
        kind: 'bespoke',
        theme: 'isometric-neon',
        component: IsoLiveScene,
        cues: [
          { at: 0.5, kind: 'dataFlow' },
          { at: 2.5, kind: 'tick' },
          { at: 4.5, kind: 'cash' },
          { at: 7.0, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'حالا فروش، موجودی و سود روی همان اتاق شناورند؛ عدد لحظه‌ای، تصویر زنده.',
    },

    // 5 — multi-branch: one room multiplies into a synced grid.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'isometric-neon',
        component: IsoMultiScene,
        cues: [
          { at: 0.8, kind: 'whoosh' },
          { at: 2.6, kind: 'sync' },
          { at: 5.0, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'و هر شعبه به همان هسته وصل می‌شود؛ انگار نفس‌شان یکی شده است.',
    },

    // 6 — logo: diorama condenses into the Hisabche lockup + CTA.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'isometric-neon',
        component: IsoLogoScene,
        cues: [
          { at: 0.4, kind: 'bigReveal' },
          { at: 2.0, kind: 'chime' },
          { at: 3.4, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ وقتی شبکه‌ات یکی می‌شود، تصمیم هم ساده می‌شود. شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel86: Reel = {
  id: '86',
  title: 'شبکه‌ی حسابچه — دیورامای نئونی ایزومتریک',
  duration: total(scenes),
  scenes,
  theme: 'isometric-neon',
  musicMood: 'uplifting',
  noZoom: true,
}
