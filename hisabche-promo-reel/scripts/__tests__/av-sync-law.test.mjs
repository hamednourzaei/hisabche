// AV sync law — the recorded library side (owner, 17 Oct 2026).
// Every file the mixer may place must have a hit point and a usable level, and
// the law's numbers are fixed: loosening them is a decision, not a test edit.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { SYNC_LAW, getPcmSample, placedCues } from '../sound-design.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, 'assets', 'sfx', 'manifest.json'), 'utf8'),
)

describe('AV sync law — numbers', () => {
  it('is strict: ±45 ms, hit point at half the peak, quieter than −45 dB refused', () => {
    expect(SYNC_LAW.maxLagMs).toBeLessThanOrEqual(45)
    expect(SYNC_LAW.hitFraction).toBe(0.5)
    expect(SYNC_LAW.minRawPeakDb).toBe(-45)
    expect(SYNC_LAW.riseSeconds).toBeLessThanOrEqual(0.03)
    expect(SYNC_LAW.bedRms).toBeLessThanOrEqual(0.008)
  })

  it('one sound per 120 ms: the second of two close cues is not promised a sound', () => {
    const placed = placedCues([
      { at: 1.0, kind: 'pop' },
      { at: 1.05, kind: 'impact' },
      { at: 1.3, kind: 'pop' },
    ])
    expect(placed.map((c) => c.at)).toEqual([1.0, 1.3])
  })
})

describe('AV sync law — every recorded file can be placed on its hit point', () => {
  const files = [...new Set(Object.values(manifest).flat())]
  it.each(files)('%s has a hit point and a usable level', (file) => {
    const sample = getPcmSample(path.join(root, 'assets', 'sfx', file))
    expect(
      sample,
      `${file} is quieter than ${SYNC_LAW.minRawPeakDb} dB or unreadable`,
    ).not.toBeNull()
    expect(sample.anchor).toBeGreaterThanOrEqual(0)
    expect(sample.anchor).toBeLessThan(sample.length)
    // Normalised: the loudest frame is the target peak.
    let peak = 0
    for (let i = 0; i < sample.length; i++)
      peak = Math.max(peak, Math.abs(sample.L[i]), Math.abs(sample.R[i]))
    expect(peak).toBeCloseTo(SYNC_LAW.targetPeak, 3)
  })

  // A swell or a rustle texture has no frame to land on: reel 60's sparkle,
  // card swoosh and page rustle were «not heard» at their cue for that reason.
  const eventFiles = Object.entries(manifest)
    .filter(([kind]) => kind !== 'softTransition')
    .flatMap(([kind, list]) => list.map((file) => [kind, file]))
  it.each(eventFiles)('%s → %s is a transient whose first hit leads', (_kind, file) => {
    const sample = getPcmSample(path.join(root, 'assets', 'sfx', file))
    expect(sample.transient).toBe(true)
    // The FIRST hit is the hit: a soft riffle then a louder slap is two
    // moments, and the ear picks the slap (whoosh-card-fan-1, +120 ms in reel 61).
    expect(sample.leads).toBe(true)
    // At most SYNC_LAW.leadSeconds before the hit is kept.
    expect(sample.anchor).toBeLessThanOrEqual(Math.round(SYNC_LAW.leadSeconds * 48000))
  })
})
