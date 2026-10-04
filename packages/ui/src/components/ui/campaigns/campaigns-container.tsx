'use client'

// ============================================
// «کمپین‌ها» — a message, or an NPS question, sent by email to a group of the
// business's own customers (#106, #112).
//
// The screen follows the order a person decides in:
//   what do I say → to whom → who will actually receive it → send → what happened
//
// ⚠️ «Who will receive it» is shown BEFORE sending, with the customers who will
// NOT be reached and why (no address, opted out). Sending is a second press.
// ⚠️ When email is not configured on the server, the screen says so and the
// send button is not offered — a campaign is never shown as sent on a guess.
// ⚠️ Delivery is the outbox's own count: «در صف», «فرستاده شد», «نرسید».
// ⚠️ No answers = no score, said in words; it is never drawn as 0.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatNumber } from '@hisabche/formatting'
import {
  apiErrorMessage,
  useCampaignDetail,
  useCampaignPreview,
  useCampaigns,
  useCancelCampaign,
  useCreateCampaign,
  useLaunchCampaign,
  type Campaign,
  type CampaignKind,
  type CampaignLanguage,
  type CampaignSegment,
} from '@hisabche/api'

import { cn } from '../../../lib/utils'
import { useDateFormat } from '../../../hooks/use-date-format'
import { useIntlLocale } from '../../../hooks/use-intl-locale'
import { useRouteLang } from '../../../hooks/use-locale-push'
import { Button } from '../button'
import { KpiCard, KpiGrid } from '../kpi-card'
import { SelectField } from '../select-field'

export const CAMPAIGN_ERROR_CODES = [
  'CAMPAIGN_EMAIL_NOT_CONFIGURED',
  'CAMPAIGN_NO_RECIPIENTS',
  'CAMPAIGN_NOBODY_REACHABLE',
  'CAMPAIGN_AUDIENCE_TOO_LARGE',
  'CAMPAIGN_ALREADY_SENT',
  'CAMPAIGN_SEGMENT_DAYS',
  'CAMPAIGNS_MIGRATION_PENDING',
] as const
export const CAMPAIGN_SEGMENT_KEYS = ['all', 'overdue', 'recent_buyers', 'inactive'] as const
export const CAMPAIGN_KIND_KEYS = ['message', 'nps'] as const
export const CAMPAIGN_STATUS_KEYS = ['draft', 'sent', 'cancelled'] as const
const LANGUAGES = ['fa', 'af', 'en'] as const

const card =
  'rounded-2xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))]'
const field =
  'h-10 w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]'
const label = 'block text-xs text-[hsl(var(--fg-secondary))]'

