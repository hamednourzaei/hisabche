// Types for scripts/runtime-law.mjs (every reel runs more than 30 seconds).
export declare const MIN_RUNTIME_SECONDS: number
export declare const RUNTIME_REMEDIATION: string[]
interface TimedReel {
  id: string
  duration?: number
  scenes?: readonly { end: number }[]
}
export declare function runtimeOf(reel: TimedReel): number
export declare function exceedsMinimum(seconds: number): boolean
export declare function judgeRuntime(
  reel: TimedReel,
  remediation?: string[],
): { status: 'ok' | 'remediation' | 'violation' | 'inconsistent'; seconds: number }
export declare function isProductionReady(reel: TimedReel): boolean
