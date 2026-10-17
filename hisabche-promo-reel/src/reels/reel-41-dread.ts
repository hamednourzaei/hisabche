// ============================================
// Hisabche Motion Design Studio — Reel 41
//
// High-Conversion Psychological Dread & Loss-Aversion Promotional Film:
// «اگر هنوز دفتر دستی داری؛ این فاجعه حتمی در کمین توست!»
//
// Rooted deeply in the visceral reality of Iranian bazaar shopkeepers & traders:
// - Faded thermal POS receipts turning blank white
// - Disputed / denied debts after months («I never took this goods, where is your proof?»)
// - Bounced checks & frozen bank accounts caused by untracked cashflow
// - Punitive arbitrary tax assessments due to handwritten books having zero legal standing
// - Irresistible relief & psychological peace: Hisabche's immutable digital audit trail
//
// Technical Governance:
// - Art Direction: kinetic-manifesto (High-contrast typographic velocity & tension)
// - Layout Topology: split-screen-horizon (Horizon split separating nightmare from digital armor)
// - Duration: Exactly 59 seconds (Deterministic frame math)
// - Card Quota: Max 1 card-based scene (Scene 1 only, 4 cardless analytical scenes)
// - RTL HarfBuzz-safe typography & voiceover under 2.8 words/sec
// ============================================

import type { Reel } from '../engine/types'
import { sequence, total } from './shared'

const reel = (
  id: string,
  title: string,
  parts: Parameters<typeof sequence>[0],
  theme?: Reel['theme'],
  storyMatrix?: Reel['storyMatrix'],
): Reel => {
  const scenes = sequence(parts)
  return { id, title, duration: total(scenes), scenes, theme, storyMatrix }
}