export function CampaignsContainer() {
  const t = useTranslations('campaigns')
  const { date } = useDateFormat()
  const campaigns = useCampaigns()
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  const errorText = (error: unknown): string => {
    if ((error as { response?: { status?: number } } | null)?.response?.status === 403)
      return t('forbidden')
    const raw = apiErrorMessage(error, '')
    const code = CAMPAIGN_ERROR_CODES.find((known) => raw.includes(known))
    return code ? t(`errors.${code}`) : t('errors.general')
  }
  const known = <T extends string>(value: string, list: readonly T[]): value is T =>
    (list as readonly string[]).includes(value)
  const emailReady = campaigns.data?.channel.email.configured === true

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[hsl(var(--fg-primary))]">{t('title')}</h1>
          <p className="mt-1 text-sm text-[hsl(var(--fg-tertiary))]">{t('subtitle')}</p>
        </div>
        {!adding ? <Button onClick={() => setAdding(true)}>{t('add')}</Button> : null}
      </header>

      {campaigns.data && !emailReady ? (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[hsl(var(--color-warning)/0.4)] bg-[hsl(var(--color-warning)/0.08)] p-3 text-sm text-[hsl(var(--fg-primary))]"
        >
          {t('emailNotConfigured')}
        </p>
      ) : null}

      {adding ? (
        <CampaignForm
          errorText={errorText}
          onDone={(created) => {
            setAdding(false)
            if (created) setSelected(created.id)
          }}
        />
      ) : null}

      {campaigns.isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : campaigns.error || !campaigns.data ? (
        <p role="alert" className={cn(card, 'p-4 text-sm text-[hsl(var(--color-destructive))]')}>
          {errorText(campaigns.error)}
        </p>
      ) : campaigns.data.campaigns.length === 0 ? (
        <p className={cn(card, 'p-6 text-center text-sm text-[hsl(var(--fg-secondary))]')}>
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {campaigns.data.campaigns.map((campaign) => (
            <li key={campaign.id} className={cn(card, 'p-4')}>
              <button
                type="button"
                onClick={() =>
                  setSelected((current) => (current === campaign.id ? null : campaign.id))
                }
                className="flex w-full flex-wrap items-center gap-2 text-start"
                aria-expanded={selected === campaign.id}
              >
                <span className="font-medium text-[hsl(var(--fg-primary))]">{campaign.name}</span>
                <span className="rounded-full bg-[hsl(var(--color-primary)/0.1)] px-2 py-0.5 text-xs text-[hsl(var(--color-primary))]">
                  {known(campaign.kind, CAMPAIGN_KIND_KEYS)
                    ? t(`kinds.${campaign.kind}`)
                    : campaign.kind}
                </span>
                <span className="rounded-full bg-[hsl(var(--surface-muted))] px-2 py-0.5 text-xs text-[hsl(var(--fg-secondary))]">
                  {known(campaign.status, CAMPAIGN_STATUS_KEYS)
                    ? t(`statuses.${campaign.status}`)
                    : campaign.status}
                </span>
                <span className="ms-auto text-xs text-[hsl(var(--fg-tertiary))]">
                  {date(campaign.sentAt ?? campaign.createdAt)}
                </span>
              </button>
              {selected === campaign.id ? (
                <CampaignPanel campaign={campaign} emailReady={emailReady} errorText={errorText} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('note')}</p>
    </div>
  )
}

function CampaignForm({
  onDone,
  errorText,
}: {
  onDone: (created: Campaign | null) => void
  errorText: (error: unknown) => string
}) {
  const t = useTranslations('campaigns')
  const routeLang = useRouteLang()
  const create = useCreateCampaign()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<CampaignKind>('message')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [language, setLanguage] = useState<CampaignLanguage>(
    (LANGUAGES as readonly string[]).includes(routeLang ?? '')
      ? (routeLang as CampaignLanguage)
      : 'fa',
  )
  const [segment, setSegment] = useState<CampaignSegment>('all')
  const [days, setDays] = useState('30')
  const needsDays = segment === 'recent_buyers' || segment === 'inactive'
  const daysValue = Number(days)
  const ready =
    name.trim() !== '' &&
    subject.trim() !== '' &&
    body.trim() !== '' &&
    (!needsDays || (Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= 730))

  return (
    <section className={cn(card, 'space-y-3 p-4')}>
      <h2 className="font-semibold text-[hsl(var(--fg-primary))]">{t('newTitle')}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1">
          <span className={label}>{t('name')}</span>
          <input
            name="name"
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            className={field}
          />
        </label>
        <div className="space-y-1">
          <span className={label}>{t('kind')}</span>
          <SelectField
            name="kind"
            data-field="kind"
            aria-label={t('kind')}
            value={kind}
            onChange={(next) => setKind(next as CampaignKind)}
            options={CAMPAIGN_KIND_KEYS.map((key) => ({ value: key, label: t(`kinds.${key}`) }))}
            className={field}
          />
        </div>
        <div className="space-y-1">
          <span className={label}>{t('segment')}</span>
          <SelectField
            name="segment"
            data-field="segment"
            aria-label={t('segment')}
            value={segment}
            onChange={(next) => setSegment(next as CampaignSegment)}
            options={CAMPAIGN_SEGMENT_KEYS.map((key) => ({
              value: key,
              label: t(`segments.${key}`),
            }))}
            className={field}
          />
        </div>
        {needsDays ? (
          <label className="space-y-1">
            <span className={label}>{t('segmentDays')}</span>
            <input
              name="segmentDays"
              inputMode="numeric"
              dir="ltr"
              value={days}
              onChange={(event) => setDays(event.target.value.replace(/[^0-9]/g, ''))}
              className={cn(field, 'tabular-nums')}
            />
          </label>
        ) : null}
        <div className="space-y-1">
          <span className={label}>{t('language')}</span>
          <SelectField
            name="language"
            data-field="language"
            aria-label={t('language')}
            value={language}
            onChange={(next) => setLanguage(next as CampaignLanguage)}
            options={LANGUAGES.map((key) => ({ value: key, label: t(`languages.${key}`) }))}
            className={field}
          />
        </div>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>{t('subject')}</span>
          <input
            name="subject"
            value={subject}
            maxLength={150}
            onChange={(event) => setSubject(event.target.value)}
            className={field}
          />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className={label}>{t('body')}</span>
          <textarea
            name="body"
            value={body}
            maxLength={4000}
            rows={5}
            onChange={(event) => setBody(event.target.value)}
            className="w-full rounded-[var(--radius-md)] border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-3 text-sm text-[hsl(var(--fg-primary))] outline-none focus:border-[hsl(var(--color-primary))]"
          />
          <span className="block text-xs text-[hsl(var(--fg-tertiary))]">
            {kind === 'nps' ? t('bodyHintNps') : t('bodyHint')}
          </span>
        </label>
      </div>
      {create.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(create.error)}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          disabled={!ready || create.isPending}
          onClick={() =>
            create.mutate(
              {
                name,
                kind,
                subject,
                body,
                language,
                segment,
                segmentDays: needsDays ? daysValue : null,
              },
              { onSuccess: (created) => onDone(created) },
            )
          }
        >
          {t('saveDraft')}
        </Button>
        <Button variant="ghost" onClick={() => onDone(null)}>
          {t('cancel')}
        </Button>
      </div>
    </section>
  )
}

function CampaignPanel({
  campaign,
  emailReady,
  errorText,
}: {
  campaign: Campaign
  emailReady: boolean
  errorText: (error: unknown) => string
}) {
  const t = useTranslations('campaigns')
  const locale = useIntlLocale()
  const { date } = useDateFormat()
  const isDraft = campaign.status === 'draft'
  const preview = useCampaignPreview(isDraft ? campaign.id : null)
  const detail = useCampaignDetail(campaign.status === 'sent' ? campaign.id : null)
  const launch = useLaunchCampaign()
  const cancel = useCancelCampaign()
  const [confirming, setConfirming] = useState(false)
  const number = (value: number) => formatNumber(value, locale, 0)

  const stat = (key: string, value: number) => (
    <KpiCard key={key} label={key} value={number(value)} />
  )

  return (
    <div className="mt-3 space-y-3 border-t border-[hsl(var(--border-default))] pt-3">
      <p className="text-sm font-medium text-[hsl(var(--fg-primary))]">{campaign.subject}</p>
      <p className="whitespace-pre-wrap text-sm text-[hsl(var(--fg-secondary))]" dir="auto">
        {campaign.body}
      </p>

      {isDraft ? (
        preview.isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none" />
        ) : preview.error || !preview.data ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {errorText(preview.error)}
          </p>
        ) : (
          <>
            <KpiGrid>
              {stat(t('preview.total'), preview.data.total)}
              {stat(t('preview.sendable'), preview.data.sendable)}
              {stat(t('preview.noEmail'), preview.data.noEmail)}
              {stat(t('preview.invalidEmail'), preview.data.invalidEmail)}
              {stat(t('preview.optedOut'), preview.data.optedOut)}
            </KpiGrid>
            {preview.data.total === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('preview.nobody')}</p>
            ) : preview.data.tooLarge ? (
              <p className="text-sm text-[hsl(var(--color-destructive))]">
                {t('preview.tooLarge', { limit: number(preview.data.limit) })}
              </p>
            ) : preview.data.sendable === 0 ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">
                {t('preview.nobodyReachable')}
              </p>
            ) : !emailReady ? (
              <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('emailNotConfigured')}</p>
            ) : confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-[hsl(var(--fg-primary))]">
                  {t('launchConfirm', { count: number(preview.data.sendable) })}
                </span>
                <Button
                  size="sm"
                  disabled={launch.isPending}
                  onClick={() =>
                    launch.mutate(campaign.id, { onSettled: () => setConfirming(false) })
                  }
                >
                  {t('launchYes')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {t('cancel')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setConfirming(true)}>
                  {t('launch')}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(campaign.id)}
                >
                  {t('discard')}
                </Button>
              </div>
            )}
          </>
        )
      ) : null}

      {campaign.status === 'sent' ? (
        detail.isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-[hsl(var(--surface-muted))] motion-reduce:animate-none" />
        ) : detail.error || !detail.data ? (
          <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
            {errorText(detail.error)}
          </p>
        ) : (
          <>
            <KpiGrid>
              {stat(t('delivery.queued'), detail.data.delivery.queued)}
              {stat(t('delivery.sent'), detail.data.delivery.sent)}
              {stat(t('delivery.pending'), detail.data.delivery.pending)}
              {stat(t('delivery.failed'), detail.data.delivery.failed)}
            </KpiGrid>
            <p className="text-xs text-[hsl(var(--fg-tertiary))]">
              {t('delivery.skipped', {
                noEmail: number(
                  detail.data.delivery.skipped.noEmail + detail.data.delivery.skipped.invalidEmail,
                ),
                optedOut: number(detail.data.delivery.skipped.optedOut),
              })}
              {detail.data.delivery.unknown > 0
                ? ` · ${t('delivery.unknown', { count: number(detail.data.delivery.unknown) })}`
                : ''}
            </p>

            {detail.data.nps ? (
              <div className="space-y-2 rounded-xl border border-[hsl(var(--border-default))] p-3">
                <p className="text-sm font-semibold text-[hsl(var(--fg-primary))]">
                  {t('nps.title')}
                </p>
                {detail.data.nps.score === null ? (
                  // Nobody answered: there is no score, and zero would be a claim.
                  <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('nps.noAnswers')}</p>
                ) : (
                  <>
                    <KpiCard
                      label={t('nps.title')}
                      value={formatNumber(detail.data.nps.score, locale, 0)}
                      hint={t('nps.breakdown', {
                        promoters: number(detail.data.nps.counts.promoters),
                        passives: number(detail.data.nps.counts.passives),
                        detractors: number(detail.data.nps.counts.detractors),
                      })}
                    />
                  </>
                )}
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('nps.answered', {
                    respondents: number(detail.data.nps.counts.respondents),
                    population: number(detail.data.nps.population),
                  })}
                </p>
                {detail.data.nps.comments.length > 0 ? (
                  <ul className="space-y-1.5">
                    {detail.data.nps.comments.map((comment, index) => (
                      <li
                        key={index}
                        className="rounded-lg bg-[hsl(var(--surface-muted))] p-2 text-sm"
                      >
                        <span className="me-2 font-semibold tabular-nums" dir="ltr">
                          {number(comment.score)}
                        </span>
                        <span dir="auto">{comment.comment}</span>
                        <span className="ms-2 text-xs text-[hsl(var(--fg-tertiary))]">
                          {date(comment.answeredAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        )
      ) : null}

      {launch.error || cancel.error ? (
        <p role="alert" className="text-sm text-[hsl(var(--color-destructive))]">
          {errorText(launch.error ?? cancel.error)}
        </p>
      ) : null}
    </div>
  )
}
