'use client'

// ============================================
// apps/admin/app/[lang]/(admin)/revenue/gateways/gateway-config.tsx
//
// V63 audit (12 Nov 2026) — where the owner enters what a gateway needs:
//   · PUBLIC settings: the PayPal address (live PayPal takes money by manual
//     transfer to it), bank details, Stripe's publishable key, a display name;
//   · SECRETS: write-only. A value is typed once, sent once, staged in Vault,
//     and applied only when a DIFFERENT admin approves the request. The screen
//     never receives a value back — only `last4` and whether one is waiting.
//
// Before this, the panel pointed at a «Security → Secrets» tab that did not
// exist and nothing called the metadata route, so no gateway could be enabled.
//
// ⚠️ The secret input is `type="password"` with `autoComplete="new-password"`
// and is cleared the moment it is sent; it never enters the address, a query
// key or storage.
// ============================================

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from '@/components/ui'
import { ErrorState } from '@/components/admin-shell/admin-ui'
import { StepUpDialog } from '@/components/admin-shell/step-up-dialog'
import {
  useAdminSecrets,
  useStageSecret,
  useUpdateGatewayMetadata,
  type PlatformGatewayItem,
} from '@/hooks/use-admin-gateways'

/** The public fields each provider's flow reads (manual.adapter, stripe.adapter). */
export const PUBLIC_FIELDS: Record<PlatformGatewayItem['provider'], readonly string[]> = {
  PAYPAL: ['paypal_email', 'bank_details'],
  STRIPE: ['publishable_key'],
  LOCAL: [],
}

type Pending = { kind: 'metadata' } | { kind: 'secret'; name: string; value: string } | null

/** Refusals the server names with a code; anything else is the general sentence. */
export const GATEWAY_CONFIG_ERRORS = [
  'GATEWAY_CONFIG_KEY_IS_SECRET',
  'GATEWAY_CONFIG_VALUE_INVALID',
  'GATEWAY_PAYPAL_EMAIL_INVALID',
] as const

function refusalCode(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown } } })?.response?.data
  const text = typeof data?.error === 'string' ? data.error : ''
  return GATEWAY_CONFIG_ERRORS.find((code) => text.includes(code)) ?? null
}

