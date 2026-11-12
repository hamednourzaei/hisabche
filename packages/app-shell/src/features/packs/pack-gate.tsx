// ============================================
// packages/app-shell/src/features/packs/pack-gate.tsx
//
// V62 Slice 6 (§4.7) & Slice 9 (§4.5) — Pack route gate.
//
// Unmounted packs make ZERO React Query / API requests (extending the
// `look.active` pattern). Also keeps the three states strictly separate:
//   1. not_installed (device has not downloaded/enabled the pack)
//   2. not_in_plan   (workspace plan does not include the capability)
//   3. not_allowed   (user role lacks permission)
// ============================================

import React from 'react'
import { useTranslations } from 'next-intl'
import { PACK_IDS, type PackId } from '@hisabche/validation'
import { readStorage, writeStorage } from '@hisabche/api'

export const PACK_DELIVERY_FLAG_KEY = 'hisabche:packs.delivery'
export const INSTALLED_PACKS_STORAGE_KEY = 'hisabche:installed-packs'

export type PackDeliveryFlag = 'off' | 'on'

export function getPackDeliveryFlag(): PackDeliveryFlag {
  try {
    return readStorage(PACK_DELIVERY_FLAG_KEY) === 'on' ? 'on' : 'off'
  } catch {
    return 'off'
  }
}

export function getInstalledPacks(): readonly PackId[] {
  if (getPackDeliveryFlag() === 'off') {
    return PACK_IDS
  }
  try {
    const raw = readStorage(INSTALLED_PACKS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as unknown
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((x): x is PackId =>
          (PACK_IDS as readonly string[]).includes(String(x)),
        )
        return valid.includes('core') ? valid : ['core', ...valid]
      }
    }
  } catch {
    // fallback to core
  }
  return ['core']
}

export function setInstalledPacks(packs: readonly PackId[]): void {
  const unique = Array.from(new Set<PackId>(['core', ...packs]))
  try {
    writeStorage(INSTALLED_PACKS_STORAGE_KEY, JSON.stringify(unique))
  } catch {
    // ignore
  }
}

export type PackAccessState = 'ready' | 'not_installed' | 'not_in_plan' | 'not_allowed'

export function resolvePackAccessState(input: {
  packId: PackId
  installedPacks: readonly PackId[]
  inPlan?: boolean
  allowed?: boolean
}): PackAccessState {
  if (input.allowed === false) return 'not_allowed'
  if (input.inPlan === false) return 'not_in_plan'
  if (input.packId !== 'core' && !input.installedPacks.includes(input.packId)) {
    return 'not_installed'
  }
  return 'ready'
}

export function PackRouteNotice({
  state,
  packId,
  onInstall,
}: {
  state: Exclude<PackAccessState, 'ready'>
  packId: PackId
  onInstall?: (() => void) | undefined
}) {
  const t = useTranslations('packs')

  const titleKey =
    state === 'not_installed'
      ? 'notices.notInstalledTitle'
      : state === 'not_in_plan'
        ? 'notices.notInPlanTitle'
        : 'notices.notAllowedTitle'

  const bodyKey =
    state === 'not_installed'
      ? 'notices.notInstalledBody'
      : state === 'not_in_plan'
        ? 'notices.notInPlanBody'
        : 'notices.notAllowedBody'

  return (
    <div
      data-testid={`pack-notice-${state}`}
      data-pack-id={packId}
      className="mx-auto my-12 max-w-md rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-elevated))] p-6 text-center"
    >
      <h2 className="text-base font-semibold text-[hsl(var(--fg-primary))]">{t(titleKey)}</h2>
      <p className="mt-2 text-sm text-[hsl(var(--fg-secondary))]">{t(bodyKey)}</p>
      {state === 'not_installed' && onInstall ? (
        <button
          type="button"
          onClick={onInstall}
          className="mt-4 rounded-lg bg-[hsl(var(--color-primary))] px-4 py-2 text-sm font-medium text-[hsl(var(--color-primary-fg))]"
        >
          {t('actions.install')}
        </button>
      ) : null}
    </div>
  )
}

export function PackRouteGate({
  packId,
  installedPacks,
  inPlan = true,
  allowed = true,
  onInstall,
  children,
}: {
  packId: PackId
  installedPacks?: readonly PackId[] | undefined
  inPlan?: boolean | undefined
  allowed?: boolean | undefined
  onInstall?: (() => void) | undefined
  children: React.ReactNode
}) {
  const effectiveInstalled = installedPacks ?? getInstalledPacks()
  const state = resolvePackAccessState({
    packId,
    installedPacks: effectiveInstalled,
    inPlan,
    allowed,
  })
  if (state !== 'ready') {
    return <PackRouteNotice state={state} packId={packId} onInstall={onInstall} />
  }
  return <>{children}</>
}
