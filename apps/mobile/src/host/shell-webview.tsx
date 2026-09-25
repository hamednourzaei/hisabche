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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import NetInfo from '@react-native-community/netinfo'
import { rpcRequestSchema, webViewBridgeSource } from '@hisabche/app-bridge'

import { handleBridgeCall } from './native-bridge'
import { useHostServices } from './use-host-services'

import SHELL_HTML from '../../assets/shell/index.html'

const HOST_MARKER = "document.documentElement.setAttribute('data-host', 'mobile');"

export function ShellWebView(): React.JSX.Element {
  const webViewRef = useRef<WebView>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [ready, setReady] = useState(false)
  const insets = useSafeAreaInsets()

  // ⚠️ A push, not an answer: the page never asked. The queue finished on its
  // own, possibly while a different screen was open, and the UI has to hear
  // about it to refetch. `app.onUpdateStatus` rides the same channel.
  const pushEvent = useCallback((event: string, payload: unknown) => {
    const message = JSON.stringify(JSON.stringify({ event, payload }))
    webViewRef.current?.injectJavaScript(`window.__hisabcheReceive(${message}); true;`)
  }, [])

  const onOutboxDrained = useCallback(() => pushEvent('outboxDrained', null), [pushEvent])
  useHostServices({ onOutboxDrained })

  // ⚠️ THE PAGE NEVER HEARD THE CONNECTION CHANGE.
  //
  // Android's WebView updates `navigator.onLine` and fires `online` /
  // `offline` only when the app calls `setNetworkAvailable`, and
  // react-native-webview does not. So the header said "online" with the
  // network off, and the shell's sync-on-reconnect never fired. The host
  // hears it from the OS and re-announces it as the standard events the shell
  // already listens for — on every change, and once more after each load.
  const isConnected = useRef<boolean | null>(null)
  const announceConnection = useCallback(() => {
    if (isConnected.current === null) return
    const event = isConnected.current ? 'online' : 'offline'
    webViewRef.current?.injectJavaScript(
      `window.__hisabcheOnline = ${isConnected.current}; window.dispatchEvent(new Event('${event}')); true;`,
    )
  }, [])
  React.useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        const next = state.isConnected !== false
        if (next === isConnected.current) return
        isConnected.current = next
        announceConnection()
      }),
    [announceConnection],
  )

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

          // ⚠️ CHECKED, NOT ASSUMED. A build whose `build:shell` step did not
          // run ships an app with no UI in it, and pointing the WebView at a
          // file that is not there produces a blank screen with no reason on
          // it (راهنمای سشن §۷٫۶).
          //
          // ⚠️ But NOT through the `file://` form. expo-file-system answers a
          // `file://` URI with `java.io.File.exists()`, and `android_asset` is
          // not a directory on disk — it lives inside the APK. That check said
          // "missing" for EVERY build, including ones that carried the shell,
          // and the release APK opened on SHELL_MISSING_FROM_APK with the file
          // sitting in `assets/shell/`. The `asset:///` scheme is the one it
          // routes through Android's AssetManager.
          const info = await FileSystem.getInfoAsync('asset:///shell/index.html')
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

  // ⚠️ THE WEBVIEW DREW UNDER THE STATUS BAR. The status bar is translucent,
  // so the header's logo sat on the clock and the wifi icon. The page cannot
  // fix this reliably from CSS — Android's WebView does not report
  // `env(safe-area-inset-*)` without `viewport-fit=cover`, and not on every
  // version even then — so the host keeps the page out of both system bars.
  // The strip left behind is `container`'s dark background, which the
  // light status-bar icons stay readable on in either theme.
  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <WebView
        ref={webViewRef}
        webviewDebuggingEnabled // TEMP-DEBUG: remove before final build
        // ⚠️ Android's default (`true`) turns on the WebView's overview mode,
        // which zooms OUT to fit anything momentarily wider than the phone —
        // and stays zoomed out. The bottom menu slid off-screen on accounting.
        // The page's own viewport meta decides instead.
        scalesPageToFit={false}
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
        // `data-host` first, so the shell's CSS can drop the effects this
        // WebView draws badly (see "Android WebView" in app-shell styles.css)
        // before the first paint rather than after it.
        injectedJavaScriptBeforeContentLoaded={`${HOST_MARKER}${webViewBridgeSource()}`}
        onMessage={onMessage}
        onLoadEnd={() => {
          setReady(true)
          announceConnection()
        }}
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
