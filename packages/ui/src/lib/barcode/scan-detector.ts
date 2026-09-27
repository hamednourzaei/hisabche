// ============================================
// Barcode scan detection for keyboard-wedge (USB/Bluetooth HID) scanners.
//
// A scanner IS a keyboard: it types the code very fast and (by default) ends
// with Enter. Telling that apart from a person typing is the whole job.
//
// ⚠️ SPEED ALONE IS NOT THE RULE. «< 30 ms between keys» breaks with a slower
// Bluetooth scanner, with a fast typist, and with a scanner whose suffix is
// Tab. So every part is configurable (per device, see scanner-settings.ts) and
// a scan must satisfy ALL of: every gap ≤ maxInterKeyMs, length within
// [minLength, maxLength], only allowed characters, and the configured suffix
// (or, for suffix 'none', a pause of idleCommitMs).
//
// ⚠️ THE KEYBOARD LAYOUT IS NOT TRUSTED. On Windows set to Persian, the key a
// scanner presses for «6» arrives as `event.key === '۶'`, and «A» as «ش». The
// physical key (`event.code`: Digit6, KeyA) does not depend on the layout, so
// characters are rebuilt from it; `event.key` is only a fallback.
// ============================================

export type ScanSuffix = 'Enter' | 'Tab' | 'none'

export interface ScannerConfig {
  enabled: boolean
  suffix: ScanSuffix
  minLength: number
  maxLength: number
  /** The longest gap between two scanner keystrokes. People are slower. */
  maxInterKeyMs: number
  /** suffix 'none' only: silence after the last key that ends the scan. */
  idleCommitMs: number
}

export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  enabled: true,
  suffix: 'Enter',
  minLength: 4,
  maxLength: 64,
  maxInterKeyMs: 50,
  idleCommitMs: 120,
}

/** The shared contract every barcode source produces (HID today; camera later). */
export interface BarcodeScan {
  value: string
  source: 'hid' | 'camera' | 'serial'
  timestamp: number
  /** First key to suffix, ms — shown on the scanner test panel. */
  durationMs: number
}

/** The parts of a KeyboardEvent the detector reads. */
export interface KeyInput {
  key: string
  code: string
  shiftKey: boolean
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

const SHIFTED: Record<string, string> = {
  Minus: '_',
  Period: '>',
  Slash: '?',
  Digit8: '*',
  Digit3: '#',
  Equal: '+',
}
const PLAIN: Record<string, string> = {
  Minus: '-',
  Period: '.',
  Slash: '/',
  Equal: '=',
  Space: ' ',
  NumpadDecimal: '.',
  NumpadSubtract: '-',
  NumpadAdd: '+',
  NumpadDivide: '/',
  NumpadMultiply: '*',
}

/** The character a key produces on a US layout — what the scanner meant. */
export function charFromKey(input: KeyInput): string | null {
  const { code, shiftKey } = input
  let m = /^Digit([0-9])$/.exec(code) ?? /^Numpad([0-9])$/.exec(code)
  if (m) return shiftKey && code.startsWith('Digit') ? (SHIFTED[code] ?? null) : m[1]!
  m = /^Key([A-Z])$/.exec(code)
  if (m) return shiftKey ? m[1]! : m[1]!.toLowerCase()
  if (shiftKey && SHIFTED[code]) return SHIFTED[code]!
  if (PLAIN[code]) return PLAIN[code]!
  // No physical code (some virtual keyboards, tests): fall back to the key,
  // with Persian/Arabic digits read as the digits they are.
  if (input.key.length === 1) {
    const c = input.key.codePointAt(0)!
    if (c >= 0x06f0 && c <= 0x06f9) return String(c - 0x06f0)
    if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660)
    if (c < 0x7f && c >= 0x20) return input.key
  }
  return null
}

const ALLOWED = /^[\x21-\x7e]+$/

export type FeedResult =
  /** Not part of a scan — let the key do what it normally does. */
  | { kind: 'pass' }
  /** Buffered as a possible scan (the key still reaches the page). */
  | { kind: 'buffered' }
  /** A scan completed on this key (the suffix): swallow it and roll back. */
  | { kind: 'scan'; scan: BarcodeScan; typedChars: number }

export interface ScanDetector {
  feed(input: KeyInput, now: number): FeedResult
  /** suffix 'none': call after idleCommitMs of silence. */
  flushIdle(now: number): FeedResult
  reset(): void
  /** True when a burst is in progress that the next key may continue. */
  isBuffering(now: number): boolean
}

export function createScanDetector(config: ScannerConfig): ScanDetector {
  let buffer = ''
  let startedAt = 0
  let lastAt = 0

  const reset = () => {
    buffer = ''
    startedAt = 0
    lastAt = 0
  }

  const complete = (now: number): FeedResult => {
    const value = buffer
    const valid =
      value.length >= config.minLength && value.length <= config.maxLength && ALLOWED.test(value)
    const typedChars = value.length
    const scan: BarcodeScan = {
      value,
      source: 'hid',
      timestamp: now,
      durationMs: Math.max(0, lastAt - startedAt),
    }
    reset()
    return valid ? { kind: 'scan', scan, typedChars } : { kind: 'pass' }
  }

  return {
    feed(input, now) {
      if (!config.enabled) return { kind: 'pass' }
      // A shortcut is never part of a scan.
      if (input.ctrlKey || input.altKey || input.metaKey) {
        reset()
        return { kind: 'pass' }
      }

      const isSuffix =
        (config.suffix === 'Enter' &&
          (input.key === 'Enter' || input.code === 'Enter' || input.code === 'NumpadEnter')) ||
        (config.suffix === 'Tab' && (input.key === 'Tab' || input.code === 'Tab'))

      if (isSuffix) {
        // Only a burst that is still «fast» ends in a scan: Enter after a pause
        // is a person pressing Enter.
        if (buffer && now - lastAt <= config.maxInterKeyMs * 2) return complete(now)
        reset()
        return { kind: 'pass' }
      }

      const ch = charFromKey(input)
      if (ch === null) {
        reset()
        return { kind: 'pass' }
      }

      if (buffer && now - lastAt > config.maxInterKeyMs) {
        // Too slow to be the same scan: this key may start a new one.
        buffer = ''
      }
      if (!buffer) startedAt = now
      buffer += ch
      lastAt = now
      if (buffer.length > config.maxLength) {
        reset()
        return { kind: 'pass' }
      }
      return { kind: 'buffered' }
    },
    flushIdle(now) {
      if (config.suffix !== 'none' || !buffer || now - lastAt < config.idleCommitMs)
        return { kind: 'pass' }
      // A person typing one character is not a scan; min length decides.
      return complete(now)
    },
    reset,
    isBuffering(now) {
      return buffer.length > 0 && now - lastAt <= config.maxInterKeyMs
    },
  }
}
