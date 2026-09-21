// ============================================
// The mobile host: one WebView carrying the shared UI.
//
// ⚠️ THE UI IS BUNDLED, NOT FETCHED.
//
// `assets/shell` is built from `@hisabche/app-shell` — the same source
// Electron builds — and ships inside the APK. A WebView pointed at
// hisabche.com would be a browser with an app icon: nothing at all without a
// connection, and the offline outbox would have no screen to appear on.
// ============================================

import React, { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { rpcRequestSchema, webViewBridgeSource } from '@hisabche/app-bridge'

import { handleBridgeCall } from './native-bridge'
import { useHostServices } from './use-host-services'

import SHELL_HTML from '../../assets/shell/index.html'

export function ShellWebView(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [ready, setReady] = useState(false)

  // ⚠️ A push, not an answer: the page never asked. The queue finished on its
  // own, possibly while a different screen was open, and the UI has to hear
  // about it to refetch. `app.onUpdateStatus` rides the same channel.
  const pushEvent = useCallback((event: string, payload: unknown) => {
    const message = JSON.stringify(JSON.stringify({ event, payload }))
    webViewRef.current?.injectJavaScript(`window.__hisabcheReceive(${message}); true;`)
  }, [])

  const onOutboxDrained = useCallback(() => pushEvent('outboxDrained', null), [pushEvent])
  useHostServices({ onOutboxDrained })

  // ⚠️ Android's hardware back button must move the UI back a route, not close
  // the app. Without this the first back press quits from any screen, which
  // reads as a crash.
  React.useEffect(() => {
    if (Platform.OS !== 'android') return undefined
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false
      webViewRef.current?.goBack()
      return true
    })
    return () => subscription.remove()
  }, [canGoBack])

  const onMessage = useCallback(async (event: WebViewMessageEvent) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }

    const request = rpcRequestSchema.safeParse(parsed)
    if (!request.success) return

    const response = await handleBridgeCall(request.data)
    // Back into the page, to the id that is waiting for it.
    webViewRef.current?.injectJavaScript(
      `window.__hisabcheReceive(${JSON.stringify(JSON.stringify(response))}); true;`,
    )
  }, [])

  // ⚠️ A REAL PATH WITH A REAL EXTENSION, NOT AN ASSET REGISTRY ENTRY.
  //
  // `expo-asset` packs bundled files into the APK under a HASHED NAME WITH NO
  // EXTENSION. A WebView handed such a file has nothing to infer a MIME type
  // from, falls back to `text/plain`, and renders the app's minified
  // JavaScript as visible text — a screen full of source code, which is what
  // the emulator showed.
  //
  // `android/app/src/main/assets/shell/index.html` is served by Android itself
  // at `file:///android_asset/shell/index.html`: a path the WebView reads
  // natively, with the extension intact, with no runtime copy and no network.
  // The Vite config writes the build there directly.
  const [shellUri, setShellUri] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function resolve(): Promise<void> {
      try {
        if (Platform.OS === 'android') {
          const uri = 'file:///android_asset/shell/index.html'
          const info = await FileSystem.getInfoAsync(uri)

          // ⚠️ CHECKED, NOT ASSUMED. A build whose `build:shell` step did not
          // run ships an app with no UI in it, and pointing the WebView at a
          // file that is not there produces a blank screen with no reason on
          // it (راهنمای سشن §۷٫۶).
          if (!info.exists) {
            setFailure('SHELL_MISSING_FROM_APK')
            return
          }

          if (!cancelled) setShellUri(uri)
          return
        }

        // iOS has no `android_asset`. The file travels through the asset
        // registry there and is copied once to a path ending `.html`, for the
        // same MIME reason.
        const asset = Asset.fromModule(SHELL_HTML)
        if (!asset.localUri) await asset.downloadAsync()
        const packaged = asset.localUri ?? asset.uri
        if (cancelled) return

        if (!packaged || packaged.startsWith('http:')) {
          setFailure('SHELL_ASSET_NOT_LOCAL')
          return
        }

        const target = `${FileSystem.cacheDirectory}shell-${asset.hash ?? 'v1'}.html`
        const existing = await FileSystem.getInfoAsync(target)
        if (!existing.exists) {
          await FileSystem.copyAsync({ from: packaged, to: target })
        }
        if (cancelled) return

        setShellUri(target)
      } catch (error) {
        if (!cancelled) {
          setFailure(error instanceof Error ? error.message : String(error))
        }
      }
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [])

  // ⚠️ A BLANK SCREEN MUST SAY WHY.
  //
  // Whatever goes wrong here, the person is left looking at nothing — and
  // «still loading», «the UI could not be unpacked» and «this build shipped no
  // UI» all render identically unless one of them is written down
  // (راهنمای سشن §۷٫۶). The text is Persian because this screen appears
  // before the shared UI — and its translations — exist.
  if (failure) {
    return (
      <View style={[styles.container, styles.loading]}>
        <Text style={styles.failureTitle}>برنامه باز نشد</Text>
        <Text style={styles.failureBody}>
          فایل‌های برنامه روی این دستگاه باز نشدند. برنامه را ببندید و دوباره باز کنید؛ اگر باز هم
          تکرار شد، نصب دوباره لازم است.
        </Text>
        <Text style={styles.failureCode}>{failure}</Text>
      </View>
    )
  }

  // Nothing to show until the file exists on disk. Rendering a WebView with an
  // empty source first makes it load `about:blank` and fire `onLoadEnd`, which
  // would hide the spinner over a blank page.
  if (!shellUri) {
    return (
      <View style={[styles.container, styles.loading]}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: shellUri }}
        // The bundle lives beside index.html on the filesystem; without these
        // the page loads and every one of its own scripts 404s.
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        originWhitelist={['*']}
        // ⚠️ BEFORE the content loads. The shared UI decides whether it has a
        // host while its own modules initialise; a bridge installed after
        // first paint is a bridge it has already concluded is absent.
        injectedJavaScriptBeforeContentLoaded={webViewBridgeSource()}
        onMessage={onMessage}
        onLoadEnd={() => setReady(true)}
        // Without this the WebView shows its own English error page — the
        // `ERR_CLEARTEXT_NOT_PERMITTED` screen a person cannot act on.
        onError={(event) => setFailure(event.nativeEvent.description)}
        onHttpError={(event) => setFailure(`HTTP ${event.nativeEvent.statusCode}`)}
        renderError={() => (
          <View style={[styles.container, styles.loading]}>
            <Text style={styles.failureTitle}>برنامه باز نشد</Text>
          </View>
        )}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        // A WebView that scales text on its own fights the shared UI's own
        // responsive type scale.
        textZoom={100}
        style={styles.webview}
      />
      {!ready ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="large" />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0F14' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  failureTitle: {
    color: '#E6EDF3',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  failureBody: {
    color: '#9FB0C0',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 12,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  // Not for the person — for whoever they show the screen to.
  failureCode: { color: '#5C6B7A', fontSize: 11, marginTop: 20 },
})