export function GatewayConfig({
  gateway,
  onClose,
}: {
  gateway: PlatformGatewayItem
  onClose: () => void
}) {
  const t = useTranslations()
  const secrets = useAdminSecrets()
  const { mutateAsync: updateMetadata } = useUpdateGatewayMetadata()
  const { mutateAsync: stageSecret } = useStageSecret()

  const fields = PUBLIC_FIELDS[gateway.provider]
  const [displayName, setDisplayName] = useState(gateway.displayName)
  const [config, setConfig] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => {
        const value = gateway.publicConfig[field]
        return [field, typeof value === 'string' ? value : '']
      }),
    ),
  )
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Pending>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  const metadataOf = (name: string) => (secrets.data?.secrets ?? []).find((s) => s.name === name)

  const confirm = async ({ stepUpTimestamp }: { stepUpTimestamp: string; reason?: string }) => {
    if (!pending) return
    setFailure(null)
    try {
      if (pending.kind === 'metadata') {
        // Empty fields are left out: «not set» is not an empty string.
        const publicConfig = Object.fromEntries(
          Object.entries(config)
            .map(([key, value]) => [key, value.trim()] as const)
            .filter(([, value]) => value !== ''),
        )
        await updateMetadata({
          id: gateway.id,
          displayName: displayName.trim() || gateway.displayName,
          publicConfig,
          stepUpTimestamp,
        })
        setMessage(t('admin.gateways.config.saved'))
      } else {
        const result = await stageSecret({
          name: pending.name,
          value: pending.value,
          purpose: `${gateway.provider} ${gateway.environment}`,
          stepUpTimestamp,
        })
        setSecretDrafts((all) => ({ ...all, [pending.name]: '' }))
        setMessage(t('admin.gateways.config.secretStaged', { id: result.requestId }))
      }
    } catch (error) {
      const code = refusalCode(error)
      setFailure(
        code ? t(`admin.gateways.config.errors.${code}`) : t('admin.gateways.config.failed'),
      )
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader className="text-start">
        <CardTitle>
          {t('admin.gateways.config.title')} — {gateway.displayName}
        </CardTitle>
        <CardDescription>
          {gateway.provider === 'PAYPAL' && gateway.environment === 'LIVE'
            ? t('admin.gateways.config.paypalManualHint')
            : t('admin.gateways.config.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {message && (
          <p role="status" className="rounded-xl border border-border p-3 text-sm text-foreground">
            {message}
          </p>
        )}
        {failure && (
          <p
            role="alert"
            className="rounded-xl border border-destructive p-3 text-sm text-destructive"
          >
            {failure}
          </p>
        )}

        {/* ── Public settings ───────────────────────────────────────── */}
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('admin.gateways.config.publicTitle')}
          </h3>
          <div className="space-y-1">
            <Label htmlFor="gateway-display-name">{t('admin.gateways.config.displayName')}</Label>
            <Input
              id="gateway-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          {fields.map((field) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={`gateway-${field}`}>
                {t(`admin.gateways.config.fields.${field}`)}
              </Label>
              {field === 'bank_details' ? (
                <Textarea
                  id={`gateway-${field}`}
                  rows={3}
                  value={config[field] ?? ''}
                  onChange={(event) =>
                    setConfig((all) => ({ ...all, [field]: event.target.value }))
                  }
                />
              ) : (
                <Input
                  id={`gateway-${field}`}
                  dir="ltr"
                  type={field === 'paypal_email' ? 'email' : 'text'}
                  autoComplete="off"
                  value={config[field] ?? ''}
                  onChange={(event) =>
                    setConfig((all) => ({ ...all, [field]: event.target.value }))
                  }
                />
              )}
            </div>
          ))}
          {gateway.provider === 'LOCAL' && (
            <p className="text-sm text-muted-foreground">
              {t('admin.gateways.config.localPending')}
            </p>
          )}
          <Button size="sm" onClick={() => setPending({ kind: 'metadata' })}>
            {t('admin.gateways.config.savePublic')}
          </Button>
        </section>

        {/* ── Secrets (write-only) ──────────────────────────────────── */}
        {gateway.secretNames.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t('admin.gateways.config.secretsTitle')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('admin.gateways.config.secretsHint')}
            </p>
            {secrets.isError ? (
              <ErrorState
                message={t('admin.gateways.config.secretsError')}
                onRetry={() => void secrets.refetch()}
              />
            ) : (
              gateway.secretNames.map((name) => {
                const meta = metadataOf(name)
                const draft = secretDrafts[name] ?? ''
                return (
                  <div key={name} className="space-y-1 rounded-xl border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code dir="ltr" className="text-xs">
                        {name}
                      </code>
                      {meta?.pendingLast4 ? (
                        <Badge variant="outline">
                          {t('admin.gateways.config.pending', { last4: meta.pendingLast4 })}
                        </Badge>
                      ) : meta?.last4 ? (
                        <Badge>{t('admin.gateways.config.stored', { last4: meta.last4 })}</Badge>
                      ) : (
                        <Badge variant="destructive">{t('admin.gateways.config.notStored')}</Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <Input
                        aria-label={name}
                        dir="ltr"
                        type="password"
                        autoComplete="new-password"
                        spellCheck={false}
                        className="min-w-[16rem] flex-1"
                        value={draft}
                        onChange={(event) =>
                          setSecretDrafts((all) => ({ ...all, [name]: event.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={draft.trim().length < 8}
                        onClick={() => setPending({ kind: 'secret', name, value: draft.trim() })}
                      >
                        {meta?.last4
                          ? t('admin.gateways.config.replace')
                          : t('admin.gateways.config.stage')}
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </section>
        )}

        <Button variant="outline" size="sm" onClick={onClose}>
          {t('admin.gateways.config.close')}
        </Button>
      </CardContent>

      <StepUpDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === 'secret'
            ? t('admin.gateways.config.stageConfirmTitle')
            : t('admin.gateways.config.saveConfirmTitle')
        }
        description={
          pending?.kind === 'secret'
            ? t('admin.gateways.config.stageConfirmDesc')
            : t('admin.gateways.config.saveConfirmDesc')
        }
        confirmLabel={t('admin.gateways.confirm')}
        onConfirm={confirm}
      />
    </Card>
  )
}
