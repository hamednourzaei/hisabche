// ============================================
// Reel 85 — «عددها معنی پیدا می‌کنن» (DistilBook cinematic 3D commercial)
//
// Dark navy-black background, floating 3D paper documents with thickness
// and soft reflections, glowing neon green-blue-pink vertical logo bars,
// clean kinetic typography, smooth camera movements, particle data rings,
// elegant depth of field, octane-quality lighting, highly polished SaaS aesthetic.
//
// Six beats: chaos → freeze & rings → clean cards → phone mockup → split screen → logo converge.
// Every figure repeats one arithmetic: ۱۲٬۸۵۰٬۰۰۰ فروش − ۷٬۶۱۰٬۰۰۰ هزینه = ۵٬۲۴۰٬۰۰۰ سود.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  DistilCardsScene,
  DistilChaosScene,
  DistilFreezeScene,
  DistilLogoScene,
  DistilPhoneScene,
  DistilSplitScene,
} from '../scenes/distilbook'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — chaos: frame-0 arrest, flying papers, overwhelmed halftone character.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'distilbook',
        component: DistilChaosScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.1, kind: 'whoosh' },
          { at: 2.2, kind: 'paperRustle' },
          { at: 3.3, kind: 'alert' },
        ] as Cue[],
      },
      vo: 'فروختی… خرج کردی… ولی آخرش واقعاً چقدر موند؟',
    },

    // 2 — freeze & rings: everything freezes, sucked into light, data rings form.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'distilbook',
        component: DistilFreezeScene,
        cues: [
          { at: 0.1, kind: 'cinematicReveal' },
          { at: 1.6, kind: 'bigReveal' },
          { at: 2.8, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'همه‌ی شماره‌ها و کاغذات در یک نور جمع می‌شوند، و حسابچه به وجود می‌آید.',
    },

    // 3 — clean cards: four organized floating 3D value cards.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'distilbook',
        component: DistilCardsScene,
        cues: [
          { at: 0.3, kind: 'pop' },
          { at: 1.2, kind: 'dataFlow' },
          { at: 2.6, kind: 'tick' },
          { at: 4.4, kind: 'cash' },
          { at: 6.2, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'فروش دوازده میلیون هشتصد و پنجاه هزار، وجود انبار سیصد و چهل و هشت، سود خالص بیست و چهار درصد، بدهکاران هشت میلیون و چهارصد هزار.',
    },

    // 4 — phone mockup: Hisabche dashboard, live counters, low-stock alert.
    {
      dur: 12,
      spec: {
        kind: 'bespoke',
        theme: 'distilbook',
        component: DistilPhoneScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 2.0, kind: 'scan' },
          { at: 4.2, kind: 'sync' },
          { at: 6.8, kind: 'alert' },
          { at: 9.4, kind: 'success' },
        ] as Cue[],
      },
      vo: 'تابلو حسابچه روی گوشی شما، شمارنده‌های زنده، هشدار انبار پایین، و محاسبه سود که از فروش به هزینه وصل می‌شود.',
    },

    // 5 — split screen: chaos left, clean right, vertical sweep line.
    {
      dur: 10,
      spec: {
        kind: 'bespoke',
        theme: 'distilbook',
        component: DistilSplitScene,
        cues: [
          { at: 0.2, kind: 'cameraSwish' },
          { at: 2.4, kind: 'successResolution' },
          { at: 5.0, kind: 'whoosh' },
        ] as Cue[],
      },
      vo: 'یک طرف آشفتگی کاغذات، طرف تابلو تمیز؛ خط براق در میان، آشفتگی را به نظم می‌سازد.',
    },

    // 6 — logo converge: Hisabche lockup + CTA.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'distilbook',
        component: DistilLogoScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.8, kind: 'chime' },
          { at: 3.4, kind: 'ctaResolution' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ وقتی عددها بالاخره معنی پیدا می‌کنند. شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel85: Reel = {
  id: '85',
  title: 'عددها معنی پیدا می‌کنن — حسابچه، تبلیغ سینمایی سه‌بُعدی',
  duration: total(scenes),
  scenes,
  theme: 'distilbook',
  musicMood: 'uplifting',
  noZoom: true,
}
