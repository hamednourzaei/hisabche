// ============================================
// Typed access to the preload bridge.
//
// The bridge is absent when the renderer runs outside Electron (tests, a
// browser preview), so every caller goes through `bridge()` and handles null.
// ============================================

import type { DesktopBridge } from '../../../electron/preload'

declare global {
  interface Window {
    hisabche?: DesktopBridge
  }
}

export function bridge(): DesktopBridge | null {
  return typeof window !== 'undefined' ? (window.hisabche ?? null) : null
}

export function hasBridge(): boolean {
  return bridge() !== null
}

export type { DesktopBridge }
