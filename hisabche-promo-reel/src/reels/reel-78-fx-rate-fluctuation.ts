// ============================================
// Reel 78: Multi-Currency & FX Gain/Loss - Currency Fluctuation Shield
// Motion Template: continuous-line-traveler
// Funnel Stage: Financial Precision | Audience: Exchangers, Importers, Multi-Currency Merchants
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'مدیریت چندارزی و تسعیر',
        lines: ['فاکتور به دالر،', 'دفتر به تومان و افغانی؛', '[r:سود یا زیان نرخ]؟'],
        cards: [
          { icon: 'coins', title: 'فاکتور ارزی', sub: '۱٬۰۰۰ دالر با نرخ روز', tone: 'cyan' },
          {
            icon: 'trend',
            title: 'تسویه با تأخیر',
            sub: 'نوسان بازار در لحظه پرداخت',
            tone: 'purple',
          },
        ],
      },
      vo: 'صبح جنس رو با یک نرخ ارز فروختی، عصر که پول واریز شد نرخ پرید؛ سود کردی یا ضرر؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'continuous-line',
        title: 'ردگیری ممتد نوسان ارز و ثبت خودکار سود و زیان تسعیر',
      },
      vo: 'در حسابچه هیچ فاکتور ارزی بدون نرخ روز ثبت نمی‌شه؛ سیستم خودش مابه‌التفاوت رو در سرفصل تسعیر ثبت می‌کنه.',
    },
    {
      dur: 8,
      spec: {
        kind: 'bridge',
        title: 'تسعیر چندارزی؛ [c:تراز دقیق در دفتر کل]',
        left: { icon: 'coins', title: 'فاکتور به ارز خارجی', tone: 'cyan' },
        right: { icon: 'book', title: 'دفاتر به ارز پایه', tone: 'purple' },
        merged: 'حسابچه',
        caption: 'محاسبه خودکار سود و زیان تسعیر ارز در لحظه تسویه',
        summaries: [
          {
            question: 'برای صراف و واردکننده',
            answer: 'تراز ارزی لحظه‌ای بدون مغایرت',
            tone: 'cyan',
            icons: ['coins', 'sparkles'],
          },
          {
            question: 'برای حسابدار رسمی',
            answer: 'سند تسعیر خودکار مطابق استاندارد',
            tone: 'purple',
            icons: ['book', 'check'],
          },
        ],
      },
      vo: 'نه سود کاغذی اشتباه می‌بینی، نه در نوسان بازار کلاه سرت می‌ره.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel78: Reel = {
  id: '78',
  title: 'نرخ ارز و تسعیر: دالر صبح ۷۰، عصر ۷۲؛ سود و زیان تسعیر کجاست؟',
  duration: total(scenes),
  scenes,
  theme: 'midnight-gold',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'محو شدن سود بازرگان به دلیل نوسانات شدید نرخ ارز میان تاریخ فاکتور و وصول',
    oldWorkflow: 'ثبت فاکتور ارزی بدون ثبت نرخ تبدیل و حساب‌وکتاب در اکسل‌های نامطمئن',
    friction: 'تاجر فکر می‌کند فاکتور پر سود بوده، در حالی که پس از تسعیر با زیان بسته شده است',
    hisabcheAction: 'فاکتور ارزی با نرخ اجباری روز، جدول نرخ‌های لحظه‌ای و سند خودکار تسعیر',
    automatedResult: 'ثبت تفکیک‌شده سود بازرگانی و سود/زیان تسعیر ارز در ترازنامه رسمی',
    businessOutcome: 'کنترل کامل ریسک نوسان ارز و امنیت کامل سرمایه در معاملات مرزی و بین‌المللی',
    emotionalPayoff: 'تسلط کامل بر چند ارز بدون یک ریال یا افغانی مغایرت در پایان سال',
    cta: 'چندارزی در hisabche.com',
    selectedOperators: ['ContinuousLineMorph', 'VectorThreadDraw', 'DualBoxCtaHold'],
  },
}
