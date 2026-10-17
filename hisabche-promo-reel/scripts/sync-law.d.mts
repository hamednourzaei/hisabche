// Types for scripts/sync-law.mjs (the AV sync law, shared by export and preview).
export declare const ONSET: {
  highpassHz: number
  hopSeconds: number
  lookback: number
  jump: number
  floor: number
  minGapSeconds: number
}
export declare const SYNC_LAW: {
  hitFraction: number
  targetPeak: number
  minRawPeakDb: number
  minGapSeconds: number
  maxLagMs: number
  chokeSeconds: number
  chokeLeadSeconds: number
  hitRelative: number
  riseSeconds: number
  laterHitMax: number
  leadSeconds: number
  bedRms: number
}
export declare function highpass(x: Float32Array, sr: number, freq?: number): Float32Array
export declare function onsetsOf(mono: Float32Array, sr: number, relative?: number): number[]
export declare function hitOnsets(mono: Float32Array, sr: number): number[]
export declare function hitProfile(mono: Float32Array, sr: number): Array<{ t: number; peak: number }>
export declare function firstHitLeads(hits: Array<{ t: number; peak: number }>): boolean
