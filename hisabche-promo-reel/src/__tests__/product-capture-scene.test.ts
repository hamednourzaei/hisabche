// The product-capture scene plays a real recording and nothing else; the exporter refuses a reel
// whose recording is not there. Source assertions on the wiring (comments stripped first).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = path.resolve(__dirname, '..', '..')
const code = (file: string) =>
  fs
    .readFileSync(path.join(root, file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('product-capture scene', () => {
  const scene = code('src/scenes/product-capture.tsx')

  it('plays the file it is given and draws no interface of its own', () => {
    expect(scene).toContain('/capture-data?f=')
    expect(scene).toContain('<video')
    expect(scene).toContain('stillRatio(url)')
    expect(scene).toContain('backgroundImage')
    for (const stand of ['MockupScene', 'mockup', 'Mockup', 'placeholder', 'fallback']) {
      expect(scene).not.toContain(stand)
    }
  })

  it('shows an explicit missing state instead of a stand-in', () => {
    expect(scene).toContain('ضبط واقعی محصول موجود نیست')
  })

  it('is at the scene time: trimStart + t, held on the last frame', () => {
    expect(scene).toContain('(trimStart ?? 0) + t')
    expect(scene).toContain('element.duration - 0.04')
  })

  it('tells the exporter about each pending seek', () => {
    expect(scene).toContain('__REEL_MEDIA_PENDING')
    expect(scene).toContain("addEventListener('seeked'")
  })

  it('opens with the whoosh of a scene change (hard rule 15)', () => {
    expect(scene).toContain("{ at: 0.02, kind: 'whoosh' }")
  })
})

describe('wiring', () => {
  it('is a scene kind, rendered and cued', () => {
    expect(code('src/engine/types.ts')).toContain("kind: 'product-capture'")
    const index = code('src/scenes/index.tsx')
    expect(index).toContain(
      "case 'product-capture': return <ProductCaptureScene spec={spec} t={t} />",
    )
    expect(index).toContain("case 'product-capture': return productCaptureCues()")
  })

  it('the preview serves the recordings only after validating the name', () => {
    const vite = code('vite.config.ts')
    expect(vite).toContain("'/capture-data'")
    expect(vite).toContain('resolveCapture(name, capturesDir())')
    expect(vite).toContain('res.statusCode = 404')
  })
})

describe('export', () => {
  const exporter = code('scripts/export-mp4.mjs')

  it('checks the recordings before it draws a single frame, and stops with its own reason', () => {
    const check = exporter.indexOf('checkProductCaptures(reel)')
    const launch = exporter.indexOf('puppeteer.launch')
    expect(check).toBeGreaterThan(0)
    expect(check).toBeLessThan(launch)
    expect(exporter).toContain("blockedBy: 'PRODUCT_CAPTURE'")
  })

  it('waits for the recording to reach each frame before the screenshot', () => {
    const wait = exporter.indexOf('__REEL_MEDIA_PENDING')
    const shot = exporter.indexOf('page.screenshot')
    expect(wait).toBeGreaterThan(0)
    expect(wait).toBeLessThan(shot)
  })
})
