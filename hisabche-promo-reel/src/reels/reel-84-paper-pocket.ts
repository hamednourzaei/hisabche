// ============================================
// Reel 84 — «دفترت هنوز دستیه؟» (paper-pocket art direction)
//
// A light, print-like film in the Pocketsflow style: warm paper canvas,
// halftone black-and-white shopkeeper, royal-blue accent, mono HUD with a
// running timecode, and neo-brutalist white cards with hard ink shadows.
// Ten beats, a visual change every ~1.5–2s: hook → chaos → morph →
// wordmark → dashboard → phone stock → profit → transformation → brand → CTA.
// Every figure repeats one arithmetic: ۴۲۰٬۰۰۰ فروش − ۲۶۰٬۰۰۰ بهای تمام‌شده
// − ۷۰٬۰۰۰ هزینه = ۹۰٬۰۰۰ سود.
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  PaperBrandScene,
  PaperChaosScene,
  PaperCtaScene,
  PaperGridScene,
  PaperHookScene,
  PaperMorphScene,
  PaperPhoneScene,
  PaperProfitScene,
  PaperRevealScene,
  PaperTransformScene,
} from '../scenes/paper-pocket'
import { sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — hook: frame-0 arrest, one question the shopkeeper recognizes.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperHookScene,
        cues: [
          { at: 0, kind: 'impact' },
          { at: 1.2, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'اگر هنوز موجودی مغازه را با دفتر دستی می‌شماری، این ویدیو برای توست.',
    },

    // 2 — chaos: four tools, four different truths.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperChaosScene,
        cues: [
          { at: 0.1, kind: 'whoosh' },
          { at: 1.4, kind: 'alert' },
          { at: 2.6, kind: 'paperRustle' },
        ] as Cue[],
      },
      vo: 'اکسل یک عدد می‌گوید، دفتر عدد دیگر، ماشین‌حساب عددی دیگر؛ و پیامک مشتری هم هست.',
    },

    // 3 — morph: the four fragments converge into one ledger.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperMorphScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 2.1, kind: 'cinematicReveal' },
        ] as Cue[],
      },
      vo: 'حسابچه همهٔ این‌ها را کنار هم می‌آورد؛ یک دفتر برای همهٔ کسب‌وکار.',
    },

    // 4 — product reveal: the wordmark lands.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperRevealScene,
        cues: [
          { at: 0.1, kind: 'titleHit' },
          { at: 1.4, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ نرم‌افزار مالی ابری، ساخته‌شده برای مغازه و کارگاه.',
    },

    // 5 — the dashboard: four numbers, one screen.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperGridScene,
        cues: [
          { at: 0.2, kind: 'pop' },
          { at: 1.5, kind: 'dataFlow' },
          { at: 3.4, kind: 'tick' },
        ] as Cue[],
      },
      vo: 'فروش، فاکتور، انبار و مشتری؛ همه در یک صفحه و به‌روز.',
    },

    // 6 — the phone: live stock in your pocket, even offline.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperPhoneScene,
        cues: [
          { at: 0.2, kind: 'whoosh' },
          { at: 1.6, kind: 'sync' },
          { at: 3.2, kind: 'success' },
        ] as Cue[],
      },
      vo: 'موجودی انبار را با گوشی ببین؛ اینترنت هم که قطع شد، ثبت ادامه دارد و بعداً همگام می‌شود.',
    },

    // 7 — sales → profit: the one number an owner really reads.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperProfitScene,
        cues: [
          { at: 0.2, kind: 'scan' },
          { at: 2.4, kind: 'cash' },
          { at: 3.6, kind: 'financialMilestone' },
        ] as Cue[],
      },
      vo: 'فروش که بالا می‌رود، سود واقعی هم معلوم می‌شود؛ نه حدس، بلکه از دل همان فروش.',
    },

    // 8 — transformation: chaos wipes into order.
    {
      dur: 5,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperTransformScene,
        cues: [
          { at: 0.2, kind: 'cameraSwish' },
          { at: 2.2, kind: 'successResolution' },
        ] as Cue[],
      },
      vo: 'از آشفتگیِ دفتر دستی، به نظمِ یک سیستم؛ هر فروش، خودش انبار و سود را به‌روز می‌کند.',
    },

    // 9 — brand lockup: the name and the character settle.
    {
      dur: 4,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperBrandScene,
        cues: [
          { at: 0.2, kind: 'bigReveal' },
          { at: 1.6, kind: 'chime' },
        ] as Cue[],
      },
      vo: 'حسابچه؛ ساده، سریع و ابری؛ همیشه کنارت.',
    },

    // 10 — CTA: one word, one action.
    {
      dur: 6,
      spec: {
        kind: 'bespoke',
        theme: 'paper-pocket',
        component: PaperCtaScene,
        cues: [
          { at: 0.3, kind: 'impact' },
          { at: 1.6, kind: 'ctaResolution' },
          { at: 4.2, kind: 'softTransition' },
        ] as Cue[],
      },
      vo: 'همین امروز شروع کن؛ کامنت کن تا لینک دانلود رایگان را بفرستیم.',
    },
  ],
  { noZoom: true },
)

export const reel84: Reel = {
  id: '84',
  title: 'دفترت هنوز دستیه؟ — حسابچه، دفتر مالی ابری',
  duration: total(scenes),
  scenes,
  theme: 'paper-pocket',
  musicMood: 'uplifting',
  noZoom: true,
}
