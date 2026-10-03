// ============================================
// Capability: research (Phase 2). Tavily, three locales, deduplicated.
//
// ⚠️ WHY THREE LOCALES IN PARALLEL, AND WHY ONE SET OF SOURCES.
//
// The owner decided: search `fa` · `af` · `en` at once, classify the results,
// and collect the sources WITHOUT duplication.
//
// The duplication is not hypothetical. `af` and `fa` are close enough that a
// three-locale search returns the same Persian pages three times — and a brief
// that cites one government page three times LOOKS better sourced than it is,
// which is the exact failure §8 of the specification forbids.
//
// So: searches run concurrently, results are merged, and a source is identified
// by its NORMALISED URL — the same rule the `blog_sources` unique index enforces.
// One page, one row, however many locales found it.
//
// ⚠️ AND THE AI IS NOT ASKED FOR SOURCES AT ALL.
//
// `§13`: «Never invent sources. Never invent URLs.» A model asked for sources
// will produce plausible ones, because producing plausible text is what it does.
// So the source list is BUILT from Tavily's response and the model is only ever
// shown it — asked to classify and rank what is already real.
//
// ⚠️ WITHOUT AN API KEY THIS THROWS, IT DOES NOT DEGRADE.
//
// A research engine that returns "no sources" when it was never configured is
// indistinguishable from a topic that has none, and the brief would be built on
// model guesswork with an empty citation list. The caller has to know which of
// those two happened.
import { createHash } from 'node:crypto'

import { supabase } from '../../db'
import { ValidationError } from '../../errors/validation.error'
import { TenancyContext } from '../tenancy.service'
// ⚠️ From `packages/validation`, not from `blog.domain`. The locale list is
// part of the shared SCHEMA — the same list the database CHECK constrains — so
// importing it from the blog service would give the research engine its own copy
// of the three languages, and the two could drift.
import type { BlogLocale } from '@hisabche/validation'

/** The three locales the product ships. Research runs for all of them. */
const RESEARCH_LOCALES: readonly BlogLocale[] = ['fa', 'af', 'en']

/** ⚠️ Per-locale result cap, so one locale cannot dominate the merge. */
const RESULTS_PER_LOCALE = 8

export type SourceType = 'primary' | 'secondary' | 'competitor'

export interface ResearchSource {
  url: string
  urlNormalised: string
  title: string | null
  domain: string | null
  sourceType: SourceType
  /** Which locales found it. One page found twice is one row. */
  locales: BlogLocale[]
  /** Only populated for primary sources; null means "not judged". */
  authorityScore: number | null
}

export interface ResearchResult {
  runKey: string
  topic: string
  briefId: string | null
  queries: { locale: BlogLocale; query: string }[]
  sources: ResearchSource[]
  /** Locales whose search returned nothing usable — NOT zero. */
  skipped: { locale: BlogLocale; reason: string }[]
}

/**
 * Normalise a URL so the same page is one source.
 *
 * ⚠️ Deliberately conservative: lowercase host, drop `www.`, force https, drop
 * the fragment and the tracking parameters, keep the path and the query. A
 * MORE aggressive rule (dropping query entirely, sorting the rest) would merge
 * genuinely different pages, and a research tool that cites the wrong page is
 * worse than one that cites it twice.
 */
export function normaliseSourceUrl(raw: string): string {
  try {
    const url = new URL(raw)
    const host = url.hostname.toLowerCase().replace(/^www\./, '')
    const params = new URLSearchParams(url.search)
    for (const key of [...params.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_|ref)/i.test(key)) params.delete(key)
    }
    const query = params.toString()
    return `https://${host}${url.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}`
  } catch {
    return raw.trim().toLowerCase()
  }
}

/**
 * The idempotency key for one research request.
 *
 * ⚠️ DERIVED, NOT RANDOM. A random key makes a retry a new run and a second
 * Tavily bill. Derived from workspace + topic + locales so the SAME request
 * reuses the SAME run, and only a different topic costs money.
 */
export function researchRunKey(
  workspaceId: string,
  topic: string,
  locales: readonly BlogLocale[] = RESEARCH_LOCALES,
): string {
  const normalised = `${workspaceId}|${topic.trim().toLowerCase()}|${[...locales].sort().join(',')}`
  return createHash('sha256').update(normalised).digest('hex').slice(0, 32)
}

/**
 * ⚠️ A DOMAIN IS A SOURCE TYPE, NOT A RANKING.
 *
 * `.gov`, `.edu` and the standard authorities on a hand-written list are PRIMARY
 * by nature: a government page does not become secondary because the search
 * engine ranked it lower. Everything else is judged by what it is — a competitor
 * is a competitor, and recording that is what makes the originality gate
 * possible later.
 */
const PRIMARY_SUFFIXES = ['.gov', '.gov.af', '.gov.ir', '.edu', '.ac.ir', '.edu.af']

