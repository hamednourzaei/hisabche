// The motion catalogue is built from the source and must stay faithful to it: every registered reel
// is in it, every asset points at a real file, and the committed registry has the same ids as a
// fresh build (line numbers may drift between rebuilds; the set of things may not).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

import { buildRegistry, searchRegistry } from '../motion-catalogue.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const committed = JSON.parse(
  fs.readFileSync(path.join(root, 'docs', 'motion-catalogue', 'registry.json'), 'utf8'),
)

let fresh

beforeAll(async () => {
  fresh = await buildRegistry()
}, 120_000)

describe('the catalogue covers the studio', () => {
  it('has every registered reel, with the real timeline duration', () => {
    expect(fresh.reels).toHaveLength(103)
    for (const reel of fresh.reels) {
      expect(reel.seconds, `reel ${reel.id}`).toBeGreaterThan(0)
      expect(reel.scenes.length, `reel ${reel.id}`).toBeGreaterThan(0)
      expect(reel.aspectRatio).toBe('9:16 (1080x1920)')
    }
    const last = fresh.reels.find((r) => r.id === '94')
    expect(last.seconds).toBeGreaterThan(30)
  })

  it('finds the source file of every reel — and says so out loud when it cannot or when two files claim an id', () => {
    expect(fresh.summary.reelsWithoutSource).toEqual([])
    for (const reel of fresh.reels)
      expect(fs.existsSync(path.join(root, reel.source)), `reel ${reel.id}`).toBe(true)
    // Reel 75 is declared by two files (one is an orphan): reported, not hidden.
    expect(fresh.summary.reelsWithIdCollision).toEqual(['75'])
  })

  it('catalogues the motion source families, not just scenes', () => {
    const types = new Set(fresh.assets.map((a) => a.type))
    for (const type of [
      'scene-component',
      'motion-operator',
      'viral-template',
      'ui-primitive',
      'animation-math',
      'typography',
      'sound-cues',
    ]) {
      expect(types.has(type), type).toBe(true)
    }
    expect(fresh.sounds.kinds.length).toBeGreaterThan(20)
    expect(fresh.sounds.files.every((f) => f.licence !== 'NOT DOCUMENTED')).toBe(true)
  })
})

describe('every asset is honest', () => {
  it('has a unique id and points at a file that exists', () => {
    const ids = fresh.assets.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const asset of fresh.assets) {
      expect(fs.existsSync(path.join(root, asset.source.path)), asset.id).toBe(true)
      expect(asset.source.line).toBeGreaterThan(0)
    }
  })

  it('shows a real usage example wherever something uses it', () => {
    const used = fresh.assets.filter((a) => a.usedBy.length > 0)
    expect(used.length).toBeGreaterThan(50)
    for (const asset of used) {
      expect(asset.example, asset.id).not.toBeNull()
      expect(fs.existsSync(path.join(root, asset.example.file)), asset.id).toBe(true)
    }
  })

  it('knows reel 94 uses its own scene components', () => {
    const hook = fresh.assets.find((a) => a.id === 'scenes/three-questions#ThreeHookScene')
    expect(hook.usedBy.map((u) => u.file)).toContain('src/reels/reel-94-three-questions.ts')
    expect(hook.params.map((p) => p.name)).toContain('t')
    expect(hook.themes).toContain('paper-pocket')
  })
})

describe('the committed registry is current', () => {
  it('lists the same assets, reels and scene kinds as a fresh build', () => {
    expect(committed.assets.map((a) => a.id).sort()).toEqual(fresh.assets.map((a) => a.id).sort())
    expect(committed.reels.map((r) => `${r.id}:${r.source}`)).toEqual(
      fresh.reels.map((r) => `${r.id}:${r.source}`),
    )
    expect(committed.specKinds.map((k) => k.kind)).toEqual(fresh.specKinds.map((k) => k.kind))
  })
})

describe('search', () => {
  it('finds by style, type, dependency and runtime', () => {
    const paper = searchRegistry(fresh, { type: 'scene-component', style: 'paper-pocket' })
    expect(paper.assets.map((a) => a.name)).toContain('QuestionOneScene')
    const dep = searchRegistry(fresh, { dep: 'engine/anim', tag: 'typography' })
    expect(dep.assets.length).toBeGreaterThan(0)
    const long = searchRegistry(fresh, { min: '30' })
    expect(long.reels.every((r) => r.seconds > 30)).toBe(true)
    expect(long.reels.find((r) => r.id === '94')).toBeTruthy()
    const orphans = searchRegistry(fresh, { type: 'scene-component', used: 'false' })
    expect(Array.isArray(orphans.assets)).toBe(true)
  })
})
