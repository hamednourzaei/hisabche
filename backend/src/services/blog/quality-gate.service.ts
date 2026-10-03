// ============================================
// Capability: quality gate (Phase 5).
//
// ⚠️ THIS GATE IS CODE, NOT A MODEL.
//
// Asking the model «is your own draft good enough?» is asking the defendant to
// be the judge — and it always says yes, in fluent prose. Every check below is a
// deterministic read of what is actually stored: does the article have the
// sections the brief required, does it make claims the product cannot back, does
// it copy a competitor, is it in the right language, is it long enough to be an
// article. A model cannot argue with any of them.
//
// ⚠️ THE GATE DOES NOT DELETE OR PUBLISH. It writes a `blog_quality_reports`
// row and returns a verdict. A failed gate leaves the draft readable in admin
// WITH the reasons — hiding a failed draft hides why it failed, and the editor
// then has nothing to fix.
//
// ⚠️ ONE ROW PER RUN. A re-run is a second row, not an overwrite: the report is
// a record of a decision, and the decision that was later changed is the one
// worth keeping.
// ============================================

import { supabase } from '../../db'
import { ValidationError } from '../../errors/validation.error'
import { BlogError, isMissingSchema, readingMinutes } from './blog.domain'
import { claimsNotInProduct, htmlToText } from '@hisabche/validation'

/** The checks, named so a report says WHICH one failed rather than just "failed". */
export type QualityCheckId =
  | 'structure'
  | 'brief-sections'
  | 'length'
  | 'language'
  | 'claims'
  | 'competitor-copy'
  | 'meta'
  | 'title'
  // ─── the editorial checklist (never blocking) ───
  | 'tldr'
  | 'paragraphs'
  | 'emphasis'
  | 'cliches'
  | 'faq'
  | 'title-seo'
  | 'meta-length'
  | 'no-links'
  | 'mistakes-section'
  | 'cta'

export interface QualityCheck {
  id: QualityCheckId
  passed: boolean
  /**
   * ⚠️ A NON-BLOCKING CHECK IS SURFACED, NOT ENFORCED. The overall verdict is
   * the blocking checks only; a non-blocking failure still appears in the
   * report so the human reviewer at `validation_ready` reads it and decides.
   *
   * `claims` is the one non-blocking check, and that mirrors the human publish
   * path exactly: `blog.service.ts` runs the SAME `claimsNotInProduct` and
   * returns it as a warning, because the checker cannot tell «an article ABOUT
   * two-factor login» (a legitimate accounting-blog topic) from «claims Hisabche
   * HAS two-factor login» (false). Blocking here would refuse the first to
   * catch the second — and reinvent the claims rule with harsher semantics than
   * the rest of the product (G2). The reviewer distinguishes; the gate flags.
   */
  blocking: boolean
  /** Shown to the editor verbatim. One sentence: what and, when it failed, why. */
  reason: string
}

export interface QualityVerdict {
  reportId: string
  passed: boolean
  checks: QualityCheck[]
  diagnostics: Record<string, unknown>
}

/** A draft with fewer real headings than this is not an article, it is a note. */
const MIN_HEADINGS = 2
/** Below this many words the "article" is thinner than the excerpt could be. */
const MIN_WORDS = 400
const MAX_WORDS = 6000

/**
 * Arabic-script ratio. `fa` and `af` are written in Arabic script; `en` is not.
 * A draft that came back in the wrong language is the most common silent failure
 * of a multilingual prompt, and it reads as "fine" to a check that only counts
 * characters.
 */
function arabicScriptRatio(text: string): number {
  const letters = text.replace(/[^\p{L}]/gu, '')
  if (letters.length === 0) return 0
  const arabic = letters.replace(/[^؀-ۿ]/gu, '').length
  return arabic / letters.length
}

// ─── the editorial checklist ─────────────────────────────────────────────────
//
// The writer prompt ends with a self-audit («is every paragraph under 4 lines,
// is there a TL;DR, is it free of clichés…»). A model grading its own work is
// not a check. These are the same questions, answered by CODE from what was
// actually stored — one named check each.
//
// ⚠️ ALL NON-BLOCKING. They are editorial quality, not correctness: a draft
// with a 5-line paragraph is still a draft a human can fix in a minute, and
// blocking on style would stop the pipeline for something the eight
// structural checks above were never meant to judge. The reviewer reads them.

