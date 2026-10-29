// ============================================
// Reel 91 — «شوک عدد — فروش ۲۵ میلیون، سود فقط ۶ میلیون» · 32 s
//
// Masterpiece Motion Engine: Bourdon Manometer & Fluidic Profit Distillation Siphon
// (گیج فشار صنعتی بوردون و ستون پالایش سانتریفیوژ سود خالص)
//
// One persistent arithmetic:
//   ۲۵٬۰۰۰٬۰۰۰ فروش − ۱۵٬۲۰۰٬۰۰۰ بهای تمام‌شده − ۳٬۸۰۰٬۰۰۰ خرج
//   = ۶٬۰۰۰٬۰۰۰ سود خالص (= ۲۴٪ فروش)
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  CostSwarmScene,
  GrossLadderScene,
  ProfitNotSalesScene,
  ShockCtaScene,
  ShockHookScene,
  WaterfallSiphonScene,
} from '../scenes/profit-shock'
import { sequence, total } from './shared'

const scene = (component: typeof ShockHookScene, cues: Cue[]) =>
  ({ kind: 'bespoke', theme: 'obsidian-cinematic', component, cues }) as const

const scenes = sequence(
  [
    // 1 (0–4s, 4s) — Bourdon Manometer needle slam and pressure relief.
    {
      dur: 4,
      spec: scene(ShockHookScene, [
        { at: 0.05, kind: 'impact' },
        { at: 1.8, kind: 'whoosh' },
        { at: 2.8, kind: 'alert' },
      ]),
      vo: 'بیست و پنج میلیون فروش؛ اما آخرش چقدر سود واقعی در جیبت ماند؟',
    },

    // 2 (4–9s, 5s) — The primary siphon: COGS sintered piston compression.
    {
      dur: 5,
      spec: scene(GrossLadderScene, [
        { at: 0.8, kind: 'precisionSequence' },
        { at: 2.0, kind: 'pop' },
        { at: 3.5, kind: 'chime' },
      ]),
      vo: 'پانزده میلیون و دویست هزار تومان فقط بهای خرید دوباره جنس است.',
    },

    // 3 (9–14s, 5s) — The secondary siphon: Tri-valve rotary outflow manifold.
    {
      dur: 5,
      spec: scene(CostSwarmScene, [
        { at: 0.6, kind: 'cardEnter' },
        { at: 1.8, kind: 'cardEnter' },
        { at: 3.0, kind: 'cardEnter' },
        { at: 4.2, kind: 'alert' },
      ]),
      vo: 'حقوق، کرایه، ارسال؛ سه میلیون و هشتصد هزار تومان دیگر هم خرج شد.',
    },

    // 4 (14–22s, 8s) — The pure gold droplet collector & crystalline flask.
    {
      dur: 8,
      spec: scene(WaterfallSiphonScene, [
        { at: 0.5, kind: 'dataFlow' },
        { at: 3.8, kind: 'financialMilestone' },
        { at: 5.5, kind: 'chime' },
      ]),
      vo: 'سود واقعی شش میلیون است؛ یعنی فقط بیست و چهار درصد فروش کل.',
    },

    // 5 (22–26s, 4s) — Kinetic typographic clash: Sales ≠ Net Profit.
    {
      dur: 4,
      spec: scene(ProfitNotSalesScene, [
        { at: 0.5, kind: 'impact' },
        { at: 2.2, kind: 'pop' },
      ]),
      vo: 'فروش بالا همیشه به معنای سود بالا نیست. دو عدد، دو داستان جداگانه دارند.',
    },

    // 6 (26–32s, 6s) — Closing CTA with seamless loop.
    {
      dur: 6,
      spec: scene(ShockCtaScene, [
        { at: 0.3, kind: 'ctaResolution' },
        { at: 1.0, kind: 'bigReveal' },
        { at: 5.4, kind: 'pop' },
      ]),
      vo: 'حسابچه؛ تصویری شفاف از سود واقعی دخل. همین امروز رایگان امتحان کن.',
    },
  ],
  { noZoom: true },
)

export const reel91: Reel = {
  id: '91',
  title: 'شوک عدد — فروش ۲۵ میلیون، سود فقط ۶ میلیون',
  duration: total(scenes),
  scenes,
  theme: 'obsidian-cinematic',
  musicMood: 'uplifting',
  noZoom: true,
}
