// ============================================
// TanStack Query provider tuned for mobile networks
// ============================================

import React, { useEffect, useState, type ReactNode } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { QueryClient, QueryClientProvider, focusManager, onlineManager } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2,
        gcTime: 1000 * 60 * 30,
        retry: 2,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: { retry: 0 },
    },
  })
}

// Query focus follows app foreground/background, not browser window focus.
function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active')
}

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected)))
)

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createQueryClient)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', onAppStateChange)
    return () => subscription.remove()
  }, [])

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
