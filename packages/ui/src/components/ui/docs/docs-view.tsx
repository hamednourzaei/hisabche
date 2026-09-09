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
//   ≥ lg   a sidebar of real anchors, grouped, with a rule under each group.
//
// ⚠️ THE ROWS ARE `<a>`, NOT `<button>`. A button cannot be opened in a new
// tab, has no URL to copy, and a crawler does not follow it — which for public
// documentation means every article would be reachable only by typing its
// address. The `Select` renders no anchors at all, so this list is the only
// thing making these pages linkable.
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

import { ArrowLeft, ExternalLink } from 'lucide-react'
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
import { cn } from '../../../lib/utils'
import { DOCS_ARTICLES, DOCS_GROUPS, type DocsArticleDef } from '../../../lib/docs/docs-content'

export interface DocsViewProps {
  /** Resolves a message key. Required — there are no hardcoded fallbacks. */
  t: (key: string) => string
  /** Builds an href for an article, so the host owns locale prefixing. */
  hrefFor: (slug: string) => string
  /**
   * The article to show.
   *
   * ⚠️ REQUIRED. `/docs` is a permanent redirect to the first article, so
   * there is no state in which this view renders «the index» — the list of
   * articles is the sidebar (and the menu on a phone), not a page.
   */
  activeSlug: string
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

  const active = DOCS_ARTICLES.find((article) => article.slug === activeSlug)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:py-12">
      {/* ── The article list ──
          `Select` below lg, sidebar at lg and up. Never both. */}
      <Select value={activeSlug} onValueChange={(slug) => router.push(hrefFor(slug))}>
        <SelectTrigger className="w-full lg:hidden" aria-label={t('docs.browseAll')}>
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

      {/* ⚠️ THE SIDEBAR IS WHAT MAKES THESE PAGES CRAWLABLE.
          A `Select` renders no anchors and a `<button>` is not a link, so the
          sidebar below carries a real `href` on every entry. Without it every
          article would be reachable
          only by typing its URL, and each page would be an orphan to a
          crawler and to anyone wanting to open one in a new tab. */}
      {/* ⚠️ `1fr`, NOT `minmax(0,1fr)`. Tailwind v3's JIT does not extract an
          arbitrary value containing a comma, so the track produced NO CSS at
          all and the aside rendered full width above the article. `min-w-0`
          on the content column does the job `minmax(0,…)` was there for. */}
      <div className="mt-6 grid gap-8 lg:grid-cols-[15rem_1fr] lg:gap-0">
        {/* ⚠️ THE RULE IS ON THE ASIDE, NOT A GAP.
            A column gap is empty space; two columns of text separated by air
            read as one ragged block. A single hairline on the inline-end edge
            is what says «this is the index, that is the article» — and it is
            `border-e`, so it lands on the correct side in both directions
            without a second rule for LTR. The padding is what the gap was. */}
        <aside className="hidden lg:block lg:border-e lg:border-[hsl(var(--border-default))] lg:pe-6">
          <nav aria-label={t('docs.title')} className="sticky top-6 flex flex-col">
            {DOCS_GROUPS.map((group, index) => {
              const articles = DOCS_ARTICLES.filter((article) => article.group === group)
              if (articles.length === 0) return null

              return (
                <div
                  key={group}
                  className={cn(
                    'flex flex-col',
                    // ⚠️ A RULE BETWEEN GROUPS, NOT AROUND THEM.
                    // `border-t` on every group but the first: a rule above
                    // the first would sit directly under the page chrome and
                    // read as part of it, and one under the last would float
                    // with nothing beneath it.
                    index > 0 && 'mt-4 border-t border-[hsl(var(--border-default))] pt-4',
                  )}
                >
                  <h2 className="mb-1.5 px-3 text-xs font-semibold tracking-wide text-[hsl(var(--fg-tertiary))]">
                    {t(`docs.group.${group}`)}
                  </h2>
                  <div className="flex flex-col gap-0.5">
                    {articles.map((article) => {
                      const isActive = article.slug === activeSlug
                      return (
                        <a
                          key={article.slug}
                          href={hrefFor(article.slug)}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={(event) => {
                            // Let the browser handle a modified click — a new
                            // tab, a new window, a saved link. Calling
                            // router.push() unconditionally would swallow all
                            // three and defeat the point of using an anchor.
                            if (
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.button !== 0
                            ) {
                              return
                            }
                            event.preventDefault()
                            router.push(hrefFor(article.slug))
                          }}
                          className={cn(
                            'relative flex min-h-[2.25rem] items-center rounded-lg px-3 text-sm',
                            'transition-colors duration-150 motion-reduce:transition-none',
                            isActive
                              ? 'bg-[hsl(var(--color-primary)/0.10)] font-semibold text-[hsl(var(--color-primary))]'
                              : 'text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))]',
                          )}
                        >
                          {/* A hairline on the inline-start edge — `start`, so
                              it lands correctly in both directions. */}
                          {isActive ? (
                            <span
                              aria-hidden="true"
                              className="absolute inset-y-1.5 start-0 w-[3px] rounded-full bg-[hsl(var(--color-primary))]"
                            />
                          ) : null}
                          {t(`docs.${article.slug}.title`)}
                        </a>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="min-w-0 lg:ps-10">
          {/* `findArticle` already rejected an unknown slug with a 404 before
              this rendered, so `active` cannot be missing here. */}
          {active ? (
            <DocsArticle t={t} article={active} hrefFor={hrefFor} appHrefFor={appHrefFor} />
          ) : null}
        </main>
      </div>
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
      {/* ── Title block ──
          ⚠️ THE TITLE AND THE ACTION USED TO BE INDISTINGUISHABLE.
          The heading sat directly above a small tinted pill in the SAME accent
          colour, with no border on either, so the pair read as two halves of
          one control and people clicked the heading. Three things separate
          them now: the action carries a real border and a solid surface, it
          sits on its own row after a rule, and it says where it goes. */}
      <h1 className="text-xl font-bold text-[hsl(var(--fg-primary))] sm:text-2xl">
        {t(`docs.${article.slug}.title`)}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--fg-secondary))]">
        {t(`docs.${article.slug}.summary`)}
      </p>

      {appHref ? (
        <div className="mt-4 border-t border-[hsl(var(--border-default))] pt-4">
          <a
            href={appHref}
            className={cn(
              'inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-sm font-medium',
              // A real border and a real surface — the vocabulary every other
              // button in this product uses, so it reads as one.
              'border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]',
              'text-[hsl(var(--fg-primary))] shadow-sm transition-colors',
              'hover:border-[hsl(var(--color-primary)/0.5)] hover:bg-[hsl(var(--surface-muted))]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-primary))]',
            )}
          >
            <ExternalLink
              className="size-4 shrink-0 text-[hsl(var(--color-primary))]"
              aria-hidden="true"
            />
            {t('docs.openInApp')}
            {/* `rtl:rotate-180` so the arrow points the way the reader reads. */}
            <ArrowLeft
              className="size-4 shrink-0 text-[hsl(var(--fg-tertiary))] rtl:rotate-180"
              aria-hidden="true"
            />
          </a>
        </div>
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
