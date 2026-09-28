'use client'

// ============================================
// packages/ui/src/components/ui/developers/storefront-panel.tsx
//
// Selling from your own website: the storefront settings, publishable keys
// and the snippet to paste. Props only.
//
// The defaults (G4) are the ones the owner agreed: a website order waits for
// a person, and the site shows «in stock / out of stock», not numbers.
// ============================================

import { memo, useEffect, useState } from 'react'
import type { StorefrontSettings } from '@hisabche/validation'
import type { PublishableKeyRow } from '@hisabche/api'
import { Copy, Store } from 'lucide-react'

import { Badge } from '../badge'
import { Button } from '../button'
import { Card, CardContent } from '../card'
import { Input } from '../input'
import { SelectField } from '../select-field'
import type { SectionState } from './developers-view'

export interface StorefrontPanelProps {
  t: (key: string, fallback?: string) => string
  state: SectionState
  settings: StorefrontSettings | null
  onSaveSettings: (settings: StorefrontSettings) => void
  savingSettings: boolean
  keys: PublishableKeyRow[]
  onCreateKey: (input: { name: string; allowedOrigins: string[] }) => void
  creatingKey: boolean
  onRevokeKey: (id: string) => void
  onCopy: (value: string) => void
  /** Where the SDK is served from (this site's origin + /sdk/v1.js). */
  sdkUrl: string
  /** The API origin the SDK talks to. */
  apiBase: string
  ordersHref: string
}

function snippet(sdkUrl: string, apiBase: string, key: string): string {
  return `<script src="${sdkUrl}"></script>
<script>
  const shop = Hisabche.init({ key: '${key}', apiBase: '${apiBase}' })
  // shop.catalog(), shop.createOrder({ items, customer }), shop.orderStatus(token)
  // <button data-hisabche-buy="PRODUCT_ID"></button> · <span data-hisabche-stock="PRODUCT_ID"></span>
  shop.mount()
</script>`
}

export const StorefrontPanel = memo(function StorefrontPanel(props: StorefrontPanelProps) {
  const { t } = props
  const [draft, setDraft] = useState<StorefrontSettings | null>(props.settings)
  const [name, setName] = useState('')
  const [origins, setOrigins] = useState('')

  // A fresh read replaces the draft only when nothing has been edited yet.
  useEffect(() => {
    setDraft((current) => current ?? props.settings)
  }, [props.settings])

  const originList = origins
    .split(/\s+/)
    .map((o) => o.trim())
    .filter(Boolean)
  const live = props.keys.filter((k) => !k.revoked_at)

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Store className="size-5 text-[hsl(var(--color-primary))]" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-[hsl(var(--fg-primary))]">
            {t('storefront.title')}
          </h2>
        </div>
        <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('storefront.help')}</p>

        {props.state === 'loading' && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.loading')}</p>
        )}
        {props.state === 'not-configured' && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('storefront.notConfigured')}</p>
        )}
        {props.state === 'forbidden' && (
          <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('developer.forbidden')}</p>
        )}
        {props.state === 'error' && (
          <p className="text-sm text-[hsl(var(--color-destructive))]">{t('developer.loadError')}</p>
        )}

        {props.state === 'ready' && draft && (
          <>
            <a
              href={props.ordersHref}
              className="text-sm text-[hsl(var(--color-primary))] underline-offset-4 hover:underline"
            >
              {t('storefront.openOrders')}
            </a>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('storefront.confirmation')}
                </span>
                <SelectField
                  name="orderConfirmation"
                  data-field="orderConfirmation"
                  value={draft.orderConfirmation}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      orderConfirmation: v as StorefrontSettings['orderConfirmation'],
                    })
                  }
                  options={[
                    { value: 'manual', label: t('storefront.confirmationManual') },
                    { value: 'automatic', label: t('storefront.confirmationAutomatic') },
                  ]}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('storefront.stockDisplay')}
                </span>
                <SelectField
                  name="stockDisplay"
                  data-field="stockDisplay"
                  value={draft.stockDisplay}
                  onChange={(v) =>
                    setDraft({ ...draft, stockDisplay: v as StorefrontSettings['stockDisplay'] })
                  }
                  options={[
                    { value: 'availability', label: t('storefront.stockAvailability') },
                    { value: 'quantity', label: t('storefront.stockQuantity') },
                  ]}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('storefront.expiryHours')}
                </span>
                <Input
                  name="pendingExpiryHours"
                  type="number"
                  min={1}
                  max={720}
                  value={draft.pendingExpiryHours}
                  onChange={(e) =>
                    setDraft({ ...draft, pendingExpiryHours: Number(e.target.value) })
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-[hsl(var(--fg-secondary))]">
                  {t('storefront.maxPending')}
                </span>
                <Input
                  name="maxPendingPerContact"
                  type="number"
                  min={1}
                  max={100}
                  value={draft.maxPendingPerContact}
                  onChange={(e) =>
                    setDraft({ ...draft, maxPendingPerContact: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <Button
              size="sm"
              loading={props.savingSettings}
              onClick={() => props.onSaveSettings(draft)}
            >
              {t('storefront.saveSettings')}
            </Button>

            <div className="space-y-2 border-t border-[hsl(var(--border-default))] pt-4">
              <h3 className="font-medium text-[hsl(var(--fg-primary))]">
                {t('storefront.keysTitle')}
              </h3>
              <p className="text-xs text-[hsl(var(--fg-tertiary))]">{t('storefront.keysHelp')}</p>
              {live.length === 0 ? (
                <p className="text-sm text-[hsl(var(--fg-secondary))]">{t('storefront.noKeys')}</p>
              ) : (
                <ul className="space-y-3">
                  {live.map((key) => (
                    <li
                      key={key.id}
                      className="space-y-2 rounded-xl bg-[hsl(var(--surface-muted))] p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{key.name}</span>
                        {key.allowed_origins.map((o) => (
                          <Badge key={o} variant="outline">
                            <span dir="ltr">{o}</span>
                          </Badge>
                        ))}
                      </div>
                      <pre
                        dir="ltr"
                        className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-[hsl(var(--surface-elevated))] p-2 text-xs"
                      >
                        {snippet(props.sdkUrl, props.apiBase, key.public_token)}
                      </pre>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            props.onCopy(snippet(props.sdkUrl, props.apiBase, key.public_token))
                          }
                        >
                          <Copy className="size-4" aria-hidden="true" />
                          {t('storefront.copySnippet')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => props.onRevokeKey(key.id)}
                        >
                          {t('developer.revoke')}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!name.trim() || originList.length === 0 || props.creatingKey) return
                  props.onCreateKey({ name: name.trim(), allowedOrigins: originList })
                  setName('')
                  setOrigins('')
                }}
              >
                <Input
                  name="name"
                  value={name}
                  maxLength={80}
                  placeholder={t('storefront.keyNamePlaceholder')}
                  aria-label={t('developer.keyName')}
                  onChange={(e) => setName(e.target.value)}
                />
                <textarea
                  name="allowedOrigins"
                  dir="ltr"
                  rows={2}
                  value={origins}
                  placeholder="https://myshop.com"
                  aria-label={t('storefront.origins')}
                  onChange={(e) => setOrigins(e.target.value)}
                  className="w-full rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] px-3 py-2 text-sm"
                />
                <p className="text-xs text-[hsl(var(--fg-tertiary))]">
                  {t('storefront.originsHelp')}
                </p>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!name.trim() || originList.length === 0}
                  loading={props.creatingKey}
                >
                  {t('storefront.createKey')}
                </Button>
              </form>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
})

StorefrontPanel.displayName = 'StorefrontPanel'
