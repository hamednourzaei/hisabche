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
import { ActivityIndicator, BackHandler, Platform, StyleSheet, View } from 'react-native'
import { Asset } from 'expo-asset'
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

  const source = Asset.fromModule(SHELL_HTML)

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: source.uri }}
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
  },
})
