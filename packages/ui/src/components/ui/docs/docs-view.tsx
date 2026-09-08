'use client'

// ============================================
// packages/ui/src/components/ui/docs/docs-view.tsx
//
// The public documentation UI.
//
// ---------------------------------------------------------------------------
// ⚠️ ONE LIST, RENDERED TWO WAYS — NEVER BOTH AT ONCE.
//
//   < lg   a single grouped `Select`. Picking an article dismisses the menu
//          and that article appears below it.
//   ≥ lg   a sidebar built from the DASHBOARD's own `SidebarItem`, so the
//          documentation navigates exactly like the application does.
//
// The desktop sidebar is not a lookalike: it imports `SidebarItem` from
// `dashboard-sidebar.tsx`. Active state, the hairline indicator, hover, focus
// and the 40px row are one implementation. That is also why `NavItem.icon` is
// optional now — an article has no icon, and reserving a gutter for one it
// will never have would leave the list hanging off its own margin.
//
// This replaced two earlier attempts that were both wrong:
//
//   · every section was an `AccordionItem` open by default — chevrons and
//     borders wrapped around prose nobody was going to collapse
//   · then an aside at every width, which on a phone stacked the entire index
//     ON TOP of the article, so the answer started below the fold
//
// A `Select` is the right control on a phone because it is ALREADY a menu that
// dismisses itself on selection and is keyboard- and screen-reader-complete —
// a popover on a desktop, a full-height list on a phone, no breakpoints.
// ============================================

import * as React from 'react'

import { ArrowLeft, BookOpen } from 'lucide-react'
import { useRouter } from 'next/navigation'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../select'
import { SidebarItem } from '../dashboard-sidebar'
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
   * Omitted on the public site for a signed-out visitor, where a link into an
   * authenticated screen is a redirect to a login page — worse than no link.
   */
  appHrefFor?: ((slug: string) => string | null) | undefined
}