const COMPETITOR_HOSTS = new Set([
  'odoo.com',
  'erpnext.com',
  'quickbooks.intuit.com',
  'xero.com',
  'zoho.com',
  'sepehrsyazd.com',
  'hesabfa.com',
  'sofrex.ir',
  'accountingtools.com',
  'myaccunting.com',
])

function classify(url: string): SourceType {
  let host: string
  let pathname: string
  try {
    const parsed = new URL(url)
    host = parsed.hostname.toLowerCase()
    pathname = parsed.pathname
  } catch {
    return 'secondary'
  }

  if (COMPETITOR_HOSTS.has(host) || /\/(blog|resources|guides)\b/i.test(pathname)) {
    // ⚠️ A competitor page is a legitimate research INPUT and is recorded as one.
    // Hiding it would make the pipeline's inputs invisible rather than governed.
    return 'competitor'
  }

  if (PRIMARY_SUFFIXES.some((suffix) => host.endsWith(suffix))) return 'primary'

  return 'secondary'
}

interface TavilyResult {
  url?: string
  title?: string
  content?: string
  score?: number
}

interface TavilyResponse {
  results?: TavilyResult[]
}

/**
 * One search, one locale.
 *
 * ⚠️ THROWS on a missing key. The alternative — an empty result set — is
 * indistinguishable from a topic that genuinely has no sources, and the brief
 * would be written on guesswork with an empty citation list.
 */
async function searchOne(
  query: string,
  locale: BlogLocale,
  apiKey: string,
): Promise<TavilyResult[]> {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      // ⚠️ 'general' rather than 'news': a tax rule is not news, and a news
      // search returns articles that quote a rule they did not read.
      topic: 'general',
      max_results: RESULTS_PER_LOCALE,
      // ⚠️ ONLY THE SUMMARY, never the full page. Fetching full text is scraping,
      // and a research tool that scrapes is the thing §7 forbids.
      include_answer: false,
      include_raw_content: false,
    }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!response.ok) {
    // ⚠️ The provider's body is NOT forwarded: it can echo the query, and the
    // query is an unpublished editorial topic.
    console.error(`[research] Tavily answered ${response.status} for locale ${locale}`)
    throw new ValidationError(`RESEARCH_PROVIDER_ERROR: ${response.status}`)
  }

  const body = (await response.json()) as TavilyResponse
  return body.results ?? []
}

/**
 * Merge the three locale searches into one deduplicated source list.
 *
 * ⚠️ The merge is the whole point of this function. Three locales, one page,
 * one row — and `locales` records that more than one search found it, which is
 * a weak signal of relevance and costs nothing to keep.
 */
export function mergeSources(
  perLocale: Readonly<Record<string, TavilyResult[]>>,
): ResearchSource[] {
  const merged = new Map<string, ResearchSource>()

  for (const [locale, results] of Object.entries(perLocale)) {
    for (const result of results) {
      if (!result.url) continue

      const urlNormalised = normaliseSourceUrl(result.url)
      const existing = merged.get(urlNormalised)

      if (existing) {
        // ⚠️ A repeat across locales. The page is one source however many
        // searches found it, and the second locale that finds it is evidence it
        // is relevant to both markets.
        if (!existing.locales.includes(locale as BlogLocale)) {
          existing.locales.push(locale as BlogLocale)
        }
        continue
      }

      const sourceType = classify(result.url)
      merged.set(urlNormalised, {
        url: result.url,
        urlNormalised,
        title: result.title ?? null,
        domain: safeDomain(result.url),
        sourceType,
        locales: [locale as BlogLocale],
        // ⚠️ Null, not zero. A primary source whose authority has not been
        // judged is unknown, and zero would read as "worthless".
        authorityScore: null,
      })
    }
  }

  return [...merged.values()]
}

function safeDomain(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Research one topic across all three locales.
 *
 * ⚠️ CONCURRENT, and the reason is measured rather than aesthetic: Supabase is
 * in Sydney and the API in Oregon, so each round trip is 150–300 ms. Three
 * sequential searches is 450–900 ms of waiting for the same three answers.
 */
export async function researchTopic(
  ctx: TenancyContext,
  topic: string,
  briefId: string | null = null,
  locales: readonly BlogLocale[] = RESEARCH_LOCALES,
): Promise<ResearchResult> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    // ⚠️ THROWS. Returning an empty source list here would produce a brief built
    // entirely on model guesswork with nothing to check it against — which is
    // the failure §8 of the specification exists to prevent.
    throw new ValidationError(
      'RESEARCH_NOT_CONFIGURED: TAVILY_API_KEY is not set. Research cannot produce real sources without it.',
    )
  }

  const runKey = researchRunKey(ctx.workspaceId, topic, locales)

  const settled = await Promise.allSettled(
    locales.map(async (locale) => ({
      locale,
      results: await searchOne(buildQuery(topic, locale), locale, apiKey),
    })),
  )

  const perLocale: Record<string, TavilyResult[]> = {}
  const queries: ResearchResult['queries'] = []
  const skipped: ResearchResult['skipped'] = []

  settled.forEach((outcome, index) => {
    const locale = locales[index]!
    if (outcome.status === 'fulfilled') {
      perLocale[locale] = outcome.value.results
      queries.push({ locale, query: buildQuery(topic, locale) })
      return
    }
    // ⚠️ ONE LOCALE FAILING IS NOT A FAILED RUN. `fa` failing while `en` works
    // still produced three real sources, and a run that reports nothing because
    // of one provider hiccup wastes the other two.
    skipped.push({
      locale,
      reason: outcome.reason instanceof Error ? outcome.reason.message : 'unknown',
    })
  })

  const sources = mergeSources(perLocale)

  return { runKey, topic, briefId, queries, sources, skipped }
}

