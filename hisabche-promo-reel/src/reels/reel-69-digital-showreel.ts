// ============================================
// Reel #69 — Pocketsflow Creator E-Commerce Explainer
//
// Dynamic 15-second character-led motion graphics explainer
// showcasing: product listings, checkout, upsells, subscription management.
//
// Hard Rules 13-19:
// 1. One Focal Stage per scene, <= 6 words per on-stage label.
// 2. Teleprompter / floating subtitle overlay at bottom: 80px.
// 3. Clean of any dividing line classes.
// 4. AV Sync Law: every sounded word has an action, read via cueAt in actor.
// 5. PROVISIONAL_CADENCE_MODEL_ACTIVE until real voiceover is placed.
// ============================================

import type { Reel } from '../engine/types'
import type { WordCue } from '../engine/speech-model'

const provisional = {
  alignmentStatus: 'PROVISIONAL_CADENCE_MODEL_ACTIVE' as const,
  isProvisional: true,
  confidence: null,
}

function w(word: string, start: number, end: number, extra: Partial<WordCue> = {}): WordCue {
  return { word, start, end, ...extra }
}

export const reel69: Reel = {
  id: '69',
  title: 'Pocketsflow — موشن گرافیک پلتفرم فروش دوره‌ها و محصولات دیجیتال',
  duration: 15.0,
  theme: 'swiss-editorial',
  storyMatrix: {
    targetCustomer: 'services',
    customerPain:
      'تولیدکنندگان محتوا و دوره‌های آموزشی برای فروش نیازمند چندین ابزار جداگانه و پیچیده هستند.',
    oldWorkflow: 'استفاده همزمان از چند پلتفرم پرداخت، سیستم ایمیل و لندینگ‌پیج‌های کند و پراکنده.',
    friction: 'افت نرخ تبدیل در صفحه تسویه‌حساب و از دست رفتن فروش مکمل و اشتراک‌های ماهانه.',
    hisabcheAction:
      'پلتفرم یکپارچه Pocketsflow با تسویه آنی، پیشنهادهای ارتقا و محاسبه خودکار مالیات جهانی.',
    automatedResult: 'افزایش فوری درآمد با اپل‌پی و پیشنهادهای مکمل خودکار در یک جریان پیوسته.',
    businessOutcome: 'تجربه خرید مدرن و افزایش چشمگیر فروش دوره‌ها و محصولات دیجیتال.',
    emotionalPayoff: 'آرامش و اعتمادبه‌نفس کریتور با دیدن رشد پیوسته فروش و تسویه‌های آنی.',
    cta: 'pocketsflow.com',
    selectedOperators: [
      'DitheredCharacterRig',
      'ProductCascadeSlide',
      'InstantCheckoutFloat',
      'ModularUpsellTaxSplit',
      'KineticBrandAssembly',
    ],
  },
  scenes: [
    // Beat 1: Hook (0.0 - 1.5s)
    {
      start: 0.0,
      end: 1.5,
      vo: 'Got something for creators.',
      spec: {
        kind: 'word-sync',
        actor: 'r69-creator-hook',
        title: 'Got something for creators',
      },
      sentence: {
        text: 'Got something for creators.',
        intent: 'Hook: Clean stark white workspace and dithered smiling character',
        ...provisional,
        words: [
          w('Got', 0.15, 0.45, { action: 'char-pop-in', sound: 'pop' }),
          w('something', 0.45, 0.85, { action: 'got-something-in', sound: 'cardEnter' }),
          w('//', 0.85, 1.05),
          w('for', 1.05, 1.2),
          w('creators', 1.2, 1.45, { emphasis: true, action: 'creators-tag-in', sound: 'chime' }),
        ],
        sentenceEnding: { at: 1.45, action: 'hook-settle' },
      },
    },

    // Beat 2: Product Cards on Blue Panel (1.5 - 4.5s)
    {
      start: 1.5,
      end: 4.5,
      vo: 'Sell Courses, Ebooks, and Apps.',
      spec: {
        kind: 'word-sync',
        actor: 'r69-product-cards',
        title: 'Courses, Ebooks, Apps',
      },
      sentence: {
        text: 'Sell Courses, Ebooks, and Apps.',
        intent: 'Blue UI panel slide and three modular product cards',
        ...provisional,
        words: [
          w('Sell', 0.15, 0.5, { action: 'blue-panel-slide', sound: 'whoosh' }),
          w('Courses,', 0.55, 1.15, {
            emphasis: true,
            action: 'card-courses-in',
            sound: 'cardThock',
          }),
          w('Ebooks,', 1.25, 1.85, {
            emphasis: true,
            action: 'card-ebooks-in',
            sound: 'cardThock',
          }),
          w('and', 1.95, 2.15),
          w('Apps.', 2.15, 2.75, { emphasis: true, action: 'card-apps-in', sound: 'cardThock' }),
        ],
        sentenceEnding: { at: 2.75, action: 'products-hold' },
      },
    },

    // Beat 3: Checkout Screen & Apple Pay (4.5 - 7.5s)
    {
      start: 4.5,
      end: 7.5,
      vo: 'Design Course $149.00, instant Apple Pay.',
      spec: {
        kind: 'word-sync',
        actor: 'r69-checkout-flow',
        title: 'Checkout & Apple Pay',
      },
      sentence: {
        text: 'Design Course $149.00, instant Apple Pay.',
        intent: 'Checkout UI mockup with instant Apple Pay button',
        ...provisional,
        words: [
          w('Design', 0.15, 0.45, { action: 'checkout-slide-in', sound: 'cardEnter' }),
          w('Course', 0.45, 0.8),
          w('$149.00,', 0.8, 1.3, { emphasis: true, action: 'course-price-tag', sound: 'tick' }),
          w('instant', 1.35, 1.7, { action: 'char-shrink-float', sound: 'softTransition' }),
          w('Apple', 1.7, 2.1, { emphasis: true, action: 'apple-pay-pulse', sound: 'pop' }),
          w('Pay.', 2.1, 2.55, { emphasis: true, action: 'pay-btn-snap', sound: 'cash' }),
        ],
        sentenceEnding: { at: 2.55, action: 'checkout-hold' },
      },
    },

    // Beat 4: Upsell & Automatic Tax (7.5 - 10.0s)
    {
      start: 7.5,
      end: 10.0,
      vo: 'Workbook upsell $19.00, Tax - VAT 20%.',
      spec: {
        kind: 'word-sync',
        actor: 'r69-upsell-tax',
        title: 'Workbook upsell & VAT',
      },
      sentence: {
        text: 'Workbook upsell $19.00, Tax - VAT 20%.',
        intent: 'Seamless checkout updates with upsell workbook and VAT tax',
        ...provisional,
        words: [
          w('Workbook', 0.15, 0.55, { emphasis: true, action: 'upsell-card-snap', sound: 'pop' }),
          w('upsell', 0.55, 0.9),
          w('$19.00,', 0.9, 1.35, { emphasis: true, action: 'upsell-price-snap', sound: 'tick' }),
          w('Tax', 1.4, 1.65),
          w('-', 1.65, 1.75),
          w('VAT', 1.75, 2.0, { emphasis: true, action: 'vat-tax-ticker', sound: 'dataFlow' }),
          w('20%', 2.0, 2.3, {
            emphasis: true,
            action: 'char-smile-bounce',
            sound: 'insightReveal',
          }),
        ],
        sentenceEnding: { at: 2.3, action: 'upsell-hold' },
      },
    },

    // Beat 5: Multi-Panel Split & Metrics Explosion (10.0 - 13.5s)
    {
      start: 10.0,
      end: 13.5,
      vo: 'Add the workbook, $9 / month, $12,480.00.',
      spec: {
        kind: 'word-sync',
        actor: 'r69-multi-panel-split',
        title: 'Modular multi-panel split',
      },
      sentence: {
        text: 'Add the workbook, $9 / month, $12,480.00.',
        intent: 'Modular multi-panel explosion with subscriptions, VAT tiers, and net revenue',
        ...provisional,
        words: [
          w('Add', 0.15, 0.4, { action: 'multi-panel-explode', sound: 'impact' }),
          w('the', 0.4, 0.55),
          w('workbook,', 0.55, 0.9, { action: 'workbook-add-pill', sound: 'cardEnter' }),
          w('$9', 0.95, 1.25, { emphasis: true, action: 'sub-tier-snap', sound: 'tick' }),
          w('/', 1.25, 1.35),
          w('month,', 1.35, 1.65),
          w('global', 1.65, 1.9, { action: 'vat-tags-spread', sound: 'cardEnter' }),
          w('taxes,', 1.9, 2.15),
          w('$12,480.00', 2.15, 2.45, {
            emphasis: true,
            action: 'revenue-counter-surge',
            sound: 'success',
          }),
        ],
        sentenceEnding: { at: 2.45, action: 'multi-split-hold' },
      },
    },

    // Beat 6: Pocketsflow Outro (13.5 - 15.0s)
    {
      start: 13.5,
      end: 15.0,
      vo: 'Pockets... flow.',
      spec: {
        kind: 'word-sync',
        actor: 'r69-brand-outro',
        title: 'Pocketsflow Brand Resolution',
      },
      sentence: {
        text: 'Pockets... flow.',
        intent: 'Clean white outro with kinetic Pockets and flow assembly',
        ...provisional,
        words: [
          w('Pockets', 0.15, 0.55, {
            emphasis: true,
            action: 'pockets-in',
            sound: 'softTransition',
          }),
          w('flow.', 0.6, 1.05, {
            emphasis: true,
            action: 'flow-slide-lock',
            sound: 'ctaResolution',
          }),
        ],
        sentenceEnding: { at: 1.05, action: 'brand-final-hold' },
      },
    },
  ],
}
