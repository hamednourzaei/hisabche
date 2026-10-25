// Product captures: a real recording or no export. Every refusal has its own code, and nothing
// substitutes a file that is not there.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  CAPTURE_PROBLEMS,
  captureScenesOf,
  capturesDir,
  checkProductCaptures,
  isBareFileName,
  mimeOf,
  resolveCapture,
} from '../product-capture.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// The first bytes each type must start with — enough for the content check, not a playable file.
const PNG = Buffer.concat([
  Buffer.from([0x89]),
  Buffer.from('PNG\r\n\x1a\n', 'latin1'),
  Buffer.alloc(8),
])
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)])
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'latin1'),
  Buffer.alloc(4),
])
const MP4 = Buffer.concat([Buffer.alloc(4), Buffer.from('ftypisom', 'latin1'), Buffer.alloc(4)])
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(12)])

let dir

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hisabche-captures-test-'))
  fs.writeFileSync(path.join(dir, 'till.mp4'), MP4)
  fs.writeFileSync(path.join(dir, 'till.webm'), WEBM)
  fs.writeFileSync(path.join(dir, 'till.png'), PNG)
  fs.writeFileSync(path.join(dir, 'till.jpg'), JPG)
  fs.writeFileSync(path.join(dir, 'till.webp'), WEBP)
  fs.writeFileSync(path.join(dir, 'empty.mp4'), Buffer.alloc(0))
  fs.writeFileSync(path.join(dir, 'liar.png'), 'this is text, not a picture')
  fs.writeFileSync(path.join(dir, 'clip.mov'), MP4)
  fs.writeFileSync(path.join(dir, 'clip.gif'), 'GIF89a')
  fs.writeFileSync(path.join(dir, 'noext'), MP4)
  fs.mkdirSync(path.join(dir, 'folder.png'))
})

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

const scene = (spec, start = 4.5, end = 8) => ({ start, end, vo: '', spec })
const capture = (over = {}) => ({
  kind: 'product-capture',
  file: 'till.mp4',
  route: '/till',
  ...over,
})

describe('a valid recording', () => {
  it.each([
    ['till.mp4', 'video'],
    ['till.webm', 'video'],
    ['till.png', 'image'],
    ['till.jpg', 'image'],
    ['till.webp', 'image'],
  ])('%s is accepted as a %s', (name, kind) => {
    const found = resolveCapture(name, dir)
    expect(found.ok).toBe(true)
    expect(found.kind).toBe(kind)
    expect(found.file).toBe(path.join(dir, name))
    expect(found.bytes).toBeGreaterThan(0)
  })

  it('has a media type the page can wrap its bytes in', () => {
    expect(mimeOf('till.mp4')).toBe('video/mp4')
    expect(mimeOf('till.PNG')).toBe('image/png')
    expect(mimeOf('x.bin')).toBe('application/octet-stream')
  })
})

describe('a recording that is not usable is refused, with its own code', () => {
  it('missing file', () => {
    const found = resolveCapture('nowhere.mp4', dir)
    expect(found.ok).toBe(false)
    expect(found.code).toBe(CAPTURE_PROBLEMS.missing)
    expect(found.name).toBe('nowhere.mp4')
  })

  it('a folder with a file-like name is not a file', () => {
    expect(resolveCapture('folder.png', dir).code).toBe(CAPTURE_PROBLEMS.missing)
  })

  it('empty file', () => {
    expect(resolveCapture('empty.mp4', dir).code).toBe(CAPTURE_PROBLEMS.empty)
  })

  it('unsupported type, whatever is inside', () => {
    expect(resolveCapture('clip.mov', dir).code).toBe(CAPTURE_PROBLEMS.unsupported)
    expect(resolveCapture('clip.gif', dir).code).toBe(CAPTURE_PROBLEMS.unsupported)
    expect(resolveCapture('noext', dir).code).toBe(CAPTURE_PROBLEMS.unsupported)
  })

  it('a file whose bytes are not what its extension says', () => {
    expect(resolveCapture('liar.png', dir).code).toBe(CAPTURE_PROBLEMS.unsupported)
  })

  it.each(['../till.mp4', 'a/till.mp4', 'a\\till.mp4', 'C:till.mp4', '.till.mp4', '', 'x..mp4'])(
    'name that is not a bare file name: %j',
    (name) => {
      expect(isBareFileName(name)).toBe(false)
      expect(resolveCapture(name, dir).code).toBe(CAPTURE_PROBLEMS.nameInvalid)
    },
  )

  it('a name that is not even a string', () => {
    expect(resolveCapture(undefined, dir).ok).toBe(false)
    expect(resolveCapture(42, dir).ok).toBe(false)
  })
})

