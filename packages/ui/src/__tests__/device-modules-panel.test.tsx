import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CompositionPlanSummary } from '../components/ui/onboarding/composition-plan-summary'
import { DeviceModulesPanel } from '../components/ui/settings/device-modules-panel'

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string) => (ns ? `${ns}.${key}` : key),
  useLocale: () => 'fa',
}))

afterEach(cleanup)

describe('DeviceModulesPanel', () => {
  it('renders installed, available, downloading, and failed pack states and fires actions', () => {
    const onInstall = vi.fn()
    const onRemove = vi.fn()
    const onRetry = vi.fn()

    const { rerender } = render(
      <DeviceModulesPanel
        installedPacks={['core', 'operations']}
        downloadingPacks={['manufacturing']}
        failedPacks={['workforce']}
        deliveryEnabled
        onInstall={onInstall}
        onRemove={onRemove}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByTestId('device-modules-panel')).toBeTruthy()

    const coreRow = screen
      .getByTestId('device-modules-panel')
      .querySelector('[data-pack-row="core"]')
    expect(coreRow?.querySelector('[data-pack-status="installed"]')).toBeTruthy()
    // Core cannot be removed
    expect(coreRow?.querySelector('button')).toBeNull()

    const opsRow = screen
      .getByTestId('device-modules-panel')
      .querySelector('[data-pack-row="operations"]')
    expect(opsRow?.querySelector('[data-pack-status="installed"]')).toBeTruthy()
    const removeBtn = opsRow?.querySelector('button')
    expect(removeBtn).toBeTruthy()
    if (removeBtn) fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledWith('operations')

    const mfgRow = screen
      .getByTestId('device-modules-panel')
      .querySelector('[data-pack-row="manufacturing"]')
    expect(mfgRow?.querySelector('[data-pack-status="downloading"]')).toBeTruthy()

    const workforceRow = screen
      .getByTestId('device-modules-panel')
      .querySelector('[data-pack-row="workforce"]')
    expect(workforceRow?.querySelector('[data-pack-status="failed"]')).toBeTruthy()
    const retryBtn = workforceRow?.querySelector('button')
    expect(retryBtn).toBeTruthy()
    if (retryBtn) fireEvent.click(retryBtn)
    expect(onRetry).toHaveBeenCalledWith('workforce')

    const approvalsRow = screen
      .getByTestId('device-modules-panel')
      .querySelector('[data-pack-row="approvals"]')
    expect(approvalsRow?.querySelector('[data-pack-status="available"]')).toBeTruthy()
    const installBtn = approvalsRow?.querySelector('button')
    expect(installBtn).toBeTruthy()
    if (installBtn) fireEvent.click(installBtn)
    expect(onInstall).toHaveBeenCalledWith('approvals')

    // When deliveryEnabled is false, no action buttons are shown
    rerender(
      <DeviceModulesPanel
        installedPacks={['core', 'operations']}
        deliveryEnabled={false}
        onInstall={onInstall}
        onRemove={onRemove}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByTestId('device-modules-panel').querySelectorAll('button').length).toBe(0)
  })
})

describe('CompositionPlanSummary with packs', () => {
  it('renders suggested packs with their budgets in KB', () => {
    const t = (key: string, fallback?: string) => fallback ?? key
    const answers = {
      holdsStock: 'yes' as const,
      producesGoods: 'yes' as const,
      hasStaff: 'yes' as const,
      locations: 'single' as const,
    }

    render(<CompositionPlanSummary answers={answers} businessType="manufacturing" t={t} />)

    const packTags = document.querySelectorAll('[data-composition-pack]')
    expect(packTags.length).toBeGreaterThan(0)
    // Every rendered pack should show its budget KB
    const textContent = Array.from(packTags).map((el) => el.textContent)
    expect(textContent.some((t) => t?.includes('KB'))).toBe(true)
  })
})
