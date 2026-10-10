// packages/ui/src/components/ui/landing/journey/journey-hero.tsx
//
// SERVER COMPONENT. Resolves every word of the journey and renders the two
// pieces of it that matter before any script runs: the headline (the page's
// <h1> and its largest paint) and the closing invitation. The client stage
// receives them as ready markup and only decides which beat is on screen.

import Link from 'next/link'

import { JOURNEY_INDUSTRIES } from './journey-industries'
import { JOURNEY_STATIONS } from './journey-machine'
import { buildScreens } from './journey-screens'
import { JourneyStage, type JourneyStop } from './journey-stage'
import { formatDemoAmount, formatDemoCount, saleTotal } from './landing-demo-data'

export interface JourneyHeroProps {
  t: (key: string, fallback?: string) => string
  /** A sentence with {placeholders}, exactly as written in the messages. */
  raw: (key: string) => string
  locale: string
}

export function JourneyHero({ t, raw, locale }: JourneyHeroProps) {
  // Digits follow the reader's language; the count is the real number of stops.
  const stops: JourneyStop[] = JOURNEY_STATIONS.map((id, index) => ({
    id,
    say: t(`landing.journey.say.${id}`),
    place: formatDemoCount(index + 1, locale),
    total: formatDemoCount(JOURNEY_STATIONS.length, locale),
    title: t(`landing.system.step.${id}.title`),
    desc: t(`landing.system.step.${id}.desc`),
  }))

  // What every station's board shows about the one sample sale. The words are
  // resolved here, on the server; the client receives plain rows.
  const screens = buildScreens(
    {
      titles: {
        pay: t('landing.system.step.pay.title'),
        cash: t('landing.system.step.cash.title'),
        stock: t('landing.system.step.stock.title'),
        post: t('landing.system.step.post.title'),
        report: t('landing.system.step.report.title'),
      },
      note: t('landing.visual.example'),
      waiting: t('landing.journey.screen.waiting'),
      money: raw('landing.journey.screen.money'),
      units: {
        toman: t('landing.journey.currency.toman'),
        afghani: t('landing.journey.currency.afghani'),
      },
      change: raw('landing.journey.screen.change'),
      invoice: raw('landing.journey.screen.invoice'),
      total: t('landing.journey.screen.total'),
      paid: t('landing.journey.screen.paid'),
      remaining: t('landing.journey.screen.remaining'),
      customerBalance: t('landing.journey.screen.customerBalance'),
      received: t('landing.journey.screen.received'),
      drawerBefore: t('landing.journey.screen.drawerBefore'),
      drawerAfter: t('landing.journey.screen.drawerAfter'),
      items: {
        first: t('landing.journey.screen.item.first'),
        second: t('landing.journey.screen.item.second'),
      },
      debit: t('landing.journey.screen.debit'),
      credit: t('landing.journey.screen.credit'),
      accounts: {
        cash: t('landing.journey.screen.account.cash'),
        receivable: t('landing.journey.screen.account.receivable'),
        salesRevenue: t('landing.journey.screen.account.salesRevenue'),
      },
      balanced: t('landing.journey.screen.balanced'),
      sales: t('landing.journey.screen.sales'),
      receivables: t('landing.journey.screen.receivables'),
      unitsSold: t('landing.journey.screen.unitsSold'),
    },
    locale,
  )

  const hero = (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-balance text-4xl font-black leading-tight text-[hsl(var(--fg-primary))] sm:text-5xl lg:text-6xl">
        {t('landing.headline')}
        <span className="block text-[hsl(var(--color-primary))]">
          {t('landing.headlineHighlight')}
        </span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-[hsl(var(--fg-secondary))] sm:text-lg sm:leading-8">
        {t('landing.journey.printing')}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          prefetch={false}
          href={`/${locale}/signup`}
          className="btn-primary inline-flex min-h-12 items-center justify-center rounded-xl px-7 text-base"
        >
          {t('landing.cta')}
        </Link>
        <Link
          prefetch={false}
          href={`/${locale}/docs/getting-started`}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[hsl(var(--border-strong))] px-6 text-base text-[hsl(var(--fg-primary))]"
        >
          {t('landing.ctaDocs')}
        </Link>
      </div>
    </div>
  )

  const finale = (
    <div className="mx-auto max-w-xl rounded-3xl border border-[hsl(var(--color-primary)/0.35)] bg-[hsl(var(--surface-base)/0.82)] p-6 backdrop-blur-md sm:p-10">
      <h2 className="text-balance text-3xl font-black leading-tight text-[hsl(var(--fg-primary))] sm:text-5xl">
        {t('landing.journey.ready')}
      </h2>
      <p className="mt-4 text-pretty text-base leading-8 text-[hsl(var(--fg-secondary))]">
        {t('landing.journey.readySub')}
      </p>
      <Link
        prefetch={false}
        href={`/${locale}/signup`}
        className="btn-primary mt-6 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-10 text-lg font-bold sm:w-auto"
      >
        {t('landing.ctaButton')}
      </Link>
      <p className="mt-4 text-xs text-[hsl(var(--fg-tertiary))]">
        {[
          t('landing.ctaReassurance1'),
          t('landing.ctaReassurance2'),
          t('landing.ctaReassurance3'),
        ].join(' · ')}
      </p>
    </div>
  )

  return (
    <JourneyStage
      label={t('landing.journey.label')}
      hero={hero}
      finale={finale}
      stops={stops}
      endLabel={t('landing.journey.end')}
      screens={screens}
      industries={JOURNEY_INDUSTRIES.map(({ key, icon }) => ({
        label: t(`landing.industry.${key}`),
        icon,
      }))}
      industriesLabel={t('landing.trustBarLabel')}
      counter={raw('landing.journey.counter')}
      summaryLabel={t('landing.journey.summary')}
      skipLabel={t('landing.journey.skip')}
      recordedLabel={t('landing.journey.recorded')}
      invoice={{
        brand: t('app.name'),
        title: t('invoices.saleInvoice'),
        sample: t('landing.visual.example'),
        number: t('invoices.invoiceNumber'),
        date: t('invoices.date'),
        customer: t('invoices.customer'),
        items: t('invoices.items'),
        quantity: t('invoices.quantity'),
        unitPrice: t('invoices.unitPrice'),
        subtotal: t('invoices.subtotal'),
        discount: t('invoices.discount'),
        tax: t('invoices.tax'),
        total: t('invoices.total'),
        amount: formatDemoAmount(saleTotal(), locale),
      }}
    />
  )
}