export function DocsView({ t, hrefFor, activeSlug, appHrefFor }: DocsViewProps) {
  const router = useRouter()

  const active = activeSlug
    ? DOCS_ARTICLES.find((article) => article.slug === activeSlug)
    : undefined

  // `hrefFor('')` would leave a trailing slash, which is a redirect rather
  // than the canonical index URL.
  const indexHref = hrefFor('').replace(/\/$/, '')

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      <header className="mb-5 sm:mb-6">
        {/* ⚠️ THE SET TITLE IS AN <h1> ONLY ON THE INDEX.
            An article supplies its own <h1> below. Rendering this one as an
            <h1> too gave every article page two of them, and the one that
            would win is «Docs» — the word every article shares. */}
        {active ? (
          <a
            href={indexHref}
            className="inline-flex items-center gap-1.5 text-sm text-[hsl(var(--fg-tertiary))] transition-colors hover:text-[hsl(var(--color-primary))]"
          >
            <BookOpen className="size-4" aria-hidden="true" />
            {t('docs.title')}
          </a>
        ) : (
          <>
            <h1 className="flex items-center gap-2 text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl lg:text-3xl">
              <BookOpen
                className="size-5 shrink-0 text-[hsl(var(--color-primary))] sm:size-6"
                aria-hidden="true"
              />
              {t('docs.title')}
            </h1>
            <p className="mt-1.5 text-sm text-[hsl(var(--fg-secondary))] sm:mt-2 sm:text-base">
              {t('docs.subtitle')}
            </p>
          </>
        )}
      </header>

      {/* ── The menu, below lg ── */}
      {/* `exactOptionalPropertyTypes` is on, so `value={undefined}` is a type
          error rather than «uncontrolled» — the prop has to be absent. */}
      <Select
        {...(activeSlug ? { value: activeSlug } : {})}
        onValueChange={(slug) => router.push(hrefFor(slug))}
      >
        <SelectTrigger className="h-11 w-full text-sm lg:hidden" aria-label={t('docs.browseAll')}>
          <SelectValue placeholder={t('docs.browseAll')} />
        </SelectTrigger>
        <SelectContent>
          {DOCS_GROUPS.map((group) => {
            const articles = DOCS_ARTICLES.filter((article) => article.group === group)
            if (articles.length === 0) return null

            return (
              <SelectGroup key={group}>
                <SelectLabel>{t(`docs.group.${group}`)}</SelectLabel>
                {articles.map((article) => (
                  <SelectItem key={article.slug} value={article.slug}>
                    {t(`docs.${article.slug}.title`)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )
          })}
        </SelectContent>
      </Select>

      {/* ⚠️ THE MENU IS NOT THE ONLY WAY IN.
          A `Select` renders no anchors, so on its own it would leave every
          article unreachable by a crawler and unopenable in a new tab. The
          index below is the crawlable copy — and it is shown only when NO
          article is selected, so the page never displays two lists at once. */}
      {/* ⚠️ `1fr`, NOT `minmax(0,1fr)`. Tailwind v3's JIT does not extract an
          arbitrary value containing a comma, so the track produced NO CSS at
          all and the aside rendered full width above the article. `min-w-0`
          on the content column does the job `minmax(0,…)` was there for. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
        <aside className="hidden lg:block">
          <nav aria-label={t('docs.title')} className="sticky top-6 flex flex-col gap-4">
            {DOCS_GROUPS.map((group) => {
              const articles = DOCS_ARTICLES.filter((article) => article.group === group)
              if (articles.length === 0) return null

              return (
                <div key={group} className="flex flex-col">
                  <h2 className="mb-1 px-3 text-xs font-semibold tracking-wide text-[hsl(var(--fg-tertiary))]">
                    {t(`docs.group.${group}`)}
                  </h2>
                  <div className="flex flex-col gap-0.5">
                    {articles.map((article) => (
                      <SidebarItem
                        key={article.slug}
                        item={{
                          id: article.slug,
                          label: t(`docs.${article.slug}.title`),
                          path: hrefFor(article.slug),
                        }}
                        isActive={article.slug === activeSlug}
                        collapsed={false}
                        nested={false}
                        onClick={() => router.push(hrefFor(article.slug))}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {active ? (
            <DocsArticle t={t} article={active} hrefFor={hrefFor} appHrefFor={appHrefFor} />
          ) : (
            <DocsIndexCards t={t} hrefFor={hrefFor} />
          )}
        </main>
      </div>
    </div>
  )
}

function DocsIndexCards({ t, hrefFor }: Pick<DocsViewProps, 't' | 'hrefFor'>) {
  return (
    <div className="space-y-7">
      {DOCS_GROUPS.map((group) => {
        const articles = DOCS_ARTICLES.filter((article) => article.group === group)
        if (articles.length === 0) return null

        return (
          <section key={group}>
            <h2 className="mb-2.5 text-sm font-semibold text-[hsl(var(--fg-tertiary))]">
              {t(`docs.group.${group}`)}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {articles.map((article) => (
                <a
                  key={article.slug}
                  href={hrefFor(article.slug)}
                  className={cn(
                    'block rounded-2xl p-4 transition-colors',
                    'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
                    'hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--surface-muted))]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
                  )}
                >
                  <h3 className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                    {t(`docs.${article.slug}.title`)}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--fg-tertiary))]">
                    {t(`docs.${article.slug}.summary`)}
                  </p>
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
    // `min-w-0` so a long unbroken string cannot widen the column and push the
    // page into horizontal scroll.
    <article className="min-w-0">
      <h1 className="text-lg font-bold text-[hsl(var(--fg-primary))] sm:text-xl lg:text-2xl">
        {t(`docs.${article.slug}.title`)}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
        {t(`docs.${article.slug}.summary`)}
      </p>

      {appHref ? (
        <a
          href={appHref}
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium',
            'border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.06)]',
            'text-[hsl(var(--color-primary))] transition-colors',
            'hover:bg-[hsl(var(--color-primary)/0.12)]',
          )}
        >
          {t('docs.openInApp')}
          {/* `rtl:rotate-180` so the arrow points the way the reader reads. */}
          <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden="true" />
        </a>
      ) : null}

      {/* ── The article itself ──
          Plain headings and paragraphs: readable in one pass, findable with
          the find-in-page the browser already has, and legible to a crawler. */}
      <div className="mt-7 space-y-7">
        {article.sections.map((section) => (
          <section key={section.id}>
            <h2 className="text-sm font-semibold text-[hsl(var(--fg-primary))] sm:text-base">
              {t(`docs.${article.slug}.${section.id}.heading`)}
            </h2>

            <div className="mt-2 space-y-3 text-sm leading-7 text-[hsl(var(--fg-secondary))]">
              {Array.from({ length: section.bodyCount }, (_, index) => (
                <p key={index}>{t(`docs.${article.slug}.${section.id}.body${index + 1}`)}</p>
              ))}
            </div>

            {section.stepCount ? (
              <ol className="mt-3 space-y-2">
                {Array.from({ length: section.stepCount }, (_, index) => (
                  <li
                    key={index}
                    className="flex gap-2.5 text-sm leading-7 text-[hsl(var(--fg-secondary))]"
                  >
                    {/* A numbered chip rather than a list marker: a marker in
                        an RTL paragraph sits inconsistently across browsers,
                        and these are steps worth being able to point at. */}
                    <span
                      aria-hidden="true"
                      className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--color-primary)/0.1)] text-[11px] font-semibold text-[hsl(var(--color-primary))]"
                    >
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      {t(`docs.${article.slug}.${section.id}.step${index + 1}`)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ))}
      </div>

      {/* ── Related ──
          ⚠️ Not decoration. Without these, an article is reachable only from
          the menu: a reader arriving from a search result has no path onward,
          and neither does a crawler. */}
      <nav
        aria-label={t('docs.related')}
        className="mt-10 border-t border-[hsl(var(--border-default))] pt-6"
      >
        <h2 className="mb-3 text-sm font-semibold text-[hsl(var(--fg-primary))]">
          {t('docs.related')}
        </h2>
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {article.related.map((slug) => (
            <li key={slug}>
              <a
                href={hrefFor(slug)}
                className={cn(
                  'block rounded-xl border border-[hsl(var(--border-default))] px-3 py-2.5',
                  'text-sm text-[hsl(var(--fg-primary))] transition-colors',
                  'hover:border-[hsl(var(--color-primary)/0.4)] hover:bg-[hsl(var(--surface-muted))]',
                )}
              >
                {t(`docs.${slug}.title`)}
                <span className="mt-0.5 block text-xs leading-relaxed text-[hsl(var(--fg-tertiary))]">
                  {t(`docs.${slug}.summary`)}
                </span>
              </a>
            </li>
          ))}

          {(article.outbound ?? []).map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={cn(
                  'block rounded-xl px-3 py-2.5 text-sm transition-colors',
                  'border border-[hsl(var(--color-primary)/0.3)] bg-[hsl(var(--color-primary)/0.04)]',
                  'text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)]',
                )}
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