export const reel41 = reel(
  '41',
  'اگر هنوز دفتر دستی داری؛ این فاجعه حتمی در کمین توست!',
  [
    // Scene 01: Hook (7s) — Visceral nightmare of faded receipt & denied debt
    {
      dur: 7,
      spec: {
        kind: 'hook',
        label: 'کابوس واقعی بازار',
        lines: ['اگر هنوز با دفتر دستی کار می‌کنی؛', 'این [r:فاجعه دیر یا زود] سراغت می‌آید!'],
        cards: [
          {
            icon: 'alert',
            title: 'فیش‌های محوشده پوز',
            sub: 'کاغذ حرارتی سفید شد؛ مدرکت سوخت!',
            tone: 'red',
          },
          {
            icon: 'shield',
            title: 'حاشا شدن ۳۰۰ میلیون طلب',
            sub: 'بدون امضای رسمی، دادگاه جوابت کرد!',
            tone: 'cyan',
          },
        ],
      },
      vo: 'رسید حرارتی سفید شد، مشتری زد زیرش و ۳۰۰ میلیون طلبت پَر کشید؛ چون دفتر دستی هیچ اعتبار قانونی نداره!',
    },

    // Scene 02: Split Horizon (16s) — The crisis: Disputed debt & tax audit vs Immutable cloud ledger
    {
      dur: 16,
      spec: {
        kind: 'split',
        title: 'کابوس مغایرت: [r:۳۰۰ میلیون حاشا شد] در برابر [c:سند ضد جعل]',
        dividerLabel: 'فروپاشی دستی vs زره حسابچه',
        left: {
          title: 'سیستم سنتی (فاجعه دست‌خط)',
          subtitle: 'سررسید دستی و فیش‌های محوشونده',
          points: [
            'انکار آسان بدهی توسط مشتری بعد از چند ماه',
            'رد کامل دفاتر دستی توسط ممیز مالیاتی',
            'برگشت خوردن چک خرید به خاطر طلب سوخت‌شده',
          ],
          tone: 'red',
        },
        right: {
          title: 'حسابچه (سند رسمی کلاود)',
          subtitle: 'تأییدیه پیامکی و زنجیره دیجیتال',
          points: [
            'ارسال لینک فاکتور و تأیید آنی با امضای دیجیتال',
            'تراز مالی تغییرناپذیر با ثبت استاندارد دارایی',
            'پیش‌بینی دقیق نقدینگی و حفظ ۱۰۰٪ اعتبار بازار',
          ],
          tone: 'cyan',
        },
      },
      vo: 'وقتی مدرک معتبر نداری، رفیق بیست‌ساله هم بدهی‌اش رو انکار می‌کنه و ممیز مالیاتی دفاتر دستی‌ات رو پرت می‌کنه کنار؛ اما در حسابچه، هر فاکتور با امضای پیامکی در کلاود ضدجعل ثبت می‌شه.',
    },

    // Scene 03: Compare Matrix (14s) — Legal validity in tax inspection & dispute resolution
    {
      dur: 14,
      spec: {
        kind: 'compare',
        title: 'اعتبار حقوقی و مالی: [r:دفتر کاغذی] در برابر [c:حسابچه]',
        columns: ['شاخص حیاتی', 'سررسید دستی', 'فیش پوز کاغذی', 'حسابچه'],
        rows: [
          { label: 'سندیت در دادگاه و حل اختلاف', marks: ['no', 'no', 'yes'] },
          { label: 'قبولی در ممیزی اداره مالیات', marks: ['no', 'no', 'yes'] },
          { label: 'ضمانت ماندگاری مادام‌العمر', marks: ['no', 'no', 'yes'] },
        ],
        interval: 0.4,
      },
      vo: 'دفتر کاغذی پاره می‌شه، جوهرش می‌ریزه و فیش پوز محو می‌شه؛ قانون فقط سند رسمی دیجیتال رو می‌شناسه. با حسابچه حتی یک ریال از حقوقت پایمال نمی‌شه.',
    },

    // Scene 04: Versus Scale (14s) — The cost of operating blind vs peace of mind
    {
      dur: 14,
      spec: {
        kind: 'versus',
        title: 'هزینه نداشتن حسابچه: [r:بر باد رفتن آبرو] در برابر [c:آرامش مطلق]',
        left: {
          label: 'بدون حسابچه (خطر نابودی)',
          value: '۳۰۰ میلیون سوخت طلب + جریمه سنگین',
          tone: 'red',
        },
        right: {
          label: 'با زره حسابچه (اقتدار کاسب)',
          value: 'تسلط بر ریال به ریال + خواب آرام شبانه',
          tone: 'cyan',
        },
        verdict: 'یک غفلت کوچک می‌تواند حاصل ۳۰ سال زحمت بازار را خاکستر کند',
      },
      vo: 'از دست رفتن ۳۰۰ میلیون طلب یا برگشت خوردن یک فقره چک، آبروی سی ساله در بازار رو نابود می‌کنه. حسابچه زره ضدگلوله سرمایه و شرافت کاری توئه.',
    },

    // Scene 05: Call to Action (8s) — Absolute conversion with visceral urgency
    {
      dur: 8,
      spec: {
        kind: 'cta',
        tagline: 'حسابچه | زره ضدگلوله اعتبار کسب‌وکار تو',
        boxes: [
          {
            lead: 'همین امروز از سرمایه‌ات محافظت کن',
            action: 'شروع رایگان',
            word: 'ثبت‌نام در یک دقیقه',
            tone: 'cyan',
          },
          {
            lead: 'پایان دلهره و چک‌های برگشتی',
            action: 'بیمه اعتبار بازار',
            word: 'دانلود نرم‌افزار حسابچه',
            tone: 'green',
          },
        ],
        switchAt: 4.0,
      },
      vo: 'همین امروز کسب‌وکارت رو بیمه کن و نگذار اعتبارت به تار مویی بند باشه. حسابچه، تکیه‌گاه محکم کاسب ایرانی.',
    },
  ],
  'kinetic-manifesto',
  {
    targetCustomer: 'retail-shopkeeper',
    customerPain:
      'انکار بدهی‌های میلیونی نسیه توسط مشتری، محو شدن فیش‌های پوز، و برگشت خوردن چک خرید به خاطر کسری نقدینگی',
    oldWorkflow:
      'نوشتن طلب‌ها در سررسید دستی و منگنه کردن فیش‌های حرارتی کارتخوان به برگه‌های دفتر',
    friction:
      'سفید شدن کاغذ حرارتی بعد از ۳ ماه، خط‌خطی شدن دفتر و فقدان کوچک‌ترین وجاهت قانونی در محاکم و اداره دارایی',
    hisabcheAction:
      'ثبت ابری لحظه‌ای، ارسال خودکار لینک فاکتور رسمی با پیامک، و تأییدیه دیجیتال دوطرفه',
    automatedResult:
      'سند حقوقی تغییرناپذیر، کاردکس لحظه‌ای، بایگانی مادام‌العمر و پیش‌بینی تسویه چک‌ها',
    businessOutcome:
      'صفر شدن سوخت مطالبات، پیشگیری قطعی از جریمه‌های سنگین مالیاتی، و حفظ سفت‌وسخت آبروی ۳۰ ساله در بازار',
    emotionalPayoff:
      'پایان دلهره و استرس شبانه؛ حس قدرت، اقتدار و اطمینان خاطر از ریال به ریال سرمایه زندگی',
    cta: 'زره ضدگلوله کسب‌وکارت را فعال کن | حسابچه',
    selectedOperators: [
      'Split-Screen Blade Shutter',
      'Kinetic Elastic Snap',
      'Odometer Slot Machine Roll',
      'Dynamic Spotlight Cone',
      'Glassmorphic Edge Refraction',
    ],
  },
)
