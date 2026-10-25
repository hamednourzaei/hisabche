// ============================================
// Reel 92 — «میز نیمه‌شب» (midnight-desk bespoke film, POV deadpan)
//
// Top-down POV: the owner's desk at 23:00 — laptop, two receipt piles, a
// mug, and one tired finger dragging over receipts whose numbers blur.
// The halftone owner breaks the fourth wall, raises the phone, and with
// one swipe the desk becomes a clean live dashboard; a red critical-stock
// alert turns into a green check; the owner gives a tiny nod and smile.
//
// One persistent arithmetic:
//   ۱٬۸۴۰٬۰۰۰ فروش − ۱٬۲۲۵٬۰۰۰ بهای تمام‌شده − ۱۴۰٬۰۰۰ خرج = ۴۷۵٬۰۰۰ سود
//   طلب ۲۱۸٬۰۰۰ · انبار ۳۱۲ (۳ قلم بحرانی)
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  DeadpanLookScene,
  DeskCtaScene,
  DeskPovScene,
  MicroSmileScene,
  PhoneWhipScene,
  StockAlertScene,
} from '../scenes/midnight-desk'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 (0–8s) — frame-0: top-down POV desk, the finger drags over blurring receipts.
    {
      dur: 8,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-desk',
        component: DeskPovScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 0.6, kind: 'paperRustle' },
          { at: 1.5, kind: 'typewriterClick' },
          { at: 3.2, kind: 'tick' },
          { at: 5.5, kind: 'alert' },
          { at: 7.2, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'ساعت یازده شب؛ برگه‌ها روی میز مانده‌اند و هنوز جمع دخل معلوم نیست.',
    },

    // 2 (8–14s) — the owner breaks the fourth wall and looks up.
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-desk',
        component: DeadpanLookScene,
        cues: [
          { at: 0, kind: 'clockTickRapid' },
          { at: 1.2, kind: 'cardEnter' },
          { at: 3.5, kind: 'cinematicReveal' },
          { at: 5.2, kind: 'sceneTransition' },
        ] as Cue[],
      },
      vo: 'ساعت یازده و هفت دقیقه؛ حساب را به فردا نینداز.',
    },

    // 3 (14–23s) — phone whip: the desk clears and becomes one live dashboard.
    {
      dur: 9,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-desk',
        component: PhoneWhipScene,
        cues: [
          { at: 0, kind: 'whoosh' },
          { at: 0.8, kind: 'cameraSwish' },
          { at: 2.0, kind: 'dataFlow' },
          { at: 4.5, kind: 'cardThock' },
          { at: 7.0, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'با یک حرکت، کل دخل و خرج و سود روز در جیبت مرتب می‌شود.',
    },

    // 4 (23–34s) — critical stock alert resolves to green check.
    {
      dur: 11,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-desk',
        component: StockAlertScene,
        cues: [
          { at: 0, kind: 'alert' },
          { at: 1.5, kind: 'scan' },
          { at: 3.8, kind: 'sync' },
          { at: 6.2, kind: 'success' },
          { at: 9.0, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'کسری انبار قبل از اینکه مشتری متوجه شود، علامت سبز می‌گیرد.',
    },

    // 5 (34–40s) — tiny nod and micro-smile: peaceful sleep.
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-desk',
        component: MicroSmileScene,
        cues: [
          { at: 0, kind: 'insightReveal' },
          { at: 1.5, kind: 'financialMilestone' },
          { at: 3.5, kind: 'successResolution' },
          { at: 5.0, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'حالا می‌توانی با خیال راحت کرکره را پایین بکشی و بخوابی.',
    },

    // 6 (40–45s) — CTA over midnight desk ambiance.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'midnight-desk',
        component: DeskCtaScene,
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

export const reel92: Reel = {
  id: '92',
  title: 'میز نیمه‌شب — ساعت ۱۱ شب، حساب روشن در جیب',
  duration: total(scenes),
  scenes,
  theme: 'midnight-desk',
  musicMood: 'calm',
  noZoom: true,
}
