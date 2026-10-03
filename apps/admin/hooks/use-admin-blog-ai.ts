'use client'

import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@hisabche/api'
import type { BlogFaqItem, BlogLocale } from '@hisabche/validation'

/**
 * The one-click article of the blog editor — platform admin only.
 *
 * It drives the EXISTING content pipeline (backend/src/routes/blog.routes.ts);
 * there is no second generation path:
 *
 *   POST /admin/blog/intelligence/briefs           { topic, locale } → { briefId, jobId, … }
 *   GET  /admin/blog/intelligence/briefs/:id       → { brief, runs, sources }
 *   POST /admin/blog/intelligence/briefs/:id/draft → { jobId }      (202; a job, not a wait)
 *   GET  /admin/blog/intelligence/jobs/:id         → { status, lastError }
 *   GET  /admin/blog/intelligence/briefs/:id/drafts→ { drafts }     (newest first)
 *   GET  /admin/blog/intelligence/drafts/:id       → { version, qualityReports }
 *   GET|PUT|DELETE /admin/blog/intelligence/prompt  the editable editorial prompt
 *
 * ⚠️ The result FILLS THE FORM and nothing else. It is never saved and never
 * published from here: `status` is not among the fields this returns, so a
 * generated article cannot go live without a person pressing the button.
 */

export interface WriterPrompt {
  prompt: string
  isDefault: boolean
  updatedAt: string | null
  defaultPrompt: string
  maxLength: number
}

const promptKey = ['admin', 'blog', 'ai', 'prompt'] as const

export function useWriterPrompt(enabled: boolean) {
  return useQuery({
    queryKey: promptKey,
    queryFn: async (): Promise<WriterPrompt> =>
      (await apiClient.get('/admin/blog/intelligence/prompt')).data as WriterPrompt,
    enabled,
    retry: false,
  })
}

export function useSaveWriterPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (prompt: string) => {
      await apiClient.put('/admin/blog/intelligence/prompt', { prompt })
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: promptKey }),
  })
}

export function useResetWriterPrompt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete('/admin/blog/intelligence/prompt')
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: promptKey }),
  })
}

export interface QualityCheckRow {
  id: string
  passed: boolean
  blocking: boolean
  reason: string
}

/** What the editor form is filled with. No `status`: the pipeline never publishes. */
export interface GeneratedArticle {
  title: string
  slug: string
  excerpt: string
  html: string
  json: Record<string, unknown> | null
  faq: BlogFaqItem[]
  metaTitle: string
  metaDescription: string
  focusKeyword: string
  keywords: string[]
  /** A category NAME that exists for this locale, or ''. */
  categoryName: string
  /** What the writer could not verify — the reviewer must read these. */
  qualityNotes: string[]
  checks: QualityCheckRow[]
  /** False when a BLOCKING check failed; the draft is still shown, with the reason. */
  gatePassed: boolean | null
}

export type AiStage = 'idle' | 'research' | 'brief' | 'writing' | 'checking' | 'done' | 'failed'

const POLL_MS = 4000
/** Research + planning + a 180 s draft: stop asking after this and say so. */
const MAX_WAIT_MS = 8 * 60 * 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface BriefRead {
  brief: { intelligence_status?: string }
  runs: Array<{ status?: string; error?: string | null }>
}

interface JobRead {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  lastError: string | null
}

interface DraftRead {
  version: {
    title?: string
    slug?: string | null
    excerpt?: string | null
    content_html?: string
    content_json?: Record<string, unknown> | null
    meta_title?: string | null
    meta_description?: string | null
    faq?: BlogFaqItem[] | null
    generation_meta?: {
      qualityNotes?: string[]
      focusKeyword?: string
      keywords?: string[]
      categorySuggestion?: string
    } | null
  }
  qualityReports: Array<{ passed?: boolean; checks?: QualityCheckRow[] }>
}

/** A stage failed, with the server's own reason when it gave one. */
export class AiArticleError extends Error {
  constructor(
    readonly stage: Exclude<AiStage, 'idle' | 'done' | 'failed'>,
    readonly detail: string | null,
  ) {
    super(detail ?? stage)
    this.name = 'AiArticleError'
  }
}

export function useGenerateArticle() {
  const [stage, setStage] = useState<AiStage>('idle')
  const cancelled = useRef(false)

  const cancel = useCallback(() => {
    cancelled.current = true
    setStage('idle')
  }, [])

  const generate = useCallback(
    async (topic: string, locale: BlogLocale): Promise<GeneratedArticle> => {
      cancelled.current = false
      const deadline = Date.now() + MAX_WAIT_MS
      const alive = (at: Exclude<AiStage, 'idle' | 'done' | 'failed'>) => {
        if (cancelled.current) throw new AiArticleError(at, 'cancelled')
        if (Date.now() > deadline) throw new AiArticleError(at, 'timeout')
      }

      try {
        // ① research + ② brief — one job on the server.
        setStage('research')
        const created = (await apiClient.post('/admin/blog/intelligence/briefs', { topic, locale }))
          .data as { briefId: string }
        const briefId = created.briefId

        for (;;) {
          alive('research')
          const read = (await apiClient.get(`/admin/blog/intelligence/briefs/${briefId}`))
            .data as BriefRead
          const status = read.brief.intelligence_status ?? 'none'
          if (status === 'failed') {
            const reason = read.runs.find((run) => run.error)?.error ?? null
            throw new AiArticleError('research', reason)
          }
          // Anything past «researching» means the brief is filled.
          if (status !== 'none' && status !== 'researching') break
          if (read.runs.length > 0) setStage('brief')
          await sleep(POLL_MS)
        }

        // ③ the draft — a job; its state is read, never assumed.
        setStage('writing')
        const job = (await apiClient.post(`/admin/blog/intelligence/briefs/${briefId}/draft`))
          .data as { jobId: string }
        for (;;) {
          alive('writing')
          const state = (await apiClient.get(`/admin/blog/intelligence/jobs/${job.jobId}`))
            .data as JobRead
          if (state.status === 'failed') throw new AiArticleError('writing', state.lastError)
          if (state.status === 'completed') break
          await sleep(POLL_MS)
        }

        // ④ the result and its quality report.
        setStage('checking')
        const drafts = (await apiClient.get(`/admin/blog/intelligence/briefs/${briefId}/drafts`))
          .data as { drafts?: Array<{ id: string }> }
        const newest = drafts.drafts?.[0]
        if (!newest) throw new AiArticleError('checking', 'no draft was stored')
        const draft = (await apiClient.get(`/admin/blog/intelligence/drafts/${newest.id}`))
          .data as DraftRead

        const v = draft.version
        const meta = v.generation_meta ?? {}
        const report = draft.qualityReports[0]
        setStage('done')
        return {
          title: v.title ?? '',
          slug: v.slug ?? '',
          excerpt: v.excerpt ?? '',
          html: v.content_html ?? '',
          json: v.content_json ?? null,
          faq: Array.isArray(v.faq) ? v.faq : [],
          metaTitle: v.meta_title ?? '',
          metaDescription: v.meta_description ?? '',
          focusKeyword: meta.focusKeyword ?? '',
          keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
          categoryName: meta.categorySuggestion ?? '',
          qualityNotes: Array.isArray(meta.qualityNotes) ? meta.qualityNotes : [],
          checks: Array.isArray(report?.checks) ? report.checks : [],
          gatePassed: typeof report?.passed === 'boolean' ? report.passed : null,
        }
      } catch (error) {
        if (!cancelled.current) setStage('failed')
        throw error
      }
    },
    [],
  )

  return { stage, generate, cancel }
}