/**
 * The query per locale.
 *
 * ⚠️ NOT A TRANSLATION. The Persian query is the topic; the English one adds
 * the terms an English page would use. Translating «مدیریت بدهی مشتریان» literally
 * finds English pages about receivable MANAGEMENT in general, which is a weaker
 * result set than asking for the accounting term.
 */
function buildQuery(topic: string, locale: BlogLocale): string {
  if (locale === 'en') return `${topic} accounting small business`
  if (locale === 'af') return `${topic} حسابداری افغانستان معیاری`
  return topic
}

/**
 * Persist the run and its sources.
 *
 * ⚠️ SOURCES FIRST, THEN THE RUN. The run row carries `result_meta.sourceIds`,
 * so the sources must exist before it is written — and that also makes a retry
 * safe end to end: the upserts are idempotent on `url_normalised`, and a second
 * run insert hits the `run_key` unique constraint and reports `created: false`
 * WITH the ids it just re-saved, so the caller never reads a retry as a loss.
 *
 * ⚠️ THE UNIQUE KEY ON `run_key` IS THE IDEMPOTENCY, not this function: a retry
 * that reaches here twice must not create a second run, and the constraint is
 * what stops it — caught and reported rather than merged silently, because a
 * duplicate means the caller retried something that had already run.
 */
export async function saveResearchRun(
  result: ResearchResult,
  runId: string,
): Promise<{ created: boolean; sourceIds: string[]; failed: number }> {
  const sourceIds: string[] = []
  let failed = 0

  for (const source of result.sources) {
    const { data, error } = await supabase
      .from('blog_sources')
      .upsert(
        {
          // ⚠️ NO workspace_id HERE — `blog_sources` has no such column. One
          // page is one row for the whole product (`UNIQUE (url_normalised)`),
          // so a second research run on the same authority reuses the row
          // instead of storing it twice. The first version of this upsert sent
          // `workspace_id` anyway: every insert failed on the unknown column,
          // the `continue` below swallowed it, and the table stayed empty while
          // the brief was marked ready. Guard: content-intelligence-schema
          // .test.ts («the code writes only columns the migration defines»).
          url_normalised: source.urlNormalised,
          url: source.url,
          title: source.title,
          domain: source.domain,
          source_type: source.sourceType,
          authority_score: source.authorityScore,
          retrieved_at: new Date().toISOString(),
        },
        { onConflict: 'url_normalised' },
      )
      .select('id')
      .maybeSingle()

    if (error) {
      // ⚠️ COUNTED, not just logged. The caller decides the brief's status from
      // what PERSISTED, so a run where every source failed to save is a failed
      // run — not a `brief_ready` with an empty citation table.
      failed += 1
      console.error(`[research] could not save source ${source.urlNormalised}:`, error.message)
      continue
    }
    if (data?.id) sourceIds.push(data.id)
  }

  const { error: insertError } = await supabase.from('blog_research_runs').insert({
    id: runId,
    // ⚠️ PERSISTED, not just carried. The migration defines `brief_id` so a run
    // can be explained from the brief it served; the first version left the
    // field on `result` and never wrote it, and every run came back orphaned.
    brief_id: result.briefId,
    topic: result.topic,
    locale: 'fa',
    run_key: result.runKey,
    status: 'completed',
    outcome: result.skipped.length > 0 ? 'partial' : 'complete',
    completed_at: new Date().toISOString(),
    queries: result.queries,
    // ⚠️ What PERSISTED, not what Tavily returned. A count from the in-memory
    // list would report sources the database never got.
    source_count: sourceIds.length,
    // The run → source link, without a join table: the brief editor reads the
    // run and can fetch exactly the sources this research found.
    result_meta: { sourceIds },
    created_at: new Date().toISOString(),
  })

  if (insertError && insertError.code !== '23505') {
    throw new ValidationError(`RESEARCH_RUN_SAVE_FAILED: ${insertError.code ?? 'unknown'}`)
  }

  // ⚠️ 23505 = the run_key already exists, i.e. this exact research already
  // happened. That is the SUCCESS path for a retry, not a failure — and the
  // re-upserted source ids are still real, so they are returned.
  return { created: !insertError, sourceIds, failed }
}
