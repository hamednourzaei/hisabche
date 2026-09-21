// ============================================
// The page half of the WebView bridge, as a string of JavaScript.
//
// ⚠️ IT IS A STRING ON PURPOSE.
//
// This code does not run in the app that imports it — it is handed to
// `react-native-webview` as `injectedJavaScriptBeforeContentLoaded` and runs
// inside the page, before the UI's own bundle. It therefore cannot import
// anything, cannot use TypeScript, and must not assume a bundler touched it.
//
// It builds the SAME object Electron's preload exposes, so the shared UI sees
// one shape and never learns which host answered.
// ============================================

import { BRIDGE_GLOBAL, WEBVIEW_METHODS } from './webview-rpc'

/**
 * @param appInfo values the host knows at startup and the UI asks for
 *   synchronously often enough that a round trip would show as a flash of
 *   empty state.
 */
export function webViewBridgeSource(): string {
  const methods = JSON.stringify(WEBVIEW_METHODS)

  return `(function () {
  if (window.${BRIDGE_GLOBAL}) { return }

  var pending = {}
  var seq = 0
  var listeners = {}

  function post(method, args) {
    return new Promise(function (resolve, reject) {
      var id = String(++seq)
      pending[id] = { resolve: resolve, reject: reject }
      try {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ id: id, method: method, args: Array.prototype.slice.call(args) })
        )
      } catch (e) {
        delete pending[id]
        reject(e)
      }
    })
  }

  // The host answers here. One response per request, always — a failure is a
  // rejected promise, never a promise left hanging.
  window.__hisabcheReceive = function (raw) {
    var message
    try { message = JSON.parse(raw) } catch (e) { return }

    if (message && message.event) {
      var subs = listeners[message.event] || []
      for (var i = 0; i < subs.length; i++) { subs[i](message.payload) }
      return
    }

    var entry = pending[message.id]
    if (!entry) { return }
    delete pending[message.id]
    if (message.ok) { entry.resolve(message.value) }
    else { entry.reject(new Error(message.error || 'bridge call failed')) }
  }

  function subscribe(event, listener) {
    listeners[event] = (listeners[event] || []).concat(listener)
    // ⚠️ Returns its own unsubscribe: without it every mount of the settings
    // screen adds another listener to the same emitter and the progress bar
    // jumps as N copies of each event arrive. Same rule as the Electron side.
    return function () {
      listeners[event] = (listeners[event] || []).filter(function (l) { return l !== listener })
    }
  }

  var bridge = {}
  var names = ${methods}
  for (var i = 0; i < names.length; i++) {
    (function (dotted) {
      var parts = dotted.split('.')
      var group = parts[0]
      var name = parts[1]
      bridge[group] = bridge[group] || {}
      bridge[group][name] = function () { return post(dotted, arguments) }
    })(names[i])
  }

  bridge.app = bridge.app || {}
  bridge.app.onUpdateStatus = function (listener) { return subscribe('updateStatus', listener) }

  window.${BRIDGE_GLOBAL} = bridge
})();
true;`
}
