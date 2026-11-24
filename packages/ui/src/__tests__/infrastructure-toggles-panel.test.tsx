import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { DEFAULT_INFRASTRUCTURE_SETTINGS } from '@hisabche/validation'
import { InfrastructureTogglesPanel } from '../components/ui/settings/infrastructure-toggles-panel'

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
})

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => {
    return (key: string, values?: Record<string, unknown>) => {
      let str = ns ? `${ns}.${key}` : key
      if (values) {
        for (const [k, v] of Object.entries(values)) {
          str = str.replace(`{${k}}`, String(v))
        }
      }
      return str
    }
  },
  useLocale: () => 'fa',
}))

vi.mock('@hisabche/api', () => ({
  useInfrastructureSettings: () => ({
    data: DEFAULT_INFRASTRUCTURE_SETTINGS,
    isLoading: false,
    isError: false,
  }),
  useUpdateInfrastructureSettings: () => ({
    mutateAsync: vi.fn().mockResolvedValue(DEFAULT_INFRASTRUCTURE_SETTINGS),
    isPending: false,
  }),
}))

afterEach(cleanup)

describe('InfrastructureTogglesPanel Component', () => {
  it('renders all infrastructure switches and status badge', () => {
    render(<InfrastructureTogglesPanel initialSettings={DEFAULT_INFRASTRUCTURE_SETTINGS} />)

    expect(screen.getByTestId('infrastructure-toggles-panel')).toBeTruthy()
    expect(screen.getByTestId('toggle-nginx-proxy')).toBeTruthy()
    expect(screen.getByTestId('toggle-rate-limiting')).toBeTruthy()
    expect(screen.getByTestId('toggle-cache-bypass')).toBeTruthy()
    expect(screen.getByTestId('toggle-maintenance-mode')).toBeTruthy()
    expect(screen.getByTestId('toggle-ws-compression')).toBeTruthy()
    expect(screen.getByTestId('toggle-upstream-health')).toBeTruthy()
    expect(screen.getByTestId('toggle-hsts')).toBeTruthy()
  })

  it('reveals rate limit RPS and burst inputs when rate limiting is enabled', () => {
    render(<InfrastructureTogglesPanel initialSettings={DEFAULT_INFRASTRUCTURE_SETTINGS} />)

    const rpsInput = screen.getByTestId('input-rate-limit-rps') as HTMLInputElement
    const burstInput = screen.getByTestId('input-rate-limit-burst') as HTMLInputElement

    expect(rpsInput.value).toBe('100')
    expect(burstInput.value).toBe('50')
  })

  it('reveals maintenance notice input when emergency maintenance mode is toggled', () => {
    render(
      <InfrastructureTogglesPanel
        initialSettings={{
          ...DEFAULT_INFRASTRUCTURE_SETTINGS,
          maintenanceMode: true,
          maintenanceNotice: 'Emergency maintenance window',
        }}
      />,
    )

    const noticeInput = screen.getByTestId('input-maintenance-notice') as HTMLInputElement
    expect(noticeInput).toBeTruthy()
    expect(noticeInput.value).toBe('Emergency maintenance window')
  })

  it('calls onSave with updated payload when form is submitted', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <InfrastructureTogglesPanel
        initialSettings={DEFAULT_INFRASTRUCTURE_SETTINGS}
        onSave={onSave}
      />,
    )

    const rpsInput = screen.getByTestId('input-rate-limit-rps')
    fireEvent.change(rpsInput, { target: { value: '250' } })

    const saveBtn = screen.getByTestId('btn-save-infrastructure')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          nginxProxyEnabled: true,
          rateLimitRps: 250,
          rateLimitingEnabled: true,
        }),
      )
    })
  })

  it('all required translation keys exist in fa, af, and en common.json', () => {
    const locales = ['fa', 'af', 'en']
    const keys = [
      'title',
      'subtitle',
      'nginxProxy',
      'nginxProxyDesc',
      'rateLimiting',
      'rateLimitingDesc',
      'rateLimitRps',
      'rateLimitBurst',
      'cacheBypass',
      'cacheBypassDesc',
      'maintenance',
      'maintenanceDesc',
      'maintenanceNotice',
      'wsCompression',
      'wsCompressionDesc',
      'upstreamHealth',
      'upstreamHealthDesc',
      'hsts',
      'hstsDesc',
      'enabled',
      'disabled',
      'saveChanges',
      'saved',
      'saveError',
      'updatedAt',
      'updatedBy',
    ]

    for (const locale of locales) {
      const filePath = join(__dirname, '..', '..', '..', 'i18n', 'messages', locale, 'common.json')
      const json = JSON.parse(readFileSync(filePath, 'utf8'))
      const infra = json.admin?.infrastructure

      expect(infra, `admin.infrastructure missing in ${locale}`).toBeDefined()
      for (const k of keys) {
        expect(
          infra[k],
          `Missing translation key admin.infrastructure.${k} in ${locale}`,
        ).toBeTruthy()
      }
    }
  })
})
