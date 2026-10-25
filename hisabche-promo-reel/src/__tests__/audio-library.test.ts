import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { chooseVariant, type SoundKind } from '../engine/sound'
import sfxManifestJson from '../../assets/sfx/manifest.json'
import musicManifestJson from '../../assets/music/manifest.json'

const ALL_SOUND_KINDS: SoundKind[] = [
  'pop',
  'whoosh',
  'success',
  'tick',
  'scan',
  'alert',
  'impact',
  'chime',
  'cash',
  'sync',
  'cinematicReveal',
  'titleHit',
  'dataFlow',
  'bigReveal',
  'insightReveal',
  'precisionSequence',
  'softTransition',
  'financialMilestone',
  'cardEnter',
  'sceneTransition',
  'majorReveal',
  'successResolution',
  'ctaResolution',
  'markerScribble',
  'paperRustle',
  'paperTear',
  'cameraSwish',
  'typewriterClick',
  'clockTickRapid',
  'chatPop',
  'receiptPrint',
  'cardThock',
]

/**
 * Sounds allowed to fall back to synthesis.
 * Required: this list should end up empty or near-empty.
 */
const SYNTH_FALLBACK_ALLOWED: SoundKind[] = []

const ALLOWED_LICENSES = [
  'CC0',
  'Public Domain',
  'Mixkit Free License',
  'Pixabay Content License',
  'CC BY 4.0',
  'CC BY',
  // The owner's own pack (24 Oct 2026): not an open licence — the owner answers for its terms.
  'Owner-supplied',
]

describe('Audio Design & Asset Library', () => {
  const root = path.resolve(__dirname, '..', '..')
  const sfxDir = path.resolve(root, 'assets', 'sfx')
  const musicDir = path.resolve(root, 'assets', 'music')
  const licensesFile = path.resolve(sfxDir, 'LICENSES.md')

  it('every SoundKind either has >= 1 file in the manifest or is in SYNTH_FALLBACK_ALLOWED', () => {
    const sfxManifest = sfxManifestJson as Record<string, string[]>
    for (const kind of ALL_SOUND_KINDS) {
      const files = sfxManifest[kind]
      const hasFiles = Array.isArray(files) && files.length >= 1
      const isAllowedFallback = SYNTH_FALLBACK_ALLOWED.includes(kind)
      expect(
        hasFiles || isAllowedFallback,
        `SoundKind '${kind}' must have recorded files in manifest or be in SYNTH_FALLBACK_ALLOWED`,
      ).toBe(true)
    }
    // Verify SYNTH_FALLBACK_ALLOWED is empty
    expect(SYNTH_FALLBACK_ALLOWED).toHaveLength(0)
  })

  it('every file referenced in sfx and music manifests exists on disk', () => {
    const sfxManifest = sfxManifestJson as Record<string, string[]>
    for (const [kind, files] of Object.entries(sfxManifest)) {
      for (const file of files) {
        const filePath = path.resolve(sfxDir, file)
        expect(
          fs.existsSync(filePath),
          `SFX file ${file} for kind ${kind} must exist on disk`,
        ).toBe(true)
        expect(fs.statSync(filePath).size, `SFX file ${file} must not be empty`).toBeGreaterThan(
          100,
        )
      }
    }

    const musicManifest = musicManifestJson as Array<{ file: string; mood: string; bpm: number }>
    expect(musicManifest.length).toBeGreaterThanOrEqual(3)
    for (const item of musicManifest) {
      const musicPath = path.resolve(musicDir, item.file)
      expect(fs.existsSync(musicPath), `Music file ${item.file} must exist on disk`).toBe(true)
      expect(
        fs.statSync(musicPath).size,
        `Music file ${item.file} must not be empty`,
      ).toBeGreaterThan(1000)
    }
  })

  it('every file in assets/ has a documented row in LICENSES.md with an approved license', () => {
    expect(fs.existsSync(licensesFile), 'assets/sfx/LICENSES.md must exist').toBe(true)
    const content = fs.readFileSync(licensesFile, 'utf8')

    // Parse markdown table rows: | `file.ogg` | ... | ... | **License** | ... |
    const licenseMap = new Map<string, string>()
    const lines = content.split(/\r?\n/)
    for (const line of lines) {
      if (!line.startsWith('|') || line.includes('---|---') || line.includes('File | Source'))
        continue
      const parts = line.split('|').map((p) => p.trim())
      if (parts.length >= 6) {
        const fileName = parts[1].replace(/[`]/g, '').trim()
        const license = parts[4].replace(/[*_]/g, '').trim()
        if (fileName && license) {
          licenseMap.set(fileName, license)
        }
      }
    }

    // Verify all SFX files on disk are in LICENSES.md
    const sfxFiles = fs.readdirSync(sfxDir).filter((f) => f.endsWith('.ogg'))
    for (const f of sfxFiles) {
      expect(licenseMap.has(f), `File ${f} must be documented in LICENSES.md`).toBe(true)
      const lic = licenseMap.get(f)!
      expect(
        ALLOWED_LICENSES.some((allowed) => lic.toLowerCase().includes(allowed.toLowerCase())),
        `File ${f} license '${lic}' must be in ALLOWED_LICENSES`,
      ).toBe(true)
    }

    // Verify all Music files on disk are in LICENSES.md
    const musicFiles = fs.readdirSync(musicDir).filter((f) => f.endsWith('.ogg'))
    for (const f of musicFiles) {
      expect(licenseMap.has(f), `Music file ${f} must be documented in LICENSES.md`).toBe(true)
      const lic = licenseMap.get(f)!
      expect(
        ALLOWED_LICENSES.some((allowed) => lic.toLowerCase().includes(allowed.toLowerCase())),
        `Music file ${f} license '${lic}' must be in ALLOWED_LICENSES`,
      ).toBe(true)
    }
  })

  it('variant choice is deterministic (same inputs -> exact same file)', () => {
    const variants = ['take_1.ogg', 'take_2.ogg', 'take_3.ogg']
    const pick1 = chooseVariant(variants, '60', 4)
    const pick2 = chooseVariant(variants, '60', 4)
    const pick3 = chooseVariant(variants, '60', 4)

    expect(pick1).toBe(pick2)
    expect(pick2).toBe(pick3)
    expect(variants).toContain(pick1)

    // Different cue index or reel ID yields deterministic different or valid choice
    const otherPick = chooseVariant(variants, '60', 5)
    expect(variants).toContain(otherPick)
  })

  it('total size of assets/ audio folder is <= 15 MB', () => {
    function getDirSize(dirPath: string): number {
      let total = 0
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const full = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          total += getDirSize(full)
        } else {
          total += fs.statSync(full).size
        }
      }
      return total
    }

    const sfxSize = getDirSize(sfxDir)
    const musicSize = getDirSize(musicDir)
    const totalBytes = sfxSize + musicSize
    const maxBytes = 15 * 1024 * 1024

    expect(totalBytes).toBeLessThanOrEqual(maxBytes)
    // Also assert that library has substantial content (> 1 MB)
    expect(totalBytes).toBeGreaterThan(1 * 1024 * 1024)
  })
})