describe('the export gate (checkProductCaptures)', () => {
  it('a reel with no capture scene passes: nothing to check', () => {
    const reel = { scenes: [scene({ kind: 'kinetic', headline: 'x', words: [] })] }
    expect(captureScenesOf(reel)).toEqual([])
    expect(checkProductCaptures(reel, dir)).toEqual({ ok: true, problems: [] })
  })

  it('a reel whose recording exists passes', () => {
    expect(checkProductCaptures({ scenes: [scene(capture())] }, dir).ok).toBe(true)
  })

  it('a missing recording blocks, and says which file, which page and which second', () => {
    const result = checkProductCaptures(
      { scenes: [scene(capture({ file: 'nowhere.mp4' }), 4.5, 8)] },
      dir,
    )
    expect(result.ok).toBe(false)
    expect(result.problems).toEqual([
      expect.objectContaining({
        code: CAPTURE_PROBLEMS.missing,
        name: 'nowhere.mp4',
        route: '/till',
        at: 4.5,
      }),
    ])
  })

  it('every bad scene is reported, not only the first', () => {
    const result = checkProductCaptures(
      {
        scenes: [
          scene(capture({ file: 'nowhere.mp4' }), 0, 3),
          scene(capture({ file: 'liar.png', route: '/invoices/new' }), 3, 6),
          scene(capture(), 6, 9),
        ],
      },
      dir,
    )
    expect(result.problems.map((p) => p.code)).toEqual([
      CAPTURE_PROBLEMS.missing,
      CAPTURE_PROBLEMS.unsupported,
    ])
  })

  it('an invalid spec blocks before any file is looked at', () => {
    const noSlash = checkProductCaptures({ scenes: [scene(capture({ route: 'till' }))] }, dir)
    const negativeTrim = checkProductCaptures({ scenes: [scene(capture({ trimStart: -1 }))] }, dir)
    const noDuration = checkProductCaptures({ scenes: [scene(capture(), 5, 5)] }, dir)
    for (const result of [noSlash, negativeTrim, noDuration]) {
      expect(result.ok).toBe(false)
      expect(result.problems[0].code).toBe(CAPTURE_PROBLEMS.specInvalid)
    }
  })
})

describe('where the recordings live', () => {
  it('outside the repository by default, so nothing in the workspace can hold or push them', () => {
    const where = capturesDir({})
    expect(where.startsWith(root + path.sep)).toBe(false)
    expect(where).toBe(path.join(os.homedir(), 'Videos', 'hisabche-captures'))
  })

  it('can be moved with HISABCHE_CAPTURES_DIR', () => {
    expect(capturesDir({ HISABCHE_CAPTURES_DIR: dir })).toBe(path.resolve(dir))
  })
})

describe('the capture manifest', () => {
  it('lists every capture a reel asks for, with what is missing and how much is needed', async () => {
    const { captureManifestOf } = await import('../product-capture.mjs')
    const reels = [
      {
        id: '94',
        scenes: [
          scene(capture(), 6, 11),
          scene(
            capture({
              file: 'nowhere.mp4',
              route: '/customers',
              screenState: 'rows filled',
              trimStart: 2,
            }),
            14,
            19,
          ),
        ],
      },
      { id: '12', scenes: [scene({ kind: 'kinetic' })] },
    ]
    expect(captureManifestOf(reels, dir)).toEqual([
      {
        reel: '94',
        at: 6,
        file: 'till.mp4',
        route: '/till',
        minSeconds: 5,
        screenState: null,
        present: true,
        problem: null,
      },
      {
        reel: '94',
        at: 14,
        file: 'nowhere.mp4',
        route: '/customers',
        minSeconds: 7,
        screenState: 'rows filled',
        present: false,
        problem: CAPTURE_PROBLEMS.missing,
      },
    ])
  })
})

describe('a bespoke scene that embeds a recording must declare it', () => {
  const embedded = (captures) => scene({ kind: 'bespoke', component: () => null, captures }, 3, 9)

  it('is seen by the gate and the manifest exactly like a product-capture scene', async () => {
    const { captureManifestOf } = await import('../product-capture.mjs')
    const reel = {
      id: '97',
      scenes: [
        embedded([
          {
            file: 'nowhere.mp4',
            route: '/stock-count',
            trimStart: 1,
            screenState: 'a count with differences',
          },
        ]),
      ],
    }
    expect(captureScenesOf(reel)).toHaveLength(1)
    const gate = checkProductCaptures(reel, dir)
    expect(gate.ok).toBe(false)
    expect(gate.problems[0]).toEqual(
      expect.objectContaining({
        code: CAPTURE_PROBLEMS.missing,
        name: 'nowhere.mp4',
        route: '/stock-count',
        at: 3,
      }),
    )
    expect(captureManifestOf([reel], dir)[0]).toEqual(
      expect.objectContaining({
        reel: '97',
        file: 'nowhere.mp4',
        minSeconds: 7,
        screenState: 'a count with differences',
      }),
    )
  })

  it('passes when the recording exists, and ignores a bespoke scene that embeds nothing', () => {
    expect(
      checkProductCaptures({ scenes: [embedded([{ file: 'till.mp4', route: '/till' }])] }, dir).ok,
    ).toBe(true)
    expect(
      captureScenesOf({ scenes: [scene({ kind: 'bespoke', component: () => null }, 0, 3)] }),
    ).toEqual([])
  })
})
