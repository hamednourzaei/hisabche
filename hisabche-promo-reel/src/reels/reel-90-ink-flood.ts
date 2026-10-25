// ============================================
// Reel 90 — «سیل کاغذها» (ink-flood bespoke film, chaos → clarity)
//
// A hundred invoices flood the counter. Everything freezes; one bright core
// suction-pulls every sheet into a single point; the paper resurfaces as
// four clean floating cards, lands in the shop's phone as a live dashboard,
// and a cure-line sweeps the stage turning paper into clean panels.
//
// One persistent arithmetic:
//   ۱٬۸۴۰٬۰۰۰ فروش − ۱٬۲۲۵٬۰۰۰ بهای تمام‌شده − ۱۴۰٬۰۰۰ خرج = ۴۷۵٬۰۰۰ سود
//   طلب ۲۱۸٬۰۰۰ · انبار ۳۱۲
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  ClarityCardsScene,
  CureSweepSlideScene,
  FloodArrivalScene,
  InkCtaScene,
  PhoneDashboardScene,
  SuctionFreezeScene,
} from '../scenes/ink-flood'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0–7s) — frame-0: the flood already covers the counter.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'ink-flood',
        component: FloodArrivalScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 0.5, kind: 'whoosh' },
          { at: 2.2, kind: 'paperRustle' },
          { at: 4.6, kind: 'alert' },
          { at: 6.1, kind: 'sceneTransition' },
        ] as Cue[],
      },
      vo: 'صد فاکتور و رسید هر روز روی میزت می‌ریزد و آخرش نمی‌دانی چقدر واقعاً ماند.',
    },

    // 2 (7–15s) — freeze; one bright core pulls every sheet in.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'ink-flood',
        component: SuctionFreezeScene,
        cues: [
          { at: 0, kind: 'softTransition' },
          { at: 0.8, kind: 'cinematicReveal' },
          { at: 2.2, kind: 'dataFlow' },
          { at: 4.9, kind: 'whoosh' },
          { at: 6.3, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'بعد همه‌چیز می‌ایستد؛ حسابچه برگه‌ها را به یک نقطهٔ روشن می‌کشد.',
    },

    // 3 (15–24s) — four clarity cards surface (2×2, disjoint geometry).
    {
      dur: 9,
      spec: {
        kind: 'bespoke',
        theme: 'ink-flood',
        component: ClarityCardsScene,
        cues: [
          { at: 0.5, kind: 'cardThock' },
          { at: 1.7, kind: 'cardThock' },
          { at: 3.0, kind: 'cardThock' },
          { at: 4.3, kind: 'cardThock' },
          { at: 5.6, kind: 'precisionSequence' },
          { at: 7.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'فروش یک میلیون و هشتصد و چهل هزار، موجودی سیصد و دوازده قلم، سود چهارصد و هفتاد و پنج هزار، طلب دویست و هجده هزار.',
    },

    // 4 (24–34s) — the floating world lands in the shop's phone.
    {
      dur: 10,
      spec: {
        kind: 'bespoke',
        theme: 'ink-flood',
        component: PhoneDashboardScene,
        cues: [
          { at: 0, kind: 'whoosh' },
          { at: 1.0, kind: 'dataFlow' },
          { at: 3.6, kind: 'financialMilestone' },
          { at: 5.2, kind: 'cash' },
          { at: 6.8, kind: 'insightReveal' },
        ] as Cue[],
      },
      vo: 'همین عددها الان داخل حسابچه روشن است؛ روی گوشی، بی‌کاغذ.',
    },

    // 5 (34–41s) — the cure-line sweeps; wherever it passes, it stays clean.
    {
      dur: 7,
      spec: {
        kind: 'bespoke',
        theme: 'ink-flood',
        component: CureSweepSlideScene,
        cues: [
          { at: 0, kind: 'cameraSwish' },
          { at: 1.2, kind: 'scan' },
          { at: 4.6, kind: 'success' },
          { at: 5.8, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'خط روشن از راست رد می‌شود و هر جا گذشت، پاک و مرتب می‌ماند.',
    },

    // 6 (41–45s) — brand lockup over the ink night + two comment boxes.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'ink-flood',
        component: InkCtaScene,
        cues: [
          { at: 0, kind: 'ctaResolution' },
          { at: 0.4, kind: 'bigReveal' },
          { at: 1.1, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ حساب روشن از امشب. رایگان شروع کن.',
    },
  ],
  { noZoom: true },
)

export const reel90: Reel = {
  id: '90',
  title: 'سیل کاغذها — صد برگه، یک داشبورد روشن',
  duration: total(scenes),
  scenes,
  theme: 'ink-flood',
  musicMood: 'uplifting',
  noZoom: true,
}
