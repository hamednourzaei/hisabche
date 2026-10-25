// ============================================
// Reel 91 — «شوک عدد» (result-first profit shock, engine-composed)
//
// Frame 0 opens on the finished result — «سود خالص ۲۴٪» — while the sale it
// came from towers behind it («فروش ۲۵٬۰۰۰٬۰۰۰»). Then the real anatomy
// unwinds: the gross-profit ladder, three cost cards swarming in, the
// waterfall that connects every deduction into one final number, and the
// lesson: sales is not profit.
//
// One persistent arithmetic:
//   ۲۵٬۰۰۰٬۰۰۰ فروش − ۱۵٬۲۰۰٬۰۰۰ بهای تمام‌شده − ۳٬۸۰۰٬۰۰۰ خرج
//   = ۶٬۰۰۰٬۰۰۰ سود خالص (= ۲۴٪ فروش)
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    // 1 — frame-0 arrest: the result lands before the process is told.
    {
      dur: 4,
      spec: {
        kind: 'hook',
        theme: 'obsidian-cinematic',
        openingArchetype: 'immediate-consequence',
        label: 'فروش بالا، سود نامعلوم',
        lines: ['سود خالص ۲۴٪', '[r:فروش ۲۵٬۰۰۰٬۰۰۰]'],
        consequence: {
          alertBanner: 'فاصلهٔ فروش تا سود روشن نیست',
          stoppedAction: 'حقوق و ارسال هنوز در حساب نیست',
          lossMetric: 'سود واقعی، نامشخص',
        },
      },
      vo: 'بیست و پنج میلیون فروش؛ آخرش چقدر سود ماند؟',
    },

    // 2 — the gross-profit ladder: what the sale kept before all bills.
    {
      dur: 5,
      spec: {
        kind: 'financial-intelligence',
        theme: 'financial-intelligence',
        title: 'از فروش تا سود ناخالص',
        revenue: 25000000,
        cogs: 15200000,
        grossProfit: 9800000,
        verdict: 'خرج‌ها هنوز کم نشده...',
      },
      vo: 'بهای تمام‌شده پانزده میلیون و دویست هزار؛ سود ناخالص نه میلیون و هشتصد هزار.',
    },

    // 3 — three cost cards swarm in and chomp at the number.
    {
      dur: 5,
      spec: {
        kind: 'pile',
        theme: 'midnight-gold',
        title: 'سه خرج اصلی',
        papers: [
          { icon: 'boxes', label: 'بهای جنس' },
          { icon: 'briefcase', label: 'حقوق' },
          { icon: 'truck', label: 'ارسال' },
        ],
        counter: '۳ خرج',
        merge: 'از فروش کم می‌شوند',
      },
      vo: 'بهای جنس، حقوق، ارسال؛ هر کدام از فروش کم می‌کند.',
    },

    // 4 — the waterfall connects every deduction into one final number.
    {
      dur: 8,
      spec: {
        kind: 'profit-waterfall-demo',
        theme: 'financial-intelligence',
        title: 'محاسبهٔ [g:سود واقعی]',
        grossRevenue: 25000000,
        cogs: 15200000,
        expenses: 3800000,
      },
      vo: 'سود واقعی شش میلیون است؛ یعنی بیست و چهار درصد فروش.',
    },

    // 5 — the lesson: two numbers, two stories.
    {
      dur: 4,
      spec: {
        kind: 'kinetic',
        theme: 'midnight-gold',
        headline: 'فروش ≠ سود',
        words: ['فروش', '≠', 'سود'],
        sub: 'دو عدد، دو داستان',
        tone: 'cyan',
      },
      vo: 'فروش بالا همیشه سود بالا نیست.',
    },

    // 6 — the closing CTA.
    ctaScene(6),
  ],
  { noZoom: true },
)

export const reel91: Reel = {
  id: '91',
  title: 'شوک عدد — فروش ۲۵ میلیون، سود فقط ۶ میلیون',
  duration: total(scenes),
  scenes,
  theme: 'financial-intelligence',
  musicMood: 'uplifting',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'فروش بالا، سود نامعلوم',
    oldWorkflow: 'حدس زدن سود از حافظه',
    friction: 'خرج‌ها پنهان می‌مانند',
    hisabcheAction: 'جداسازی بهای تمام‌شده و خرج‌ها',
    automatedResult: 'آبشار سود تا عدد نهایی',
    businessOutcome: 'تصمیم روی عدد روشن',
    emotionalPayoff: 'شوک عدد واقعی',
    cta: 'اکنون رایگان شروع کن',
    selectedOperators: [
      'ProfitShockNumber',
      'SaleCardDrop',
      'CostCardSwarm',
      'ConnectLineTrace',
      'FinalSumReveal',
    ],
  },
}
