// packages/ui/src/components/ui/landing/faq-scene.tsx
//
// SERVER COMPONENT. The accordion is native <details>/<summary>: the same
// open/close behaviour, keyboard and screen-reader support built in, and no
// JavaScript to hydrate. As a client component with useState it was one of the
// larger trees React had to hydrate on load (headless-Chrome profile at
// PageSpeed-like CPU speed: ~340 ms of hydration across the landing).
import { cn } from '../../../lib/utils'
import { LANDING_CONTAINER, LANDING_SECTION, SectionHeader } from './landing-primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   FaqScene v8 — SEO-optimised · 16 questions · categories · internal links
   ═══════════════════════════════════════════════════════════════════════════ */

export interface FaqSceneProps {
  t: (key: string, fallback?: string) => string
}

/* ── Category & item definitions ────────────────────────────────────────── */

interface FaqItem {
  id: string
  questionKey: string
  answerKey: string
  fallbackQuestion: string
  fallbackAnswer: string
  relatedLink?: string | undefined
  relatedLabelKey?: string | undefined
  relatedFallback?: string | undefined
}

interface FaqCategory {
  id: string
  titleKey: string
  fallbackTitle: string
  items: FaqItem[]
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'start',
    titleKey: 'landing.faq.category.start',
    fallbackTitle: 'شروع کار',
    items: [
      {
        id: 'start1',
        questionKey: 'faq.start1Q',
        answerKey: 'faq.start1A',
        fallbackQuestion: 'آیا حسابچه رایگان است؟',
        fallbackAnswer:
          'بله، نسخه رایگان حسابچه برای یک کسب‌وکار و امکانات اصلی کاملاً رایگان است. برای امکانات پیشرفته می‌توانید نسخه تجاری را تهیه کنید.',
        relatedLink: '#pricing',
        relatedLabelKey: 'landing.faq.related.pricing',
        relatedFallback: 'مشاهده قیمت‌ها',
      },
      {
        id: 'start2',
        questionKey: 'faq.start2Q',
        answerKey: 'faq.start2A',
        fallbackQuestion: 'چطور حسابچه را شروع کنم؟',
        fallbackAnswer:
          'کافی است روی دکمه «شروع رایگان» کلیک کنید و شماره موبایل خود را وارد کنید. هیچ کارت بانکی لازم ندارید. بعد از تأیید شماره، حسابچه بلافاصله آماده است.',
        relatedLink: '#hero',
        relatedLabelKey: 'landing.faq.related.signup',
        relatedFallback: 'شروع رایگان',
      },
      {
        id: 'start3',
        questionKey: 'faq.start3Q',
        answerKey: 'faq.start3A',
        fallbackQuestion: '',
        fallbackAnswer: '',
        relatedLink: '#features',
        relatedLabelKey: 'landing.faq.related.signup',
        relatedFallback: 'شروع رایگان',
      },
    ],
  },
  {
    id: 'offline',
    titleKey: 'landing.faq.category.offline',
    fallbackTitle: 'آفلاین و همگام‌سازی',
    items: [
      {
        id: 'offline1',
        questionKey: 'faq.offline1Q',
        answerKey: 'faq.offline1A',
        fallbackQuestion: 'آیا حتماً باید اینترنت داشته باشم؟',
        fallbackAnswer:
          'خیر. حسابچه کاملاً آفلاین کار می‌کند. می‌توانید فاکتور ثبت کنید، موجودی را بروز کنید و مشتری اضافه کنید، حتی وقتی اینترنت قطع است. به محض اتصال دوباره، همه چیز به‌طور خودکار همگام‌سازی می‌شود.',
        // Was '#business-flow', which pointed at TransformScene — a section
        // removed from the page (see landing-page.tsx). No element with that id
        // exists, so the link was a dead in-page jump. #security is the section
        // that actually covers offline storage and sync.
        relatedLink: '#security',
        relatedLabelKey: 'landing.faq.related.offlineFlow',
        relatedFallback: 'نحوه کار آفلاین',
      },
      {
        id: 'offline2',
        questionKey: 'faq.offline2Q',
        answerKey: 'faq.offline2A',
        fallbackQuestion: 'اگر گوشی‌ام خراب شود، اطلاعاتم از بین می‌رود؟',
        fallbackAnswer:
          'خیر. تمام اطلاعات شما در سرور امن حسابچه بک‌آپ می‌شود. همچنین نسخه‌ای امن روی خود گوشی ذخیره می‌شود. پس با خیال راحت کار کنید.',
        relatedLink: '#security',
        relatedLabelKey: 'landing.faq.related.security',
        relatedFallback: 'بیشتر درباره امنیت',
      },
      {
        id: 'offline3',
        questionKey: 'faq.offline3Q',
        answerKey: 'faq.offline3A',
        fallbackQuestion: 'روی چند گوشی می‌توانم استفاده کنم؟',
        fallbackAnswer:
          'با یک حساب می‌توانید همزمان روی چند دستگاه (موبایل، تبلت، لپ‌تاپ) وارد شوید. هماهنگی بین دستگاه‌ها به‌طور خودکار انجام می‌شود.',
      },
      {
        id: 'offline4',
        questionKey: 'faq.offline4Q',
        answerKey: 'faq.offline4A',
        fallbackQuestion: '',
        fallbackAnswer: '',
        relatedLink: '#offline',
        relatedLabelKey: 'landing.faq.related.offlineFlow',
        relatedFallback: 'نحوه کار آفلاین',
      },
      {
        id: 'offline5',
        questionKey: 'faq.offline5Q',
        answerKey: 'faq.offline5A',
        fallbackQuestion: '',
        fallbackAnswer: '',
        relatedLink: '#offline',
        relatedLabelKey: 'landing.faq.related.offlineFlow',
        relatedFallback: 'نحوه کار آفلاین',
      },
    ],
  },
  {
    id: 'accounting',
    titleKey: 'landing.faq.category.accounting',
    fallbackTitle: 'حسابداری و فروش',
    items: [
      {
        id: 'acc1',
        questionKey: 'faq.acc1Q',
        answerKey: 'faq.acc1A',
        fallbackQuestion: 'نسیه (بدهی مشتری) را چطور ثبت کنم؟',
        fallbackAnswer:
          'هنگام ثبت فروش، گزینه «نسیه» را انتخاب کنید. حسابچه به‌طور خودکار بدهی مشتری را ثبت می‌کند و در موعد مقرر به شما یادآوری می‌فرستد.',
        relatedLink: '#features',
        relatedLabelKey: 'landing.faq.related.debt',
        relatedFallback: 'ویژگی بدهکاران',
      },
      {
        id: 'acc2',
        questionKey: 'faq.acc2Q',
        answerKey: 'faq.acc2A',
        fallbackQuestion: 'می‌توانم موجودی انبارم را مدیریت کنم؟',
        fallbackAnswer:
          'بله. هر محصولی که تعریف کنید، موجودی آن به‌طور خودکار با هر فروش کاهش می‌یابد. همچنین قبل از تمام شدن کالا به شما هشدار داده می‌شود.',
        relatedLink: '#features',
        relatedLabelKey: 'landing.faq.related.inventory',
        relatedFallback: 'مدیریت انبار',
      },
      {
        id: 'acc3',
        questionKey: 'faq.acc3Q',
        answerKey: 'faq.acc3A',
        fallbackQuestion: 'چطور سود و زیانم را بفهمم؟',
        fallbackAnswer:
          'در داشبورد حسابچه، نمودار سود و زیان به‌طور لحظه‌ای قابل مشاهده است. می‌توانید سود روزانه، هفتگی و ماهانه خود را ببینید.',
        relatedLink: '#features',
        relatedLabelKey: 'landing.faq.related.reports',
        relatedFallback: 'گزارش‌های لحظه‌ای',
      },
      {
        id: 'acc4',
        questionKey: 'faq.acc4Q',
        answerKey: 'faq.acc4A',
        fallbackQuestion: '',
        fallbackAnswer: '',
        relatedLink: '#ledger',
        relatedLabelKey: 'landing.faq.related.reports',
        relatedFallback: 'گزارش‌های لحظه‌ای',
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'landing.faq.category.security',
    fallbackTitle: 'امنیت و پشتیبانی',
    items: [
      {
        id: 'sec1',
        questionKey: 'faq.sec1Q',
        answerKey: 'faq.sec1A',
        fallbackQuestion: 'اطلاعات من چقدر امن است؟',
        fallbackAnswer:
          'تمام داده‌ها در حال انتقال و ذخیره‌سازی رمزنگاری می‌شوند. همچنین نسخه پشتیبان روزانه گرفته می‌شود و شما مالک کامل داده‌های خود هستید.',
        relatedLink: '#security',
        relatedLabelKey: 'landing.faq.related.security',
        relatedFallback: 'جزئیات امنیت',
      },
      {
        id: 'sec2',
        questionKey: 'faq.sec2Q',
        answerKey: 'faq.sec2A',
        fallbackQuestion: 'چند کاربر می‌توانند همزمان کار کنند؟',
        fallbackAnswer:
          'بسته به پلن، می‌توانید کاربران متعدد با دسترسی‌های متفاوت اضافه کنید. حتی در پلن رایگان نیز می‌توانید یک حسابدار اضافی تعریف کنید.',
        relatedLink: '#features',
        relatedLabelKey: 'landing.faq.related.access',
        relatedFallback: 'مدیریت کاربران',
      },
      {
        id: 'sec3',
        questionKey: 'faq.sec3Q',
        answerKey: 'faq.sec3A',
        fallbackQuestion: '',
        fallbackAnswer: '',
        relatedLink: '#security',
        relatedLabelKey: 'landing.faq.related.security',
        relatedFallback: 'بیشتر درباره امنیت',
      },
    ],
  },
  {
    id: 'device',
    titleKey: 'landing.faq.category.device',
    fallbackTitle: 'دستگاه و سازگاری',
    items: [
      {
        id: 'dev1',
        questionKey: 'faq.dev1Q',
        answerKey: 'faq.dev1A',
        fallbackQuestion: 'روی گوشی‌های اندروید قدیمی کار می‌کند؟',
        fallbackAnswer:
          'بله. حسابچه طوری طراحی شده که روی گوشی‌های اندروید ۷ به بالا با ۲ گیگابایت رم به‌خوبی اجرا شود. حتی روی دستگاه‌های اقتصادی.',
      },
      {
        id: 'dev2',
        questionKey: 'faq.dev2Q',
        answerKey: 'faq.dev2A',
        fallbackQuestion: 'آیا نسخه ویندوز هم دارد؟',
        fallbackAnswer:
          'حسابچه تحت وب روی هر مرورگری قابل استفاده است (ویندوز، مک، لینوکس). همچنین اپلیکیشن اندروید اختصاصی دارد.',
      },
      {
        id: 'dev3',
        questionKey: 'faq.dev3Q',
        answerKey: 'faq.dev3A',
        fallbackQuestion: 'آیا می‌توانم چاپ فاکتور بگیرم؟',
        fallbackAnswer:
          'بله. تمام فاکتورها را می‌توانید به‌صورت PDF دریافت کنید و با هر چاپگری چاپ نمایید. قالب فاکتور ساده و شیک طراحی شده است.',
      },
    ],
  },
  {
    id: 'payment',
    titleKey: 'landing.faq.category.payment',
    fallbackTitle: 'هزینه و اشتراک',
    items: [
      {
        id: 'pay1',
        questionKey: 'faq.pay1Q',
        answerKey: 'faq.pay1A',
        fallbackQuestion: 'قیمت حسابچه چقدر است؟',
        // This answer used to advertise a "پلن Starter با ۹ دلار در ماه" — a plan
        // and a currency that appear nowhere in PLANS (pricing-scene.tsx), which
        // lists رایگان / حرفه‌ای at ۴۹۹ افغانی / تجاری by quote. The wrong figure
        // was also fed verbatim into the FAQPage structured data, so the schema
        // contradicted the visible pricing table on the same page.
        fallbackAnswer:
          'پلن رایگان برای شروع کاملاً رایگان است. پلن حرفه‌ای ۴۹۹ افغانی در ماه است و برای کسب‌وکارهایی مناسب است که فروش روزانه دارند. پلن تجاری برای چند شعبه به‌صورت اختصاصی قیمت‌گذاری می‌شود — با تیم فروش تماس بگیرید.',
        relatedLink: '#pricing',
        relatedLabelKey: 'landing.faq.related.pricing',
        relatedFallback: 'مشاهده تعرفه‌ها',
      },
      {
        id: 'pay2',
        questionKey: 'faq.pay2Q',
        answerKey: 'faq.pay2A',
        fallbackQuestion: 'آیا دوره آزمایشی دارد؟',
        fallbackAnswer:
          'بله، شما می‌توانید ۳۰ روز از نسخه حرفه‌ای به‌صورت رایگان استفاده کنید. بدون نیاز به کارت بانکی.',
      },
    ],
  },
]

const ALL_ITEMS = FAQ_CATEGORIES.flatMap((cat) => cat.items)
const INITIAL_COUNT = 6

type TranslatedItem = FaqItem & { question: string; answer: string; related?: string | undefined }

function translate(item: FaqItem, t: FaqSceneProps['t']): TranslatedItem {
  return {
    ...item,
    question: t(item.questionKey, item.fallbackQuestion),
    answer: t(item.answerKey, item.fallbackAnswer),
    related:
      item.relatedFallback !== undefined && item.relatedLabelKey
        ? t(item.relatedLabelKey, item.relatedFallback)
        : undefined,
  }
}

function FaqAccordionItem({ item }: { item: TranslatedItem }) {
  return (
    <details
      className={cn(
        'group overflow-hidden rounded-xl border transition-colors sm:rounded-2xl',
        'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.5)] hover:border-[hsl(var(--border-strong))]',
        'open:border-[hsl(var(--color-primary)/0.3)] open:bg-[hsl(var(--color-primary)/0.03)]',
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-start font-semibold text-[hsl(var(--fg-primary))] sm:gap-4 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
        <span className="text-sm leading-snug sm:text-base sm:leading-normal">{item.question}</span>
        {/* Chevron from two borders: one element instead of <svg> + <path> on
            each of 21 questions. The borders are end/bottom, so RTL needs the
            opposite rotation to point down. */}
        <span
          aria-hidden="true"
          className="me-1 size-2 shrink-0 rotate-45 border-b-2 border-e-2 border-[hsl(var(--fg-tertiary))] transition-transform duration-300 group-open:-rotate-[135deg] rtl:-rotate-45 rtl:group-open:rotate-[135deg]"
        />
      </summary>
      <div className="px-4 pb-3 text-sm leading-relaxed text-[hsl(var(--fg-secondary))] sm:px-5 sm:pb-4">
        {item.answer}
        {item.relatedLink && (
          <a
            href={item.relatedLink}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-[hsl(var(--color-primary))] after:content-['←'] hover:underline ltr:after:content-['→']"
          >
            {/* In-page link: a reading-direction arrow (CSS), not an
                "external link" icon — it never leaves the site. */}
            {item.related ?? 'بیشتر بدانید'}
          </a>
        )}
      </div>
    </details>
  )
}

function FaqJsonLd({ items }: { items: TranslatedItem[] }) {
  // Structured data must mirror the text actually in the served HTML. Every
  // question is in the document now (collapsed ones inside <details>, not
  // mounted on click), so every question is declared.
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
    />
  )
}

export default function FaqScene({ t }: FaqSceneProps) {
  const first = ALL_ITEMS.slice(0, INITIAL_COUNT)
  const firstIds = new Set(first.map((item) => item.id))
  const rest = FAQ_CATEGORIES.map((category) => ({
    ...category,
    items: category.items.filter((item) => !firstIds.has(item.id)),
  })).filter((category) => category.items.length > 0)

  return (
    <section id="faq" className={LANDING_SECTION}>
      <FaqJsonLd items={ALL_ITEMS.map((item) => translate(item, t))} />

      <div className={cn(LANDING_CONTAINER, 'max-w-3xl')}>
        <SectionHeader
          label={t('landing.faqLabel', 'پرسش‌های رایج')}
          title={t('landing.faqTitle', 'هر سوالی داری، اینجا جوابش هست')}
          description={t(
            'landing.faqDesc',
            'اگر پاسخت را پیدا نکردی، پشتیبانی حسابچه همیشه آماده کمک است.',
          )}
        />

        <div className="space-y-2 sm:space-y-3">
          {first.map((item) => (
            <FaqAccordionItem key={item.id} item={translate(item, t)} />
          ))}
        </div>

        {rest.length > 0 && (
          <details className="group/more mt-6 sm:mt-8">
            <summary className="mx-auto flex w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-[hsl(var(--border-default))] px-5 py-2.5 text-sm font-medium text-[hsl(var(--fg-secondary))] transition-colors hover:border-[hsl(var(--color-primary)/0.4)] hover:text-[hsl(var(--fg-primary))] group-open/more:hidden sm:px-6 sm:py-3 [&::-webkit-details-marker]:hidden">
              {t('faq.showMore', 'مشاهده همه سوالات')}
              <span
                aria-hidden="true"
                className="size-2 rotate-45 border-b-2 border-e-2 border-current rtl:-rotate-45"
              />
            </summary>
            <div className="space-y-6 sm:space-y-8">
              {rest.map((category) => (
                <div key={category.id}>
                  <h3 className="mb-2 px-1 text-sm font-semibold text-[hsl(var(--fg-secondary))] sm:mb-3">
                    {t(category.titleKey, category.fallbackTitle)}
                  </h3>
                  <div className="space-y-2 sm:space-y-3">
                    {category.items.map((item) => (
                      <FaqAccordionItem key={item.id} item={translate(item, t)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="mt-8 text-center sm:mt-10">
          <p className="text-sm text-[hsl(var(--fg-secondary))]">
            {t('faq.supportText', 'پاسخت را پیدا نکردی؟')}{' '}
            <a
              // Same address as /contact and the Organization JSON-LD.
              href="mailto:support@hisabche.com"
              className="font-medium text-[hsl(var(--color-primary))] underline"
            >
              {t('faq.supportLink', 'با پشتیبانی تماس بگیر')}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