/** About four lines on a phone. */
export const MAX_PARAGRAPH_WORDS = 80
export const TITLE_MAX_CHARS = 60
export const META_MIN_CHARS = 140
export const META_MAX_CHARS = 155

/** Openers that mark a text as machine-written. Matched anywhere, case-insensitive. */
export const CLICHES: readonly string[] = [
  'در دنیای امروز',
  'در دنیای پرشتاب امروز',
  'در عصر حاضر',
  'در عصر دیجیتال',
  'همان‌طور که می‌دانید',
  'همانطور که می‌دانید',
  'بدون شک',
  'در این مقاله قصد داریم',
  "in today's fast-paced world",
  "in today's world",
  'in the digital age',
  'it is no secret that',
  'in this article we will',
]

export interface EditorialInput {
  title: string
  html: string
  metaDescription: string | null
  tldr: string[]
  faqCount: number
  focusKeyword: string
}

export function evaluateEditorial(input: EditorialInput): QualityCheck[] {
  const checks: QualityCheck[] = []
  const add = (id: QualityCheckId, passed: boolean, reason: string) =>
    checks.push({ id, passed, blocking: false, reason })

  const text = htmlToText(input.html)
  const lower = text.toLowerCase()

  add(
    'tldr',
    input.tldr.length === 3,
    input.tldr.length === 3
      ? 'a 3-bullet summary opens the article'
      : `the summary has ${input.tldr.length} bullet(s); the checklist asks for exactly 3`,
  )

  const paragraphs = [...input.html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(
    (m) =>
      htmlToText(m[1] ?? '')
        .split(/\s+/)
        .filter(Boolean).length,
  )
  const long = paragraphs.filter((words) => words > MAX_PARAGRAPH_WORDS)
  add(
    'paragraphs',
    long.length === 0,
    long.length === 0
      ? `every paragraph is within ${MAX_PARAGRAPH_WORDS} words`
      : `${long.length} paragraph(s) run past ${MAX_PARAGRAPH_WORDS} words (the longest: ${Math.max(...long)}) — too long for a phone`,
  )

  // Digits in any of the three scripts the blog is written in.
  const hasNumbers = /[0-9۰-۹٠-٩]/.test(text)
  const hasBold = /<(strong|b)[\s>]/.test(input.html)
  add(
    'emphasis',
    !hasNumbers || hasBold,
    !hasNumbers
      ? 'no figures in the body to emphasise'
      : hasBold
        ? 'key figures or terms are bolded'
        : 'the body has figures but nothing is bolded for scanning',
  )

  const found = CLICHES.filter((phrase) => lower.includes(phrase.toLowerCase()))
  add(
    'cliches',
    found.length === 0,
    found.length === 0 ? 'no stock opener found' : `stock phrase(s): ${found.join(' | ')}`,
  )

  add(
    'faq',
    input.faqCount >= 3 && input.faqCount <= 4,
    input.faqCount >= 3 && input.faqCount <= 4
      ? `${input.faqCount} FAQ entries`
      : `${input.faqCount} FAQ entr${input.faqCount === 1 ? 'y' : 'ies'}; the checklist asks for 3 to 4`,
  )

  const title = input.title.trim()
  const keyword = input.focusKeyword.trim()
  const titleShort = title.length <= TITLE_MAX_CHARS
  const titleHasKeyword =
    keyword.length === 0 || title.toLowerCase().includes(keyword.toLowerCase())
  add(
    'title-seo',
    titleShort && titleHasKeyword && keyword.length > 0,
    keyword.length === 0
      ? 'no primary keyword was stated, so the title cannot be checked against it'
      : !titleShort
        ? `the title is ${title.length} characters; the checklist asks for under ${TITLE_MAX_CHARS}`
        : !titleHasKeyword
          ? `the title does not contain the primary keyword «${keyword}»`
          : 'the title is short and carries the primary keyword',
  )

  const meta = (input.metaDescription ?? '').trim()
  const metaOk = meta.length >= META_MIN_CHARS && meta.length <= META_MAX_CHARS
  add(
    'meta-length',
    metaOk,
    metaOk
      ? `the meta description is ${meta.length} characters`
      : `the meta description is ${meta.length} characters; the checklist asks for ${META_MIN_CHARS}–${META_MAX_CHARS}`,
  )

  // The writer is told to write no links: an internal link is a reviewed
  // suggestion, and a URL a model typed is a URL nobody checked exists.
  const hasLink = /<a[\s>]/.test(input.html) || /https?:\/\//.test(text)
  add(
    'no-links',
    !hasLink,
    hasLink
      ? 'the body contains a link or a URL the writer was told not to produce — check that it exists'
      : 'no link or URL written by the model',
  )

  const headings = [...input.html.matchAll(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/g)].map((m) =>
    htmlToText(m[1] ?? '').toLowerCase(),
  )
  const hasMistakes = headings.some((h) => /اشتباه|خطا|ریسک|mistake|risk|pitfall/.test(h))
  add(
    'mistakes-section',
    hasMistakes,
    hasMistakes
      ? 'a common-mistakes / risk section is present'
      : 'no section on common mistakes or risk',
  )

  // The close should connect the topic to the product, by name.
  const tail = lower.slice(Math.floor(lower.length * 0.8))
  const hasCta = /حسابچه|hesabche|hisabche/.test(tail)
  add(
    'cta',
    hasCta,
    hasCta
      ? 'the article closes by connecting the topic to the product'
      : 'the closing part never mentions the product',
  )

  return checks
}

/**
 * The gate. Pure over the values it is given, so it is testable without a
 * database; `runQualityGate` reads the row and persists the verdict.
 */
export function evaluateDraft(input: {
  locale: 'fa' | 'af' | 'en'
  title: string
  html: string
  metaTitle: string | null
  metaDescription: string | null
  requiredSections: Array<{ heading: string; purpose?: string }>
  competitorSourceTitles: string[]
  /**
   * The editorial metadata of a generated draft. When given, the editorial
   * checklist is appended (never blocking). Absent for a draft from before
   * prompt v2 — then only the eight structural checks run.
   */
  editorial?: { tldr: string[]; faqCount: number; focusKeyword: string } | undefined
}): { passed: boolean; checks: QualityCheck[]; diagnostics: Record<string, unknown> } {
  const checks: QualityCheck[] = []
  const text = htmlToText(input.html)
  const words = text.split(/\s+/).filter(Boolean).length
  const headings = (input.html.match(/<h[234][\s>]/g) ?? []).length

  // 1. Structure — enough headings to be an article with sections.
  checks.push({
    id: 'structure',
    passed: headings >= MIN_HEADINGS,
    blocking: true,
    reason:
      headings >= MIN_HEADINGS
        ? `${headings} section headings present`
        : `only ${headings} section heading(s); an article needs at least ${MIN_HEADINGS}`,
  })

  // 2. Brief sections — the plan the editor approved was actually followed.
  // ⚠️ Matched loosely: a heading that CONTAINS the required heading's words,
  // case- and whitespace-insensitive. Exact equality would fail a draft for
  // rephrasing «چطور پیگیری کنیم» as «نحوه‌ی پیگیری» — the same section, and
  // refusing it teaches the editor to distrust a gate that is being pedantic.
  const required = input.requiredSections.map((s) => s.heading).filter((h) => h.trim())
  const headingTexts = [...input.html.matchAll(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/g)].map((m) =>
    htmlToText(m[1] ?? '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim(),
  )
  const missing = required.filter(
    (r) =>
      !headingTexts.some(
        (h) =>
          h.includes(r.toLowerCase().replace(/\s+/g, ' ').trim()) ||
          r.toLowerCase().replace(/\s+/g, ' ').trim().includes(h),
      ),
  )
  checks.push({
    id: 'brief-sections',
    passed: required.length === 0 || missing.length === 0,
    blocking: true,
    reason:
      required.length === 0
        ? 'the brief required no sections'
        : missing.length === 0
          ? 'every section the brief required is present'
          : `missing required section(s): ${missing.slice(0, 5).join('، ')}`,
  })

  // 3. Length — thin content is the §7 failure the brief's originalValue exists
  // to prevent; absurd length usually means the model padded or looped.
  checks.push({
    id: 'length',
    passed: words >= MIN_WORDS && words <= MAX_WORDS,
    blocking: true,
    reason:
      words < MIN_WORDS
        ? `${words} words is thinner than the ${MIN_WORDS}-word floor`
        : words > MAX_WORDS
          ? `${words} words exceeds the ${MAX_WORDS}-word ceiling — likely padded or looped`
          : `${words} words`,
  })

  // 4. Language — a `fa`/`af` draft must be in Arabic script; an `en` one must not.
  const ratio = arabicScriptRatio(text)
  const wantArabic = input.locale !== 'en'
  const languageOk = wantArabic ? ratio >= 0.6 : ratio <= 0.2
  checks.push({
    id: 'language',
    passed: languageOk,
    blocking: true,
    reason: languageOk
      ? `the body is written in ${input.locale}`
      : `the brief asked for ${input.locale} but the body reads as ${ratio > 0.5 ? 'Arabic script' : 'Latin script'} (${Math.round(ratio * 100)}%)`,
  })

  // 5. Claims — the SAME checker the human publish path runs, with the SAME
  // semantics: a warning for the reviewer, never a refusal. See `blocking` on
  // QualityCheck for why blocking here would be a second, harsher claims rule.
  const claims = claimsNotInProduct([input.title, text].join(' '))
  checks.push({
    id: 'claims',
    passed: claims.length === 0,
    blocking: false,
    reason:
      claims.length === 0
        ? 'no capability claimed that the product does not have'
        : `claims a feature the product does not have — the reviewer must check this sentence: ${claims.join('، ')}`,
  })

  // 6. Competitor copy — a competitor source is a legitimate INPUT, never text
  // to reproduce. A competitor's title appearing verbatim in the body means the
  // model lifted the lead, which is the copying the gate exists to stop.
  const bodyLower = text.toLowerCase().replace(/\s+/g, ' ')
  const copied = input.competitorSourceTitles.filter((t) => {
    const needle = t.toLowerCase().replace(/\s+/g, ' ').trim()
    return needle.length >= 12 && bodyLower.includes(needle)
  })
  checks.push({
    id: 'competitor-copy',
    passed: copied.length === 0,
    blocking: true,
    reason:
      copied.length === 0
        ? 'no competitor source text reproduced in the body'
        : `body reproduces competitor title text: ${copied.slice(0, 3).join(' | ')}`,
  })

  // 7. Meta — a post with no meta description inherits a truncated body in the
  // SERP, and the SEO panel cannot fill what was never generated.
  const metaOk =
    !!input.metaTitle &&
    input.metaTitle.trim().length > 0 &&
    !!input.metaDescription &&
    input.metaDescription.trim().length >= 40
  checks.push({
    id: 'meta',
    passed: metaOk,
    blocking: true,
    reason: metaOk
      ? 'meta title and a substantive meta description are present'
      : 'meta title missing, or the meta description is shorter than 40 characters',
  })

  // 8. Title — non-empty and not the topic echoed with a prefix, which is the
  // model's default when it has nothing to say.
  const titleOk = input.title.trim().length >= 5 && input.title.trim().length <= 200
  checks.push({
    id: 'title',
    passed: titleOk,
    blocking: true,
    reason: titleOk
      ? 'the title is a usable length'
      : 'the title is empty or longer than 200 characters',
  })

  if (input.editorial) {
    checks.push(
      ...evaluateEditorial({
        title: input.title,
        html: input.html,
        metaDescription: input.metaDescription,
        ...input.editorial,
      }),
    )
  }

  // ⚠️ THE VERDICT IS THE BLOCKING CHECKS ONLY. A failed `claims` warning
  // rides along in `checks` for the reviewer; it does not stop the draft.
  const passed = checks.every((c) => c.passed || !c.blocking)
  return {
    passed,
    checks,
    diagnostics: { words, headings, arabicScriptRatio: Number(ratio.toFixed(3)) },
  }
}

/**
 * Read a draft version, run the gate, persist the report.
 *
 * ⚠️ THE COMPETITOR TITLES COME FROM THE RUN'S REAL SOURCES. The gate can only
 * detect copying from a source it knows is a competitor — so it reads the same
 * `blog_sources` rows the draft was built from, filtered to `competitor`.
 */
export async function runQualityGate(versionId: string, briefId: string): Promise<QualityVerdict> {
  const { data: version, error: versionError } = await supabase
    .from('blog_article_versions')
    .select('title, content_html, meta_title, meta_description, faq, generation_meta')
    .eq('id', versionId)
    .maybeSingle()

  if (versionError) {
    if (isMissingSchema(versionError)) throw new BlogError('BLOG_MIGRATION_PENDING')
    throw new ValidationError(`GATE_VERSION_READ_FAILED: ${versionError.code}`)
  }
  if (!version) throw new ValidationError(`GATE_VERSION_NOT_FOUND: ${versionId}`)

  const { data: brief } = await supabase
    .from('blog_content_briefs')
    .select('locale, required_sections')
    .eq('id', briefId)
    .maybeSingle()

  const locale = ((brief?.locale as string) ?? 'fa') as 'fa' | 'af' | 'en'
  const requiredSections =
    (brief?.required_sections as Array<{ heading: string; purpose?: string }>) ?? []

  // The sources this draft was generated from, via its own generation_meta —
  // not a topic match, and not every competitor source in the database.
  const sourceIds = (version.generation_meta as { sourceIds?: string[] } | null)?.sourceIds ?? []
  let competitorTitles: string[] = []
  if (sourceIds.length > 0) {
    const { data } = await supabase
      .from('blog_sources')
      .select('title')
      .in('id', sourceIds)
      .eq('source_type', 'competitor')
    competitorTitles = ((data ?? []) as Array<{ title: string | null }>)
      .map((s) => s.title ?? '')
      .filter((t) => t.length > 0)
  }

  const editorialMeta = version.generation_meta as { tldr?: string[]; focusKeyword?: string } | null

  const verdict = evaluateDraft({
    locale,
    title: (version.title as string) ?? '',
    html: (version.content_html as string) ?? '',
    metaTitle: (version.meta_title as string | null) ?? null,
    metaDescription: (version.meta_description as string | null) ?? null,
    requiredSections,
    competitorSourceTitles: competitorTitles,
    // Present on a prompt-v2 draft; an older one runs the structural checks only.
    editorial: Array.isArray(editorialMeta?.tldr)
      ? {
          tldr: editorialMeta.tldr,
          faqCount: Array.isArray(version.faq) ? version.faq.length : 0,
          focusKeyword: editorialMeta.focusKeyword ?? '',
        }
      : undefined,
  })

  const { data: report, error } = await supabase
    .from('blog_quality_reports')
    .insert({
      version_id: versionId,
      brief_id: briefId,
      passed: verdict.passed,
      checks: verdict.checks,
      diagnostics: verdict.diagnostics,
    })
    .select('id')
    .single()

  if (error) {
    if (isMissingSchema(error)) throw new BlogError('BLOG_MIGRATION_PENDING')
    throw new ValidationError(`GATE_REPORT_SAVE_FAILED: ${error.code ?? error.message}`)
  }

  // ⚠️ A PASSED GATE ADVANCES THE PIPELINE; A FAILED ONE DOES NOT. The draft is
  // still readable either way — this only says whether it may move to review.
  if (verdict.passed) {
    await supabase
      .from('blog_content_briefs')
      .update({ intelligence_status: 'validation_ready', updated_at: new Date().toISOString() })
      .eq('id', briefId)
  }

  return {
    reportId: report.id as string,
    passed: verdict.passed,
    checks: verdict.checks,
    diagnostics: verdict.diagnostics,
  }
}
