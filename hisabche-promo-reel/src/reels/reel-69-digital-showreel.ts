// ============================================
// Reel #69 — یک فاکتور، پنج کار (character-led explainer)
//
// Rewritten 18 Oct 2026 (owner: «سناریوشو با حسابچه فیکس کن»). The first cut
// was an English explainer for another product (courses, Apple Pay, VAT, a
// foreign brand as the CTA) — nothing in it was حسابچه, and a reel may only
// show what the product really does (CLAUDE.md §10.5). The dithered character,
// the cards, the checkout card, the multi-panel burst and the two-part logo
// stay; every word and number is now حسابچه's own:
//
//   · one invoice can hold a product, a service and a weighed item;
//   · part paid now, the rest on credit (the customer's balance);
//   · a dollar invoice keeps THAT day's rate on the invoice;
//   · issuing it moves the stock, the till, the ledger, the customer's
//     balance and the profit — the five panels of the climax.
//
// Hard rules 13–14: one focal stage, ≤ 6 words of on-stage text, every
// sounded word has an action the actor reads with cueAt, no sound on a
// sentence ending, the climax holds ≥ 1.0 s. No voiceover file yet:
// PROVISIONAL_CADENCE_MODEL_ACTIVE.
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
  title: 'یک فاکتور، پنج کار — کاراکتر حسابچه',
  duration: 33.5,
  theme: 'swiss-editorial',
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'کاسب بعد از هر فروش باید جدا موجودی را کم کند، پول را در دخل بنویسد، نسیه را در دفتر یادداشت کند و آخر ماه سود را حدس بزند.',
    oldWorkflow: 'فاکتور کاغذی، یک دفتر نسیه، یک دفتر صندوق و حساب سود با ماشین‌حساب آخر ماه.',
    friction:
      'یکی از این چهار دفتر جا می‌ماند؛ موجودی با قفسه نمی‌خواند و سود ماه با پول دخل یکی نیست.',
    hisabcheAction:
      'یک فاکتور در حسابچه: کالا، خدمت و جنس وزنی در یک سند؛ پرداخت نقد و نسیه؛ نرخ ارز همان روز روی فاکتور.',
    automatedResult:
      'با صدور فاکتور، موجودی انبار کم می‌شود، صندوق پر می‌شود، سند دفتر کل می‌خورد، بدهی مشتری ثبت می‌شود و سود معلوم می‌شود.',
    businessOutcome: 'یک بار ثبت به‌جای پنج بار؛ عددها با هم می‌خوانند.',
    emotionalPayoff: 'آرامش کاسبی که بعد از بستن مغازه دیگر دفتری برای پر کردن ندارد.',
    cta: 'hisabche.com',
    selectedOperators: [
      'DitheredCharacterRig',
      'ProductCascadeSlide',
      'InstantCheckoutFloat',
      'ModularUpsellTaxSplit',
      'KineticBrandAssembly',
    ],
  },
  scenes: [
    // Beat 1 — hook: one invoice, five jobs (0.0 – 4.0)
    {
      start: 0.0,
      end: 4.0,
      vo: 'یه فاکتور می‌زنی؛ پنج تا کار خودش انجام میشه.',
      spec: { kind: 'word-sync', actor: 'r69-invoice-hook', title: 'یک فاکتور، پنج کار' },
      sentence: {
        text: 'یه فاکتور می‌زنی؛ پنج تا کار خودش انجام میشه.',
        intent: 'Hook: the character pops in beside one invoice; «۱ = ۵» snaps on',
        ...provisional,
        words: [
          w('یه', 0.2, 0.35),
          w('فاکتور', 0.35, 0.85, { emphasis: true, action: 'char-pop-in', sound: 'pop' }),
          w('می‌زنی؛', 0.85, 1.35, { action: 'invoice-in', sound: 'cardEnter' }),
          w('پنج', 1.6, 1.95, { emphasis: true, action: 'five-tag-in', sound: 'chime' }),
          w('تا', 1.95, 2.1),
          w('کار', 2.1, 2.4),
          w('خودش', 2.4, 2.75),
          w('انجام', 2.75, 3.1),
          w('میشه.', 3.1, 3.4),
        ],
        sentenceEnding: { at: 3.4, action: 'hook-settle' },
      },
    },

    // Beat 2 — what one invoice can hold (4.0 – 10.0)
    {
      start: 4.0,
      end: 10.0,
      vo: 'کالا، خدمت، یا جنس وزنی؛ هر سه تو همون یه فاکتور.',
      spec: { kind: 'word-sync', actor: 'r69-line-cards', title: 'کالا، خدمت، وزنی' },
      sentence: {
        text: 'کالا، خدمت، یا جنس وزنی؛ هر سه تو همون یه فاکتور.',
        intent:
          'Blue panel slides up; three line cards cascade: a product, a service, a weighed item',
        ...provisional,
        words: [
          w('کالا،', 0.2, 0.75, {
            emphasis: true,
            action: 'card-product-in',
            sound: 'cardThock',
          }),
          w('خدمت،', 0.95, 1.5, { emphasis: true, action: 'card-service-in', sound: 'cardThock' }),
          w('یا', 1.7, 1.85),
          w('جنس', 1.85, 2.15),
          w('وزنی؛', 2.15, 2.7, { emphasis: true, action: 'card-weight-in', sound: 'cardThock' }),
          w('هر', 3.0, 3.2),
          w('سه', 3.2, 3.5, { action: 'cards-merge', sound: 'cardThock' }),
          w('تو', 3.5, 3.65),
          w('همون', 3.65, 3.95),
          w('یه', 3.95, 4.1),
          w('فاکتور.', 4.1, 4.7),
        ],
        sentenceEnding: { at: 4.7, action: 'products-hold' },
      },
    },

    // Beat 3 — part cash, part credit (10.0 – 16.5)
    {
      start: 10.0,
      end: 16.5,
      vo: 'گیربوکس اتوماتیک، سی میلیون افغانی؛ نیمش نقد، نیمش نسیه.',
      spec: { kind: 'word-sync', actor: 'r69-cash-credit', title: 'نقد و نسیه' },
      sentence: {
        text: 'گیربوکس اتوماتیک، سی میلیون افغانی؛ نیمش نقد، نیمش نسیه.',
        intent:
          'The invoice card slides in; the line price lands; the payment splits into cash and credit',
        ...provisional,
        words: [
          w('گیربوکس', 0.2, 0.7, { action: 'invoice-slide-in', sound: 'cardEnter' }),
          w('اتوماتیک،', 0.7, 1.3),
          w('سی', 1.5, 1.75),
          w('میلیون', 1.75, 2.1),
          w('افغانی؛', 2.1, 2.7, { emphasis: true, action: 'line-price-in', sound: 'tick' }),
          w('نیمش', 3.0, 3.35, { action: 'char-shrink-float', sound: 'softTransition' }),
          w('نقد،', 3.35, 3.9, { emphasis: true, action: 'cash-pill-in', sound: 'cash' }),
          w('نیمش', 4.1, 4.45),
          w('نسیه.', 4.45, 5.0, { emphasis: true, action: 'credit-pill-in', sound: 'pop' }),
        ],
        sentenceEnding: { at: 5.0, action: 'checkout-hold' },
      },
    },

    // Beat 4 — the day's rate stays on the invoice (16.5 – 23.0)
    {
      start: 16.5,
      end: 23.0,
      vo: 'مشتری دالر داد؟ نرخ همون روز روی فاکتور می‌مونه.',
      spec: { kind: 'word-sync', actor: 'r69-day-rate', title: 'نرخ همان روز' },
      sentence: {
        text: 'مشتری دالر داد؟ نرخ همون روز روی فاکتور می‌مونه.',
        intent:
          'A dollar note slides onto the invoice; «۱ دالر = ۷۰ افغانی» locks onto it with a date',
        ...provisional,
        words: [
          w('مشتری', 0.2, 0.6),
          w('دالر', 0.6, 1.0, { emphasis: true, action: 'dollar-note-in', sound: 'pop' }),
          w('داد؟', 1.0, 1.5),
          w('نرخ', 1.8, 2.15, { emphasis: true, action: 'rate-lock-in', sound: 'tick' }),
          w('همون', 2.15, 2.45),
          w('روز', 2.45, 2.8, { action: 'rate-date-in', sound: 'dataFlow' }),
          w('روی', 2.8, 3.05),
          w('فاکتور', 3.05, 3.5),
          w('می‌مونه.', 3.5, 4.1, { action: 'char-smile-bounce', sound: 'insightReveal' }),
        ],
        sentenceEnding: { at: 4.1, action: 'upsell-hold' },
      },
    },

    // Beat 5 — climax: the five jobs land at once (23.0 – 30.5)
    {
      start: 23.0,
      end: 30.5,
      vo: 'انبار کم شد، صندوق پر شد، سند دفتر خورد، طلب مشتری ثبت شد، سود معلوم شد.',
      spec: { kind: 'word-sync', actor: 'r69-five-jobs', title: 'پنج کار در یک لحظه' },
      sentence: {
        text: 'انبار کم شد، صندوق پر شد، سند دفتر خورد، طلب مشتری ثبت شد، سود معلوم شد.',
        intent:
          'Five panels burst around the character: stock, till, ledger, customer balance, profit',
        ...provisional,
        words: [
          w('انبار', 0.2, 0.6, { emphasis: true, action: 'panel-stock-in', sound: 'impact' }),
          w('کم', 0.6, 0.85),
          w('شد،', 0.85, 1.15),
          w('صندوق', 1.35, 1.8, { emphasis: true, action: 'panel-till-in', sound: 'cash' }),
          w('پر', 1.8, 2.0),
          w('شد،', 2.0, 2.3),
          w('سند', 2.5, 2.85, { emphasis: true, action: 'panel-ledger-in', sound: 'tick' }),
          w('دفتر', 2.85, 3.15),
          w('خورد،', 3.15, 3.5),
          w('طلب', 3.7, 4.0, { emphasis: true, action: 'panel-credit-in', sound: 'cardEnter' }),
          w('مشتری', 4.0, 4.35),
          w('ثبت', 4.35, 4.6),
          w('شد،', 4.6, 4.9),
          w('سود', 5.1, 5.5, { emphasis: true, action: 'panel-profit-in', sound: 'success' }),
          w('معلوم', 5.5, 5.9),
          w('شد.', 5.9, 6.2),
        ],
        // 7.5 − 6.2 = 1.3 s of hold on the full picture.
        sentenceEnding: { at: 6.2, action: 'multi-split-hold' },
      },
    },

    // Beat 6 — «حساب… چه» (30.5 – 33.5)
    {
      start: 30.5,
      end: 33.5,
      vo: 'حساب… چه.',
      spec: { kind: 'word-sync', actor: 'r69-brand-outro', title: 'حسابچه' },
      sentence: {
        text: 'حساب… چه.',
        intent: 'White outro: «حساب» slides in, «چه» locks onto it, hisabche.com underneath',
        ...provisional,
        words: [
          w('حساب…', 0.2, 0.8, {
            emphasis: true,
            action: 'brand-hesab-in',
            sound: 'softTransition',
          }),
          w('چه.', 1.1, 1.6, { emphasis: true, action: 'brand-che-lock', sound: 'ctaResolution' }),
        ],
        sentenceEnding: { at: 1.6, action: 'brand-final-hold' },
      },
    },
  ],
}
