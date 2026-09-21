// ============================================
// What the host does that a browser engine cannot.
//
// ⚠️ THESE OUTLIVE THE WEBVIEW ON PURPOSE.
//
// Android reclaims a backgrounded WebView whenever it wants. Anything the
// business depends on surviving that — the queue of invoices written offline,
// the push token this device is registered under — has to run out here, in
// the native app, not inside the page.
//
// Everything else (routing, theming, language, data fetching) belongs to the
// shared UI and is deliberately absent.
// ============================================

import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

import { onSynced, runSync } from '../features/offline/sync-runner'
import { usePushRegistration } from '../features/notifications/use-push-registration'
import { useAuthStore } from '../features/auth/auth.store'

export interface HostServiceOptions {
  /**
   * Told when the outbox actually pushed something, so the page can refetch.
   *
   * ⚠️ The runner cannot invalidate a query cache itself any more: the cache
   * lives in a page that may have been destroyed since the drain started.
   */
  onOutboxDrained: () => void
}

export function useHostServices({ onOutboxDrained }: HostServiceOptions): void {
  // An OS-level grant and an OS-level token — neither is available to a page.
  //
  // ⚠️ Only once somebody is signed in. The token is registered AGAINST AN
  // ACCOUNT; asking for it earlier spends the one permission prompt Android
  // gives on a device that has nobody to notify.
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  usePushRegistration(isAuthenticated)

  useEffect(() => onSynced(onOutboxDrained), [onOutboxDrained])

  useEffect(() => {
    // Drain once at start: the app may have been killed mid-queue.
    void runSync()

    // ⚠️ Connectivity RETURNING is the trigger, not every event. NetInfo fires
    // on each transition, and draining on «still offline» would burn the five
    // attempts an entry gets before it is parked as failed.
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void runSync()
    })

    // Coming back to the foreground is the other moment worth retrying: the
    // phone may have regained signal while the app was away and NetInfo does
    // not always report that to a sleeping process.
    const onAppState = (status: AppStateStatus): void => {
      if (status === 'active') void runSync()
    }
    const appStateSubscription = AppState.addEventListener('change', onAppState)

    return () => {
      unsubscribeNet()
      appStateSubscription.remove()
    }
  }, [])
}
