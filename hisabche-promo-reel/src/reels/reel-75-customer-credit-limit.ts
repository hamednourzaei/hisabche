// ============================================
// Reel 75: Customer Credit Limit - Receivables Risk Shield
// Motion Template: chat-panic-to-calm
// Funnel Stage: Risk Control | Audience: Retailers, Wholesalers, Distributors
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'مدیریت نسیه و پرونده مشتری',
        lines: ['مشتری پای پیشخوان نسیه می‌خواد،', 'ولی [r:حساب قبلیش هنوز تسویه نشده]!'],
        cards: [
          { icon: 'user', title: 'سقف مجاز نسیه', sub: '۲۰٬۰۰۰ سقف اعتبار', tone: 'cyan' },
          { icon: 'wallet', title: 'بدهی جاری معوق', sub: '۲۵٬۴۰۰ فراتر از سقف!', tone: 'red' },
        ],
      },
      vo: 'شاگرد مغازه می‌پرسه به این مشتری جنس بدیم؟ تعارف می‌کنی یا سیستم جلوت رو می‌گیره؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'chat-panic',
        title: 'آشفتگی پیام‌های شاگردان در برابر پرونده متمرکز مشتری',
      },
      vo: 'پیام‌ها سرازیر می‌شن: "فلانی نسیه می‌خواد"، "چکش پاس نشده"؛ همه در پرونده شفاف مشتری آرام می‌گیرند.',
    },
    {
      dur: 7,
      spec: {
        kind: 'branch',
        cards: [
          { icon: 'user', title: 'پرونده مشتری', sub: 'سابقه و گردش مالی', tone: 'cyan' },
          {
            icon: 'wallet',
            title: 'سقف اعتبار هوشمند',
            sub: 'قفل خودکار فاکتور نسیه',
            tone: 'purple',
          },
        ],
        question: 'چطور بدون رودربایستی نسیه را مهار کنیم؟',
        answer: 'قفل خودکار اعتبار در حسابچه',
        badge: 'کنترل ریسک بدهی معوق',
      },
      vo: 'حسابچه تعارف ندارد؛ اگر مشتری از سقف اعتبار گذشت، فاکتور نسیه صادر نمی‌شود تا تسویه کند.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel75: Reel = {
  id: '75',
  title: 'پرونده مشتری و سقف اعتبار: به کی چقدر نسیه بدهیم؟',
  duration: total(scenes),
  scenes,
  theme: 'midnight-gold',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'wholesaler',
    customerPain: 'سوخت شدن طلب‌ها به دلیل رودربایستی با مشتریان قدیمی و نسیه بی‌حساب',
    oldWorkflow: 'فروشنده با یادداشت روی کاغذ جنس نسیه می‌دهد و موعدها از خاطر می‌رود',
    friction: 'مشتری صد میلیون بدهکار است و باز هم تقاضای بار جدید بدون پرداخت دارد',
    hisabcheAction: 'تعیین سقف اعتبار، مهلت بازپرداخت، و قفل هوشمند صدور فاکتور فراتر از سقف',
    automatedResult: 'جلوگیری آنی از بارگیری برای مشتری بدهکار و ارسال صورتحساب خودکار',
    businessOutcome: 'کاهش ۹۰ درصدی مطالبات معوق و جریان نقدی پایدار برای خرید بار تازه',
    emotionalPayoff: 'پایان استرس وصول مطالبات و برخورد حرفه‌ای سیستم به‌جای دعوا',
    cta: 'سقف اعتبار در hisabche.com',
    selectedOperators: ['ChatPanicCollapse', 'MagneticPillSnap', 'DualBoxCtaHold'],
  },
}
