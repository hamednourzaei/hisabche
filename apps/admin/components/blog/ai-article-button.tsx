'use client'

// «Write with AI» — the one-click article of the blog editor.
//
// One button, one dialog: the topic, the EDITORIAL PROMPT (editable, saved for
// every admin, resettable to the default), and the progress of the existing
// content pipeline (research → brief → draft → quality gate).
//
// ⚠️ IT FILLS THE FORM. IT NEVER SAVES AND NEVER PUBLISHES. What comes back is
// handed to the editor as field values; the article's status is untouched, so
// a person still reads it and presses «save» or «publish» themselves.
//
// ⚠️ Every failure says WHICH stage and WHY (the server's own reason). A
// pipeline that is not set up — no AI provider, the content-intelligence
// scripts not run — is said in words, not shown as an endless spinner.
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Sparkles } from 'lucide-react'
import { apiErrorMessage } from '@hisabche/api'
import type { BlogLocale } from '@hisabche/validation'

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
} from '@/components/ui'
import {
  AiArticleError,
  useGenerateArticle,
  useResetWriterPrompt,
  useSaveWriterPrompt,
  useWriterPrompt,
  type AiStage,
  type GeneratedArticle,
} from '@/hooks/use-admin-blog-ai'

const WORKING: readonly AiStage[] = ['research', 'brief', 'writing', 'checking']

/** Refusals of the pipeline that have their own sentence. Anything else is shown as sent. */
const KNOWN_REASONS = [
  'AI_NOT_CONFIGURED',
  'BLOG_MIGRATION_PENDING',
  'RESEARCH_NOT_CONFIGURED',
  'timeout',
  'cancelled',
] as const

