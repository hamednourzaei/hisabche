// ============================================
// Reel 81: Team & Payroll Settlement - Dispute-Free Wages
// Motion Template: vox-documentary-collage
// Funnel Stage: Team & Governance | Audience: Business Owners, Retail Stores, Workshops
// ============================================

import type { Reel } from '../engine/types'
import { ctaScene, sequence, total } from './shared'

const scenes = sequence(
  [
    {
      dur: 4,
      spec: {
        kind: 'hook',
        label: 'مدیریت پرسنل، شیفت و حقوق و دستمزد',
        lines: ['روز پرداخت حقوقه،', 'و [r:سر مساعده‌ها و غیبت‌ها دعواست]!'],
        cards: [
          { icon: 'users', title: 'پرسنل و شیفت‌ها', sub: 'کارکرد روزانه تیم', tone: 'cyan' },
          { icon: 'book', title: 'دفترچه دستی دستمزد', sub: 'خط‌خورده و مبهم', tone: 'red' },
        ],
      },
      vo: 'پایان ماهه؛ کارمند می‌گه اضافه کار داشتم، مدیر می‌گه مساعده گرفتی؛ کی ثبتش کرده؟',
    },
    {
      dur: 8,
      spec: {
        kind: 'vox-documentary',
        title: 'پرونده کارکرد پرسنل و تسویه حقوق',
        headline: 'شفافیت فیش حقوقی پرسنل بدون اختلاف محاسباتی',
        documentNumber: 'PAYROLL-2026-M08',
        badgeText: 'تطبیق کارکرد',
        clippingTitle: 'کسر سیستمی مساعده',
        clippingText: 'مساعده‌های دریافتی در طول ماه خودکار از حقوق پایه کسر گردید',
        dark: true,
      },
      vo: 'در حسابچه، مساعده، جریمه و پاداش در طول ماه ثبت می‌شه و فیش حقوقی شفاف، جلوی هر اختلافی رو می‌گیره.',
    },
    {
      dur: 8,
      spec: {
        kind: 'stagger',
        title: 'تسویه دقیق و [c:سند خودکار حقوق] حسابچه',
        header: ['فیش حقوقی رسمی', 'تراز کامل دفاتر'],
        rows: [
          { icon: 'users', text: 'ساعات کارکرد واقعی و اضافه کاری' },
          { icon: 'wallet', text: 'کسر خودکار مساعده‌های دریافتی' },
          { icon: 'receipt', text: 'چاپ فیش حقوقی تفکیک‌شده' },
          { icon: 'book', text: 'ثبت خودکار سند دوبل هزینه حقوق' },
        ],
        interval: 1.0,
        tone: 'purple',
      },
      vo: 'فیش صادر می‌شه، سند به دفتر کل می‌ره و حساب همه مثل روز روشن تراز می‌مونه.',
    },
    ctaScene(7),
  ],
  { noZoom: true },
)

export const reel81: Reel = {
  id: '81',
  title: 'حقوق و دستمزد تیم: مساعده، غیبت، اضافه کاری؛ آخر ماه کی چقدر طلبکاره؟',
  duration: total(scenes),
  scenes,
  theme: 'swiss-editorial',
  noZoom: true,
  storyMatrix: {
    targetCustomer: 'retail-shopkeeper',
    customerPain: 'درگیری هرماهه میان مدیر و پرسنل بر سر مساعده، اضافه کاری و جریمه تأخیر',
    oldWorkflow: 'نوشتن ساعت ورود و مساعده در سررسید رومیزی و مفقود شدن برگه‌ها',
    friction: 'کارمند احساس بی عدالتی می‌کند و مدیر فکر می‌کند پول اضافه پرداخت کرده است',
    hisabcheAction: 'لینک ثبت تردد اختصاصی کارمند، ثبت آنی مساعده در پرونده و صدور فیش رسمی',
    automatedResult: 'محاسبه ریاضی خودکار، کسر وام و مساعده و صدور سند دوبل هزینه حقوق در دفتر',
    businessOutcome: 'رضایت صد درصدی تیم، انگیزه کاری بالا و انضباط کامل مالی پرسنل',
    emotionalPayoff: 'پایان دعواهای اول ماه و تسویه با لبخند و احترام متقابل',
    cta: 'حقوق و دستمزد در hisabche.com',
    selectedOperators: ['VoxArchivalStamp', 'HighlighterSweep', 'DualBoxCtaHold'],
  },
}
