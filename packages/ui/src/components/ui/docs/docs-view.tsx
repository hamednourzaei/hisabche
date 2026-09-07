'use client'

// ============================================
// packages/ui/src/components/ui/docs/docs-view.tsx
//
// T12 — the public documentation UI.
//
// ---------------------------------------------------------------------------
// ⚠️ BUILT FROM THE COMPONENTS THAT ALREADY EXIST, NOT HAND-ROLLED
//
// The owner asked for this directly: «از کامپوننت‌های پیش‌ساخته استفاده بکن
// حوصله رسپانسیو ندارم». So this is `Card`, `Accordion`, `Badge` and `Button`
// from `packages/ui` — the same shadcn/Radix primitives the rest of the
// product uses.
//
// That is not only faster. Those components already handle the two things a
// docs page gets wrong most often: keyboard and screen-reader semantics for
// collapsible sections, and RTL. Re-implementing an accordion here would mean
// re-implementing both, worse.
//
// Layout is a plain responsive grid — one column on a phone, a sidebar from
// `lg` up. No custom breakpoints, no measured heights, nothing to debug.
//
// ---------------------------------------------------------------------------
// ⚠️ EVERY STRING COMES FROM THE MESSAGE BUNDLE
//
// Nothing is hardcoded, in any language. The docs are the page an English-
// speaking evaluator is most likely to read, and a Persian-only docs page in a
// trilingual product would be worse than none.
// ============================================

import * as React from 'react'

import { ArrowLeft, BookOpen } from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../accordion'
import { Card, CardDescription, CardHeader, CardTitle } from '../card'
import { cn } from '../../../lib/utils'
import { DOCS_ARTICLES, DOCS_GROUPS, type DocsArticleDef } from '../../../lib/docs/docs-content'

export interface DocsViewProps {
  /** Resolves a message key. Required — there are no hardcoded fallbacks. */
  t: (key: string) => string
  /** Builds an href for an article, so the host owns locale prefixing. */
  hrefFor: (slug: string) => string
  /** When set, that one article is shown; otherwise the index. */
  activeSlug?: string | undefined
  /**
   * Builds a link to the product screen an article documents.
   *
   * ⚠️ Closes the loop the «?» opens. The dashboard links out to the docs;
   * without this the docs are a dead end for a reader who is already a
   * customer and just wanted to find the screen.
   *
   * Omitted on the public site for a signed-out visitor, where a link into an
   * authenticated screen is a redirect to a login page — a worse outcome than
   * no link.
   */
  appHrefFor?: ((slug: string) => string | null) | undefined
}

export function DocsView({ t, hrefFor, activeSlug, appHrefFor }: DocsViewProps) {
  const active = activeSlug
    ? DOCS_ARTICLES.find((article) => article.slug === activeSlug)
    : undefined

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[hsl(var(--fg-primary))] sm:text-3xl">
          <BookOpen className="size-6 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          {t('docs.title')}
        </h1>
        <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))] sm:text-base">
          {t('docs.subtitle')}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <DocsSidebar t={t} hrefFor={hrefFor} activeSlug={activeSlug} />
        <main className="min-w-0">
          {active ? (
            <DocsArticle t={t} article={active} hrefFor={hrefFor} appHrefFor={appHrefFor} />
          ) : (
            <DocsIndex t={t} hrefFor={hrefFor} />
          )}
        </main>
      </div>
    </div>
  )
}

