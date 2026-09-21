// ============================================
// Root layout — the native host, and nothing else.
//
// ⚠️ THE SCREENS ARE GONE ON PURPOSE.
//
// This app used to draw its own React Native version of every page. That was
// the third UI: the same product, a third time, drifting from web and desktop
// with every change. The UI now comes from `@hisabche/app-shell` — the exact
// bundle Electron loads — and this file starts only what a browser engine
// cannot do for itself:
//
//   • the offline outbox and its sync runner, which must outlive the WebView
//   • the persisted session, so the bridge can answer `secure.get` at once
//   • push registration, which is an OS-level grant
//
// Fonts, language, direction, routing and theming all belong to the shared UI
// and are NOT repeated here — `styles.css` in the shell ships Vazirmatn with
// the bundle.
// ============================================

import React, { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { SplashScreen } from 'expo-router'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { initStorage } from '../src/shared/lib/storage'
import { useAuthStore } from '../src/features/auth/auth.store'
import { ShellWebView } from '../src/host/shell-webview'
import { initLocalDb } from '../src/host/local-db'
import { migrateLegacyOutbox } from '../src/host/migrate-legacy-outbox'

void SplashScreen.preventAutoHideAsync()

function useHostBootstrap(): boolean {
  const [ready, setReady] = useState(false)
  const hydrateAuth = useAuthStore((s) => s.hydrate)

  useEffect(() => {
    let cancelled = false

    async function bootstrap(): Promise<void> {
      // ⚠️ Storage first: the bridge answers `secure.get` from it, and the
      // shared UI asks during its own start-up. A bridge that answers null
      // because storage was not open yet reads as «signed out» (BUG-019).
      await initStorage()

      // ⚠️ THE CACHE OPENS BEFORE THE WEBVIEW DOES.
      //
      // The shared UI asks `db.query` while its first screen mounts. A cache
      // that opens a moment later answers that first call with
      // LOCAL_CACHE_UNAVAILABLE, and the page has already decided it has
      // nothing to show — the same ordering mistake as announcing token
      // readiness before the token exists (BUG-019).
      const cacheOpened = await initLocalDb()

      // Anything the previous build left in the AsyncStorage queue is moved
      // into SQLite now, before the first drain can run — otherwise those
      // invoices are queued in a store nothing reads any more.
      if (cacheOpened) {
        const moved = await migrateLegacyOutbox()
        if (moved.moved > 0) {
          console.warn(`[outbox] migrated ${moved.moved} queued writes into the local cache`)
        }
      }

      await hydrateAuth()
      if (!cancelled) setReady(true)
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [hydrateAuth])

  return ready
}

export default function RootLayout(): React.JSX.Element | null {
  const ready = useHostBootstrap()

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync()
  }, [ready])

  if (!ready) return null

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ShellWebView />
    </SafeAreaProvider>
  )
}
