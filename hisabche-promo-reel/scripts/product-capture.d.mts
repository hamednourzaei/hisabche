// Types for scripts/product-capture.mjs (real product recordings: served, checked, exported).
export declare const CAPTURE_EXTENSIONS: Record<string, 'video' | 'image'>
export declare const CAPTURE_PROBLEMS: {
  specInvalid: string
  nameInvalid: string
  unsupported: string
  missing: string
  empty: string
  unreadable: string
}
export declare function capturesDir(env?: Record<string, string | undefined>): string
export declare function mimeOf(name: string): string
export declare function isBareFileName(name: unknown): name is string
export type CaptureLookup =
  | { ok: true; file: string; kind: 'video' | 'image'; bytes: number }
  | { ok: false; code: string; name: string; message: string }
export declare function resolveCapture(name: unknown, dir?: string): CaptureLookup
export interface CaptureSceneLike {
  start: number
  end: number
  spec: { kind: string; file?: unknown; route?: unknown; trimStart?: unknown; screenState?: unknown; captures?: readonly { file: unknown; route: unknown; trimStart?: unknown; screenState?: unknown }[] }
}
export declare function captureScenesOf(reel: { scenes?: readonly CaptureSceneLike[] }): CaptureSceneLike[]
export interface CaptureProblem {
  at: number
  route: unknown
  code: string
  name: string
  message: string
}
export declare function checkProductCaptures(
  reel: { scenes?: readonly CaptureSceneLike[] },
  dir?: string,
): { ok: boolean; problems: CaptureProblem[] }
export interface CaptureManifestRow {
  reel: string
  at: number
  file: string
  route: string
  minSeconds: number
  screenState: string | null
  present: boolean
  problem: string | null
}
export declare function captureManifestOf(
  reels: readonly { id: string; scenes?: readonly CaptureSceneLike[] }[],
  dir?: string,
): CaptureManifestRow[]
