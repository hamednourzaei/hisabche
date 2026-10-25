// ============================================
// Reel 73: Till & Shift Closing - Cash Accountability
// Motion Template: split-screen-stopwatch
// Funnel Stage: Operational Discipline | Audience: Retailers, Supermarkets, Cashiers
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'مدیریت صندوق و تحویل شیفت',
        lines: ['ساعت ۱۰ شب پای کرکره،', 'ولی [r:دخل صندوق جور نیست]!'],
        cards: [
          { icon: 'calculator', title: 'جمع فاکتورها', sub: '۴۸٬۲۰۰ ثبت سیستمی', tone: 'cyan' },
          { icon: 'wallet', title: 'شمارش نقدی', sub: 'فقط ۴۵٬۰۰۰ در کشو!', tone: 'red' },
        ],
      },
      vo: 'پای بستن مغازه، پول داخل کشو با کارتخوان و فاکتورها نمی‌خونه؛ کی اشتباه کرده؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'split-stopwatch',
        topTitle: 'روش سنتی: شمارش دستی و خطای صندوق',
        topSub: '۴۵ دقیقه استرس، بازبینی دوباره فیش‌های کارتخوان و جروبحث',
        topBody: 'کسری ۳٬۲۰۰ نامشخص پای تحویل شیفت',
        topFooter: 'ساعت ۱۱ شب هنوز کرکره پایین نیامده',
        bottomTitle: 'روش حسابچه: تسویه ۳ ثانیه‌ای شیفت',
        bottomSub: 'تفکیک خودکار وجه نقد، پوز بانکی و خروجی‌های تأییدشده',
        bottomBody: 'تراز آنی با دقت کامل بدون ابهام',
        bottomFooter: 'تایید نهایی با یک کلیک و چاپ رسید شیفت',
      },
      vo: 'در حسابچه، صندوقدار قبل از بستن، اسکناس‌ها را می‌شمارد و سیستم فوراً مغایرت را به تفکیک شیفت نشان می‌دهد.',
    },
    {
      dur: 7,
      spec: {
        kind: 'ledger',
        title: 'بستن قطعی شیفت صندوقداری',
        name: 'صندوق فروشگاه مرکزی - شیفت عصر',
        lines: [
          { label: 'فروش نقدی ثبت‌شده', amount: '۱۵٬۰۰۰' },
          { label: 'دریافتی کارتخوان متصل', amount: '۳۰٬۰۰۰' },
          { label: 'وصول طلب نسیه', amount: '۳٬۲۰۰' },
        ],
        balanceFrom: 48200,
        balanceTo: 0,
        unit: '',
        footer: 'صندوق با موفقیت بسته شد و سند دوبل به دفتر کل منتقل گردید',
      },
      vo: 'یک کلیک، بستن رسمی صندوق و انتقال اتوماتیک سند تراز به حسابداری.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel73: Reel = {
  id: '73',
  title: 'صندوق و شیفت: دخل فقط وقتی بسته می‌شود که شمرده شود!',
  duration: total(scenes),
  scenes,
  theme: 'dark-neon',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'کسری مجهول پول در دخل پای صندوق و دعوا میان صندوقدار و صاحب مغازه',
    oldWorkflow: 'جمع کاغذی فیش‌های پوز و شمارش اسکناس در تاریکی پایان شب',
    friction: 'صندوقدار مدعی است اشتباه نشده، مدیر مطمئن است پول گم شده است',
    hisabcheAction: 'فرایند اجباری شمارش فیزیکی صندوق قبل از بستن و اتصال به پوز هوشمند',
    automatedResult: 'گزارش شفاف مابه‌التفاوت شمارش نقدی با فروش ثبت‌شده و بستن شیفت',
    businessOutcome: 'پایان کامل نشتی صندوق و آرامش روانی پرسنل در تحویل شیفت',
    emotionalPayoff: 'بستن بی‌دردسر کرکره مغازه در ۵ دقیقه با اطمینان کامل',
    cta: 'مدیریت حرفه‌ای صندوق در hisabche.com',
    selectedOperators: ['SplitStopwatchShutter', 'LiveLedgerCountdown', 'DualBoxCtaHold'],
  },
}
