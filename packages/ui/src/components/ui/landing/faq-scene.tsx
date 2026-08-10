// packages/ui/src/components/ui/landing/faq-scene.tsx
'use client'

import { useState, useCallback } from 'react'
import { cn } from '../../../lib/utils'
import { ChevronDown, ExternalLink } from 'lucide-react'

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
    titleKey: 'faq.category.start',
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
        relatedLabelKey: 'faq.related.pricing',
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
        relatedLabelKey: 'faq.related.signup',
        relatedFallback: 'شروع رایگان',
      },
    ],
  },
  {
    id: 'offline',
    titleKey: 'faq.category.offline',
    fallbackTitle: 'آفلاین و همگام‌سازی',
    items: [
      {
        id: 'offline1',
        questionKey: 'faq.offline1Q',
        answerKey: 'faq.offline1A',
        fallbackQuestion: 'آیا حتماً باید اینترنت داشته باشم؟',
        fallbackAnswer:
          'خیر. حسابچه کاملاً آفلاین کار می‌کند. می‌توانید فاکتور ثبت کنید، موجودی را بروز کنید و مشتری اضافه کنید، حتی وقتی اینترنت قطع است. به محض اتصال دوباره، همه چیز به‌طور خودکار همگام‌سازی می‌شود.',
        relatedLink: '#business-flow',
        relatedLabelKey: 'faq.related.offlineFlow',
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
        relatedLabelKey: 'faq.related.security',
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
    ],
  },
  {
    id: 'accounting',
    titleKey: 'faq.category.accounting',
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
        relatedLabelKey: 'faq.related.debt',
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
        relatedLabelKey: 'faq.related.inventory',
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
        relatedLabelKey: 'faq.related.reports',
        relatedFallback: 'گزارش‌های لحظه‌ای',
      },
    ],
  },
  {
    id: 'security',
    titleKey: 'faq.category.security',
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
        relatedLabelKey: 'faq.related.security',
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
        relatedLabelKey: 'faq.related.access',
        relatedFallback: 'مدیریت کاربران',
      },
    ],
  },
  {
    id: 'device',
    titleKey: 'faq.category.device',
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
    titleKey: 'faq.category.payment',
    fallbackTitle: 'هزینه و اشتراک',
    items: [
      {
        id: 'pay1',
        questionKey: 'faq.pay1Q',
        answerKey: 'faq.pay1A',
        fallbackQuestion: 'قیمت حسابچه چقدر است؟',
        fallbackAnswer:
          'پلن رایگان برای یک کسب‌وکار با ۵۰ فاکتور در ماه کاملاً رایگان است. پلن Starter با ۹ دلار در ماه امکانات بیشتری دارد. تمام قیمت‌ها به افغانی و از طریق صرافی‌های معتبر قابل پرداخت است.',
        relatedLink: '#pricing',
        relatedLabelKey: 'faq.related.pricing',
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

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div
      className={cn(
        'group border rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300',
        isOpen
          ? 'border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.03)] shadow-[var(--shadow-premium)]'
          : 'border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated)/0.5)] hover:border-[hsl(var(--border-strong))]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 sm:gap-4 px-4 sm:px-5 py-3 sm:py-4 text-start font-semibold text-[hsl(var(--fg-primary))] min-h-[40px] sm:min-h-[44px]"
        aria-expanded={isOpen}
      >
        <span className="text-xs sm:text-sm lg:text-base leading-snug sm:leading-normal">
          {item.fallbackQuestion}
        </span>
        <ChevronDown
          className={cn(
            'size-4 sm:size-5 shrink-0 text-[hsl(var(--fg-tertiary))] transition-transform duration-300',
            isOpen && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 sm:px-5 pb-3 sm:pb-4 text-xs sm:text-sm text-[hsl(var(--fg-secondary))] leading-relaxed">
            {item.fallbackAnswer}
            {item.relatedLink && (
              <a
                href={item.relatedLink}
                className="mt-2 inline-flex items-center gap-1 text-[10px] sm:text-xs font-medium text-[hsl(var(--color-primary))] hover:underline"
              >
                {item.relatedFallback ?? 'بیشتر بدانید'}
                <ExternalLink className="size-2.5 sm:size-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FaqJsonLd({ t }: { t: (key: string, fallback?: string) => string }) {
  // Structured data must mirror the visible, translated text — otherwise Google
  // sees a mismatch between the FAQPage schema (previously always Persian) and
  // the on-page content for en/af locales, which disqualifies the page from
  // FAQ rich results.
  const faqData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ALL_ITEMS.map((item) => ({
      '@type': 'Question',
      name: t(item.questionKey, item.fallbackQuestion),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(item.answerKey, item.fallbackAnswer),
      },
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
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState(false)

  const toggleItem = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const visibleItems = showAll ? ALL_ITEMS : ALL_ITEMS.slice(0, INITIAL_COUNT)

  const categorizedView = showAll
    ? FAQ_CATEGORIES.map((cat) => ({
        ...cat,
        items: cat.items,
      }))
    : null

  return (
    <section id="faq" className="py-12 sm:py-16 lg:py-20">
      <FaqJsonLd t={t} />

      <div className="container-narrow max-w-3xl px-4 sm:px-6">
        <div className="text-center mb-10 sm:mb-12 lg:mb-14">
          <p className="text-[10px] sm:text-xs lg:text-sm uppercase tracking-[0.2em] mb-2 sm:mb-3 text-[hsl(var(--fg-tertiary))] font-semibold">
            {t('landing.faqLabel', 'پرسش‌های رایج')}
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-4xl font-bold text-[hsl(var(--fg-primary))] tracking-tight mb-2 sm:mb-3">
            {t('landing.faqTitle', 'هر سوالی داری، اینجا جوابش هست')}
          </h2>
          <p className="mx-auto max-w-xl text-sm sm:text-base text-[hsl(var(--fg-secondary))] leading-relaxed px-4 sm:px-0">
            {t('landing.faqDesc', 'اگر پاسخت را پیدا نکردی، پشتیبانی حسابچه همیشه آماده کمک است.')}
          </p>
        </div>

        <div className="space-y-2 sm:space-y-3">
          {!showAll &&
            visibleItems.map((item) => (
              <FaqAccordionItem
                key={item.id}
                item={{
                  ...item,
                  fallbackQuestion: t(item.questionKey, item.fallbackQuestion),
                  fallbackAnswer: t(item.answerKey, item.fallbackAnswer),
                  relatedFallback:
                    item.relatedFallback !== undefined
                      ? t(item.relatedLabelKey!, item.relatedFallback)
                      : undefined,
                }}
                isOpen={openIds.has(item.id)}
                onToggle={() => toggleItem(item.id)}
              />
            ))}

          {showAll &&
            categorizedView!.map((category) => (
              <div key={category.id} className="mb-6 sm:mb-8">
                <h3 className="text-xs sm:text-sm font-semibold text-[hsl(var(--fg-secondary))] uppercase tracking-[0.15em] mb-2 sm:mb-3 px-1">
                  {t(category.titleKey, category.fallbackTitle)}
                </h3>
                <div className="space-y-2 sm:space-y-3">
                  {category.items.map((item) => (
                    <FaqAccordionItem
                      key={item.id}
                      item={{
                        ...item,
                        fallbackQuestion: t(item.questionKey, item.fallbackQuestion),
                        fallbackAnswer: t(item.answerKey, item.fallbackAnswer),
                        relatedFallback:
                          item.relatedFallback !== undefined
                            ? t(item.relatedLabelKey!, item.relatedFallback)
                            : undefined,
                      }}
                      isOpen={openIds.has(item.id)}
                      onToggle={() => toggleItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>

        {!showAll && ALL_ITEMS.length > INITIAL_COUNT && (
          <div className="mt-6 sm:mt-8 text-center">
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full border border-[hsl(var(--border-default))] text-xs sm:text-sm font-medium text-[hsl(var(--fg-secondary))] hover:border-[hsl(var(--color-primary)/0.4)] hover:text-[hsl(var(--fg-primary))] transition-colors"
            >
              {t('faq.showMore', 'مشاهده همه سوالات')}
              <ChevronDown className="size-3.5 sm:size-4" />
            </button>
          </div>
        )}

        <div className="mt-8 sm:mt-10 text-center">
          <p className="text-xs sm:text-sm text-[hsl(var(--fg-secondary))]">
            {t('faq.supportText', 'پاسخت را پیدا نکردی؟')}{' '}
            <a
              href="mailto:support@hisabche.af"
              className="text-[hsl(var(--color-primary))] font-medium underline"
            >
              {t('faq.supportLink', 'با پشتیبانی تماس بگیر')}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
