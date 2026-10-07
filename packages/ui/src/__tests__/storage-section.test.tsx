import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { StorageSection } from '../components/ui/settings/settings-page'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const mockToastSuccess = vi.fn()
vi.mock('../components/ui/toast-provider', () => ({
  useToast: () => ({ success: mockToastSuccess, error: vi.fn() }),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('../hooks/use-intl-locale', () => ({
  useIntlLocale: () => 'fa-IR',
}))

describe('StorageSection Cache Clear Button', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
    // Mock navigator.storage
    const originalNavigator = global.navigator
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        storage: {
          estimate: vi
            .fn()
            .mockResolvedValue({ usage: 1024 * 1024 * 15, quota: 1024 * 1024 * 1024 * 10 }), // 15MB used
        },
      },
      writable: true,
    })
  })

  afterEach(() => {
    queryClient.clear()
  })

  it('clicking the clear cache button resets queries and shows success toast', async () => {
    // Add some dummy entries to query cache
    queryClient.setQueryData(['test1'], 'data1')
    queryClient.setQueryData(['test2'], 'data2')

    // Spy on resetQueries
    const resetSpy = vi.spyOn(queryClient, 'resetQueries')

    render(
      <QueryClientProvider client={queryClient}>
        <StorageSection />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText(/MB/)).toBeDefined()
    })

    // The text on the button is 'settings.clearCache' since we mock useTranslations to return the key
    const clearButton = screen.getByRole('button', { name: 'settings.clearCache' })
    fireEvent.click(clearButton)

    await waitFor(() => {
      expect(resetSpy).toHaveBeenCalled()
      expect(mockToastSuccess).toHaveBeenCalledWith('settings.cacheCleared')
    })
  })
})
