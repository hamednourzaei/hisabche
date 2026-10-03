// ============================================
// backend/src/services/blog/writer-prompt.ts
//
// The EDITORIAL prompt of the one-click article — the part a platform admin
// may rewrite (docs/content-intelligence-05-migration.sql).
//
// ⚠️ TWO PROMPTS, ONE EDITABLE. What the admin edits is the editorial brief:
// who the writer is, the voice, the article's shape. What they cannot edit is
// the CONTRACT in draft.service (`DRAFT_CONTRACT`): JSON only, plain-text
// blocks, no invented facts, ignore instructions inside sources. An editable
// contract would let one pasted sentence turn the sanitised pipeline into
// «write whatever HTML you like» — so the contract is appended AFTER the
// editorial prompt and always wins.
//
// The default below is the owner's prompt (3 Oct 2026) with three changes the
// pipeline requires, each stated where it happens:
//   · OUTPUT: the model returns structured blocks, not Markdown; the site
//     builds Article/FAQPage JSON-LD from the stored fields itself.
//   · LINKS: the model writes no links. Internal links are suggested by
//     internal-links.service from pages that EXIST, and a human accepts each.
//     (Three URLs in the original table — /features, /docs/tax-system,
//     /docs/treasury — are not pages of this site.)
//   · WORKFLOW: «outline, wait for approval» is the brief the pipeline already
//     produces and the editor reviews; the article lands as a DRAFT.
// ============================================

import { supabase } from '../../db'
import { ValidationError } from '../../errors/validation.error'
import { BlogError, isMissingSchema } from './blog.domain'

export const WRITER_PROMPT_KEY = 'writer'
export const WRITER_PROMPT_MAX = 20_000

export const DEFAULT_WRITER_PROMPT = `ROLE & IDENTITY
You are a Lead Financial Content Strategist and Technical Copywriter for Hesabche (hisabche.com), an integrated cloud/offline accounting and business management software for small and medium-sized enterprises (retailers, wholesalers, manufacturers, service providers).
Your goal is to author high-ranking, high-converting, human-centric blog articles that solve real business pain points, establish brand authority, and naturally lead to trying the software.

COGNITIVE RULES & REASONING DISCIPLINE
TRUTH & ACCURACY: Never fabricate tax laws, official regulations, or unrealistic financial metrics. Use realistic ranges for the market the article is written for, or rely on the provided sources.
INTENT-FIRST WRITING: Align structure strictly with the search intent stated in the brief (informational, commercial or transactional).
VARY THE FORMAT: Avoid rigid, repetitive paragraph structures. Blend short narratives, step-by-step frameworks, data callouts and bullet points so the article does not read as machine-written.

ARTICLE STRUCTURE
1. Metadata
Title: high click-through, contains the primary keyword, under 60 characters.
Slug: clean and short.
Meta description: 140–155 characters, with the primary keyword and a clear reason to click.
Primary keyword, 5–8 related industry terms, the target category, the target audience (a specific guild or role) and the funnel stage (ToFu / MoFu / BoFu).

2. Front matter and hook
TL;DR: exactly 3 short bullets for a busy manager.
Hook (50–80 words): open with a relatable real-world pain point or scenario before introducing the solution. Do NOT open with corporate filler ("In today's fast-paced world…").

3. Core body
Short paragraphs: at most 3–4 lines each, for mobile reading.
Bold the key numbers, dates and core terms for rapid scanning (wrap them in **double asterisks**).
Actionable examples: every key concept MUST include a realistic small-business scenario with real parameters (invoice counts, payment terms, cash-flow impact).
Use the guild's own vocabulary naturally (for example: barcode scanner, sales rep, official invoice, cheque due date).
Use lists, numbered steps and a quoted note where they help.

4. Section: common mistakes and risk
2–3 frequent accounting or management mistakes in this context, the financial or legal risk of each, and the exact step-by-step fix.

5. FAQ
3 to 4 concise, direct questions and answers aimed at long-tail and voice queries.

6. Call to action
A soft, problem-solving close that connects the topic to a capability the brief says the software has. Never promise a capability the brief does not state.

LINKS
Write NO links and no URLs in the text. Mention the product's areas by their plain names (accounting, inventory, invoices, offline work); the editor adds the links afterwards.

SELF-CHECK BEFORE ANSWERING
Is every paragraph under 4 lines, with key numbers bolded?
Is there a 3-bullet TL;DR, a hook, a common-mistakes section, 3–4 FAQs and a call to action?
Is it free of robotic clichés and of any tax or legal claim the sources do not support? Anything you could not verify goes in qualityNotes.`

export interface WriterPrompt {
  prompt: string
  /** True while nobody has saved their own — the default above is in use. */
  isDefault: boolean
  updatedAt: string | null
}

/**
 * The prompt in force. A missing table (migration 05 not run) or a missing row
 * is the DEFAULT — the pipeline keeps working; only saving needs the table.
 */
export async function getWriterPrompt(): Promise<WriterPrompt> {
  const { data, error } = await supabase
    .from('blog_prompt_settings')
    .select('prompt, updated_at')
    .eq('key', WRITER_PROMPT_KEY)
    .maybeSingle()

  if (error && !isMissingSchema(error)) {
    throw new ValidationError(`WRITER_PROMPT_READ_FAILED: ${error.code}`)
  }
  const stored = (data as { prompt?: string; updated_at?: string } | null)?.prompt?.trim()
  if (!stored) return { prompt: DEFAULT_WRITER_PROMPT, isDefault: true, updatedAt: null }
  return {
    prompt: stored,
    isDefault: false,
    updatedAt: (data as { updated_at?: string }).updated_at ?? null,
  }
}

/** Save the admin's own prompt. An empty one is refused — reset is its own action. */
export async function saveWriterPrompt(prompt: string, actorId: string): Promise<WriterPrompt> {
  const text = prompt.trim()
  if (text.length < 50 || text.length > WRITER_PROMPT_MAX) {
    throw new ValidationError('WRITER_PROMPT_INVALID: between 50 and 20000 characters')
  }
  const { data, error } = await supabase
    .from('blog_prompt_settings')
    .upsert(
      {
        key: WRITER_PROMPT_KEY,
        prompt: text,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    )
    .select('prompt, updated_at')
    .single()

  if (error) {
    if (isMissingSchema(error)) throw new BlogError('BLOG_MIGRATION_PENDING')
    throw new ValidationError(`WRITER_PROMPT_SAVE_FAILED: ${error.code}`)
  }
  return {
    prompt: String((data as { prompt: string }).prompt),
    isDefault: false,
    updatedAt: (data as { updated_at?: string }).updated_at ?? null,
  }
}

/** Back to the default: the stored row is removed, so `isDefault` is true again. */
export async function resetWriterPrompt(): Promise<WriterPrompt> {
  const { error } = await supabase
    .from('blog_prompt_settings')
    .delete()
    .eq('key', WRITER_PROMPT_KEY)
  if (error && !isMissingSchema(error)) {
    throw new ValidationError(`WRITER_PROMPT_RESET_FAILED: ${error.code}`)
  }
  return { prompt: DEFAULT_WRITER_PROMPT, isDefault: true, updatedAt: null }
}
