// ============================================
// Reel 79: Dead Stock & Stagnant Capital - Liquidity Recovery
// Motion Template: thermal-receipt-scroll
// Funnel Stage: Working Capital | Audience: Retailers, Wholesalers, Distributors
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'مدیریت سرمایه راکد و موجودی انبار',
        lines: ['انبارت پر از کارتن‌هاییه که', '[r:شش ماهه تکون نخورده]!'],
        cards: [
          { icon: 'boxes', title: 'سرمایه حبس‌شده', sub: 'کالای راکد و کم‌گردش', tone: 'red' },
          {
            icon: 'wallet',
            title: 'نقدینگی در گردش',
            sub: 'کمبود پول برای بار جدید',
            tone: 'cyan',
          },
        ],
      },
      vo: 'پول توی انبارت خوابیده و گردوخاک می‌خوره، بعد برای خرید بار تازه لنگ چکت شدی؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'thermal-receipt',
        title: 'چاپ فیش هشدارهای رسوب کالا و تاریخ انقضا',
      },
      vo: 'در حسابچه، گزارش کالای راکد اقلامی که بیش از ۶۰ روز فروش نرفته‌اند را قبل از افت قیمت نشان می‌دهد.',
    },
    {
      dur: 7,
      spec: {
        kind: 'versus',
        title: 'سرمایه خوابیده در برابر [c:نقدینگی آزاد حسابچه]',
        left: { label: 'کالای خاک‌خورده در قفسه', value: 'خواب سرمایه و افت ارزش', tone: 'red' },
        right: { label: 'پیشنهاد هوشمند حراج', value: 'تزریق آنی نقدینگی به دخل', tone: 'green' },
        verdict: 'شناسایی خودکار رسوب کالا و پیشنهاد تخفیف برای گردش سرمایه',
      },
      vo: 'با تخفیف هوشمند نقدش کن؛ پولت رو برگردون به چرخه خرید جنس‌های پرفروش.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel79: Reel = {
  id: '79',
  title: 'کالای خاک‌خورده و سرمایه راکد (Dead Stock): ۶ ماهه تکون نخورده!',
  duration: total(scenes),
  scenes,
  theme: 'dark-neon',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'بلوکه شدن نقدینگی در خریدهای اشتباه و کالاهایی که ماه‌ها در انبار می‌مانند',
    oldWorkflow: 'بی‌خبری از موجودی تاریخ گذشته تا زمان دور ریختن یا زیان سنگین',
    friction: 'کاسب فکر می‌کند انبارش پربار است، ولی نقدینگی برای خرید کالای پرتقاضا ندارد',
    hisabcheAction: 'گزارش تحلیلی Dead Stock، میانگین زمان توقف کالا در قفسه و آلارم انقضا',
    automatedResult: 'پیشنهاد هوشمند باندل تخفیف‌دار برای تخلیه سریع کالا و احیای نقدینگی',
    businessOutcome: 'آزادسازی سرمایه راکد و جلوگیری از ضایعات ۱۰۰ درصدی کالا',
    emotionalPayoff: 'سبک‌بالی از انبار تر و تمیز و چرخش تند نقدینگی در دخل',
    cta: 'کالای راکد در hisabche.com',
    selectedOperators: ['ThermalReceiptTear', 'EmeraldFlashPulse', 'DualBoxCtaHold'],
  },
}
