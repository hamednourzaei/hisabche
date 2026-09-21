// ============================================
// Typed access to the host bridge.
//
// ⚠️ THE UI DOES NOT KNOW WHICH HOST IT IS ON.
//
// `window.hisabche` is implemented by Electron's preload on Windows and by
// the React Native host on Android. The interface comes from
// `@hisabche/app-bridge`, which belongs to neither — importing it from a host
// (this file used to reach into `electron/preload`) is what made the UI
// desktop-only in the first place.
//
// The bridge is absent when the UI runs with no host at all (tests, a browser
// preview), so every caller goes through `bridge()` and handles null.
// ============================================

import type { HisabcheBridge } from '@hisabche/app-bridge'

declare global {
  interface Window {
    hisabche?: HisabcheBridge
  }
}

export function bridge(): HisabcheBridge | null {
  return typeof window !== 'undefined' ? (window.hisabche ?? null) : null
}

export function hasBridge(): boolean {
  return bridge() !== null
}

export type { HisabcheBridge }
