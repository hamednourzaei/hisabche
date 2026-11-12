jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

import { PackRouteGate } from '../features/packs/pack-gate'

describe('PackRouteGate zero-request guard (V62 Slice 6 & 9)', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('issues zero React Query requests when pack is not installed', () => {
    const queryFn = jest.fn(async () => ({ items: [] }))

    function HeavyPackScreen() {
      useQuery({ queryKey: ['manufacturing', 'boms'], queryFn })
      return <div data-testid="heavy-screen">loaded</div>
    }

    const qc = new QueryClient()
    act(() => {
      root.render(
        <QueryClientProvider client={qc}>
          <PackRouteGate packId="manufacturing" installedPacks={['core']}>
            <HeavyPackScreen />
          </PackRouteGate>
        </QueryClientProvider>,
      )
    })

    expect(queryFn).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="heavy-screen"]')).toBeNull()
    expect(container.querySelector('[data-testid="pack-notice-not_installed"]')).not.toBeNull()
  })

  it('renders three distinct notices for not_installed, not_in_plan, and not_allowed', () => {
    act(() => {
      root.render(
        <PackRouteGate packId="operations" installedPacks={['core']}>
          <div>ok</div>
        </PackRouteGate>,
      )
    })
    expect(container.querySelector('[data-testid="pack-notice-not_installed"]')).not.toBeNull()

    act(() => {
      root.render(
        <PackRouteGate packId="operations" installedPacks={['core', 'operations']} inPlan={false}>
          <div>ok</div>
        </PackRouteGate>,
      )
    })
    expect(container.querySelector('[data-testid="pack-notice-not_in_plan"]')).not.toBeNull()

    act(() => {
      root.render(
        <PackRouteGate packId="operations" installedPacks={['core', 'operations']} allowed={false}>
          <div>ok</div>
        </PackRouteGate>,
      )
    })
    expect(container.querySelector('[data-testid="pack-notice-not_allowed"]')).not.toBeNull()
  })
})
