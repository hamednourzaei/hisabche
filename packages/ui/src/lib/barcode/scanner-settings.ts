// ============================================
// Scanner settings — per DEVICE, not per workspace.
//
// Which scanner is plugged into this till, and how it is configured (suffix,
// speed), is a fact about this machine. Kept in browser storage: a per-viewer
// convenience that must work when storage is unavailable (private window,
// blocked site data) — every read falls back to the explicit defaults (G4).
// ============================================

import { DEFAULT_SCANNER_CONFIG, type ScannerConfig, type ScanSuffix } from './scan-detector'

const KEY = 'hisabche:scanner-settings:v1'
const SUFFIXES: readonly ScanSuffix[] = ['Enter', 'Tab', 'none']

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

/** Whatever is stored, coerced into a valid config — never trusted as-is. */
export function sanitizeScannerConfig(raw: unknown): ScannerConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_SCANNER_CONFIG
  const minLength = clamp(v.minLength, 1, 64, d.minLength)
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    suffix: SUFFIXES.includes(v.suffix as ScanSuffix) ? (v.suffix as ScanSuffix) : d.suffix,
    minLength,
    maxLength: Math.max(minLength, clamp(v.maxLength, 1, 128, d.maxLength)),
    maxInterKeyMs: clamp(v.maxInterKeyMs, 5, 300, d.maxInterKeyMs),
    idleCommitMs: clamp(v.idleCommitMs, 30, 1000, d.idleCommitMs),
  }
}

export function loadScannerConfig(): ScannerConfig {
  try {
    const raw = window.localStorage.getItem(KEY)
    return sanitizeScannerConfig(raw ? JSON.parse(raw) : null)
  } catch {
    return DEFAULT_SCANNER_CONFIG
  }
}

export function saveScannerConfig(config: ScannerConfig): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(sanitizeScannerConfig(config)))
    window.dispatchEvent(new Event(SCANNER_SETTINGS_EVENT))
  } catch {
    // Not persisted — the defaults still work.
  }
}

/** Fired when settings change, so an open invoice picks them up without a reload. */
export const SCANNER_SETTINGS_EVENT = 'hisabche:scanner-settings'