export function AiArticleButton({
  locale,
  topic,
  onApply,
}: {
  locale: BlogLocale
  /** The title already typed, offered as the topic. */
  topic: string
  onApply: (article: GeneratedArticle) => void
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [prompt, setPrompt] = useState('')
  const [showPrompt, setShowPrompt] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [result, setResult] = useState<GeneratedArticle | null>(null)

  const stored = useWriterPrompt(open)
  const savePrompt = useSaveWriterPrompt()
  const resetPrompt = useResetWriterPrompt()
  const { stage, generate, cancel } = useGenerateArticle()
  const working = WORKING.includes(stage)

  // Load the prompt in force into the textarea once it arrives.
  useEffect(() => {
    if (stored.data) setPrompt(stored.data.prompt)
  }, [stored.data])

  const openDialog = () => {
    setSubject(topic.trim())
    setFailure(null)
    setResult(null)
    setOpen(true)
  }

  const explain = (error: unknown): string => {
    const detail =
      error instanceof AiArticleError
        ? error.detail
        : apiErrorMessage(error, t('admin.blog.ai.failed'))
    const known = KNOWN_REASONS.find((code) => (detail ?? '').includes(code))
    const reason = known
      ? t(`admin.blog.ai.reasons.${known}`)
      : (detail ?? t('admin.blog.ai.failed'))
    return error instanceof AiArticleError
      ? `${t(`admin.blog.ai.stage.${error.stage}`)} — ${reason}`
      : reason
  }

  const promptDirty = stored.data ? prompt.trim() !== stored.data.prompt.trim() : false

  const run = async () => {
    setFailure(null)
    setResult(null)
    try {
      // The pipeline reads the SAVED prompt: an edited one is saved first, so
      // what is on screen is what writes the article.
      if (promptDirty) await savePrompt.mutateAsync(prompt)
      setResult(await generate(subject.trim(), locale))
    } catch (error) {
      setFailure(explain(error))
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={openDialog}>
        <Sparkles className="size-4" aria-hidden="true" />
        {t('admin.blog.ai.button')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next && working) cancel()
          setOpen(next)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.blog.ai.title')}</DialogTitle>
            <DialogDescription>{t('admin.blog.ai.description')}</DialogDescription>
          </DialogHeader>

          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t('admin.blog.ai.topic')}</span>
            <Input
              name="topic"
              value={subject}
              maxLength={200}
              disabled={working}
              onChange={(event) => setSubject(event.target.value)}
            />
          </label>

          <div className="space-y-2">
            <button
              type="button"
              className="text-xs text-[hsl(var(--color-primary))] underline"
              onClick={() => setShowPrompt((value) => !value)}
            >
              {showPrompt ? t('admin.blog.ai.hidePrompt') : t('admin.blog.ai.editPrompt')}
              {stored.data && !stored.data.isDefault ? ` · ${t('admin.blog.ai.customPrompt')}` : ''}
            </button>
            {showPrompt ? (
              stored.isError ? (
                <p role="alert" className="text-xs text-destructive">
                  {apiErrorMessage(stored.error, t('admin.blog.ai.promptLoadFailed'))}
                </p>
              ) : (
                <>
                  <textarea
                    name="prompt"
                    dir="ltr"
                    rows={14}
                    value={prompt}
                    maxLength={stored.data?.maxLength ?? 20000}
                    disabled={working || stored.isLoading}
                    onChange={(event) => setPrompt(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">{t('admin.blog.ai.promptHint')}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={working || !promptDirty || savePrompt.isPending}
                      onClick={() => savePrompt.mutate(prompt)}
                    >
                      {t('admin.blog.ai.savePrompt')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        working || resetPrompt.isPending || stored.data?.isDefault !== false
                      }
                      onClick={() => resetPrompt.mutate()}
                    >
                      {t('admin.blog.ai.resetPrompt')}
                    </Button>
                  </div>
                  {savePrompt.isError || resetPrompt.isError ? (
                    <p role="alert" className="text-xs text-destructive">
                      {explain(savePrompt.error ?? resetPrompt.error)}
                    </p>
                  ) : savePrompt.isSuccess && !promptDirty ? (
                    <p role="status" className="text-xs text-success">
                      {t('admin.blog.ai.promptSaved')}
                    </p>
                  ) : null}
                </>
              )
            ) : null}
          </div>

          {working ? (
            <p role="status" className="rounded-lg bg-accent p-3 text-sm">
              {t(`admin.blog.ai.stage.${stage}`)}…
              <span className="block text-xs text-muted-foreground">
                {t('admin.blog.ai.patience')}
              </span>
            </p>
          ) : null}

          {failure ? (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {failure}
            </p>
          ) : null}

          {result ? <Review article={result} /> : null}

          <div className="flex flex-wrap justify-end gap-2">
            {result ? (
              <Button
                type="button"
                onClick={() => {
                  onApply(result)
                  setOpen(false)
                }}
              >
                {t('admin.blog.ai.apply')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant={result ? 'outline' : 'default'}
              disabled={working || subject.trim().length < 3}
              onClick={() => void run()}
            >
              {result ? t('admin.blog.ai.again') : t('admin.blog.ai.generate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** What came back, before it touches the form: the gate's findings and the writer's own gaps. */
function Review({ article }: { article: GeneratedArticle }) {
  const t = useTranslations()
  const failed = article.checks.filter((check) => !check.passed)

  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm" data-ai-review="">
      <p className="font-medium">{article.title}</p>
      <p className="text-xs text-muted-foreground">
        {article.gatePassed === false
          ? t('admin.blog.ai.gateFailed')
          : t('admin.blog.ai.gatePassed', {
              passed: article.checks.length - failed.length,
              total: article.checks.length,
            })}
      </p>
      {failed.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {failed.map((check) => (
            <li key={check.id} className={check.blocking ? 'text-destructive' : 'text-warning'}>
              {check.blocking ? '✕' : '!'} <span dir="ltr">{check.id}</span>: {check.reason}
            </li>
          ))}
        </ul>
      ) : null}
      {article.qualityNotes.length > 0 ? (
        <div className="text-xs">
          <p className="font-medium">{t('admin.blog.ai.notes')}</p>
          <ul className="list-disc ps-4">
            {article.qualityNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">{t('admin.blog.ai.draftOnly')}</p>
    </div>
  )
}