function DocsSidebar({ t, hrefFor, activeSlug }: DocsViewProps) {
  return (
    // Ordinary document flow on a phone — the list sits above the article and
    // scrolls with it. Sticky only where there is room for it to be useful.
    <nav aria-label={t('docs.title')} className="lg:sticky lg:top-6 lg:self-start">
      <div className="space-y-5">
        {DOCS_GROUPS.map((group) => {
          const articles = DOCS_ARTICLES.filter((article) => article.group === group)
          if (articles.length === 0) return null

          return (
            <div key={group}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--fg-tertiary))]">
                {t(`docs.group.${group}`)}
              </h2>
              <ul className="space-y-0.5">
                {articles.map((article) => (
                  <li key={article.slug}>
                    <a
                      href={hrefFor(article.slug)}
                      aria-current={article.slug === activeSlug ? 'page' : undefined}
                      className={cn(
                        'block rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                        article.slug === activeSlug
                          ? 'bg-[hsl(var(--color-primary)/0.1)] font-medium text-[hsl(var(--color-primary))]'
                          : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))]',
                      )}
                    >
                      {t(`docs.${article.slug}.title`)}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </nav>
  )
}

function DocsIndex({ t, hrefFor }: Pick<DocsViewProps, 't' | 'hrefFor'>) {
  return (
    <div className="space-y-8">
      {DOCS_GROUPS.map((group) => {
        const articles = DOCS_ARTICLES.filter((article) => article.group === group)
        if (articles.length === 0) return null

        return (
          <section key={group}>
            <h2 className="mb-3 text-lg font-semibold text-[hsl(var(--fg-primary))]">
              {t(`docs.group.${group}`)}
            </h2>
            {/* One column on a phone, two from `sm`. The card handles its own
                padding and elevation — nothing measured here. */}
            <div className="grid gap-3 sm:grid-cols-2">
              {articles.map((article) => (
                <a
                  key={article.slug}
                  href={hrefFor(article.slug)}
                  className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]"
                >
                  <Card className="h-full transition-colors group-hover:border-[hsl(var(--color-primary)/0.4)]">
                    <CardHeader>
                      <CardTitle className="text-base">{t(`docs.${article.slug}.title`)}</CardTitle>
                      <CardDescription>{t(`docs.${article.slug}.summary`)}</CardDescription>
                    </CardHeader>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function DocsArticle({
  t,
  article,
  hrefFor,
  appHrefFor,
}: {
  t: DocsViewProps['t']
  article: DocsArticleDef
  hrefFor: DocsViewProps['hrefFor']
  appHrefFor?: DocsViewProps['appHrefFor']
}) {
  const appHref = appHrefFor?.(article.slug) ?? null
  return (
    <article className="min-w-0">
      <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
        {t(`docs.${article.slug}.title`)}
      </h1>
      <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">
        {t(`docs.${article.slug}.summary`)}
      </p>

      {/* Straight to the screen this article is about. The «?» in the app
          brings a customer here; this is how they get back to the thing they
          were doing. */}
      {appHref ? (
        <a
          href={appHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.06)] px-3 py-1.5 text-xs font-medium text-[hsl(var(--color-primary))] transition-colors hover:bg-[hsl(var(--color-primary)/0.12)]"
        >
          {t('docs.openInApp')}
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        </a>
      ) : null}

      {/* Every section open by default: this is documentation, so it must be
          readable in one pass and findable with the browser's own search.
          The accordion is here to let a reader COLLAPSE what they have read,
          not to hide content behind a click. */}
      <Accordion
        type="multiple"
        defaultValue={article.sections.map((section) => section.id)}
        className="mt-6"
      >
        {article.sections.map((section) => (
          <AccordionItem key={section.id} value={section.id}>
            <AccordionTrigger>{t(`docs.${article.slug}.${section.id}.heading`)}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
                {Array.from({ length: section.bodyCount }, (_, index) => (
                  <p key={index}>{t(`docs.${article.slug}.${section.id}.body${index + 1}`)}</p>
                ))}

                {section.stepCount ? (
                  <ol className="ms-4 list-decimal space-y-1.5 pt-1">
                    {Array.from({ length: section.stepCount }, (_, index) => (
                      <li key={index}>
                        {t(`docs.${article.slug}.${section.id}.step${index + 1}`)}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* ─── Internal links ────────────────────────────────────────────
          ⚠️ NOT DECORATION. Without these, every article is reachable only
          from the index: a reader arriving from a search result has no path
          onward, and neither does a crawler. The set would be a fan of
          orphans rather than a linked body of pages.

          The targets are hand-picked rather than «others in this group» —
          someone reading about invoices wants payments and units next, which
          live in different groups. */}
      <nav
        aria-label={t('docs.related')}
        className="mt-8 border-t border-[hsl(var(--border-default))] pt-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('docs.related')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {article.related.map((slug) => (
            <li key={slug}>
              <a
                href={hrefFor(slug)}
                className="block rounded-xl border border-[hsl(var(--border-default))] px-3 py-2.5 text-sm text-[hsl(var(--fg-primary))] transition-colors hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--surface-muted))]"
              >
                {t(`docs.${slug}.title`)}
                <span className="mt-0.5 block text-xs text-[hsl(var(--fg-tertiary))]">
                  {t(`docs.${slug}.summary`)}
                </span>
              </a>
            </li>
          ))}

          {/* Outbound links stop the docs being an island: a reader who
              arrived on a how-to query reaches the pages that explain the
              product, which is where they decide. */}
          {(article.outbound ?? []).map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="block rounded-xl border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.04)] px-3 py-2.5 text-sm text-[hsl(var(--color-primary))] transition-colors hover:bg-[hsl(var(--color-primary)/0.08)]"
              >
                {t(link.labelKey)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  )
}

export default DocsView
