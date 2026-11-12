// ============================================
// packages/app-bridge/src/packs/store.ts
//
// V62 Slice 8 — Atomic verified pack store + GC (Node/Electron adapter).
//
// Install lifecycle:
//   1. Write files into `packs/.staging/<buildId>/`
//   2. Verify manifest Ed25519 signature + every file's sha256
//   3. Atomic rename into `packs/<buildId>/`
//   4. Write `installed.json` last
//   5. Never serve a file not listed in a verified manifest
//   6. GC keeps current + previous build; deletes older builds
// ============================================

import fs from 'node:fs'
import path from 'node:path'

import { parsePackManifest, type PackManifest } from './manifest'
import type { InstalledPackState } from './plan'
import { safeJoinRoot, verifyFileSha256, verifyManifestEd25519 } from './verify'

export interface InstalledRecord {
  coreBuildId: string
  previousBuildId: string | null
  packs: string[]
  updatedAt: string
}

export class PackStore {
  public readonly packsDir: string
  public readonly stagingDir: string
  public readonly installedFile: string

  constructor(baseDir: string) {
    this.packsDir = path.resolve(baseDir, 'packs')
    this.stagingDir = path.join(this.packsDir, '.staging')
    this.installedFile = path.join(this.packsDir, 'installed.json')
  }

  cleanupInterruptedStaging(): string[] {
    if (!fs.existsSync(this.stagingDir)) return []
    const removed: string[] = []
    for (const entry of fs.readdirSync(this.stagingDir)) {
      const target = path.join(this.stagingDir, entry)
      fs.rmSync(target, { recursive: true, force: true })
      removed.push(entry)
    }
    return removed
  }

  readInstalled(): InstalledRecord | null {
    if (!fs.existsSync(this.installedFile)) return null
    try {
      const parsed = JSON.parse(fs.readFileSync(this.installedFile, 'utf8')) as InstalledRecord
      if (typeof parsed.coreBuildId !== 'string' || !Array.isArray(parsed.packs)) return null
      return parsed
    } catch {
      return null
    }
  }

  readInstalledState(): InstalledPackState | null {
    const rec = this.readInstalled()
    if (!rec) return null
    return { coreBuildId: rec.coreBuildId, packs: rec.packs }
  }

  /**
   * Stage, cryptographically verify, and atomically commit a build's packs.
   * Writes `installed.json` last.
   */
  installVerifiedBuild(input: {
    manifestBytes: Buffer | Uint8Array
    signatureBase64: string
    publicKeyPem: string
    selectedPacks: readonly string[]
    files: ReadonlyMap<string, Buffer | Uint8Array>
  }): InstalledRecord {
    if (!verifyManifestEd25519(input.manifestBytes, input.signatureBase64, input.publicKeyPem)) {
      throw new Error('PACK_MANIFEST_SIGNATURE_INVALID')
    }

    const manifest: PackManifest = parsePackManifest(
      JSON.parse(Buffer.from(input.manifestBytes).toString('utf8')),
    )
    const buildId = manifest.coreBuildId
    if (!/^[a-zA-Z0-9._-]+$/.test(buildId)) {
      throw new Error(`INVALID_BUILD_ID:${buildId}`)
    }

    fs.mkdirSync(this.stagingDir, { recursive: true })
    const stageBuildDir = safeJoinRoot(this.stagingDir, buildId)
    fs.rmSync(stageBuildDir, { recursive: true, force: true })
    fs.mkdirSync(stageBuildDir, { recursive: true })

    try {
      const verifiedPackIds: string[] = []
      for (const packId of input.selectedPacks) {
        const entry = manifest.packs[packId]
        if (!entry || entry.withdrawn) continue
        for (const f of entry.files) {
          const bytes = input.files.get(f.path)
          if (!bytes) {
            throw new Error(`PACK_FILE_MISSING:${f.path}`)
          }
          if (!verifyFileSha256(bytes, f.sha256)) {
            throw new Error(`PACK_FILE_HASH_MISMATCH:${f.path}`)
          }
          const dest = safeJoinRoot(stageBuildDir, f.path)
          fs.mkdirSync(path.dirname(dest), { recursive: true })
          fs.writeFileSync(dest, bytes)
        }
        verifiedPackIds.push(packId)
      }

      fs.writeFileSync(path.join(stageBuildDir, 'manifest.json'), input.manifestBytes)
      fs.writeFileSync(path.join(stageBuildDir, 'manifest.json.sig'), input.signatureBase64)

      const finalBuildDir = safeJoinRoot(this.packsDir, buildId)
      fs.rmSync(finalBuildDir, { recursive: true, force: true })
      fs.renameSync(stageBuildDir, finalBuildDir)

      const prev = this.readInstalled()
      const previousBuildId =
        prev && prev.coreBuildId !== buildId ? prev.coreBuildId : (prev?.previousBuildId ?? null)

      const nextRecord: InstalledRecord = {
        coreBuildId: buildId,
        previousBuildId,
        packs: verifiedPackIds,
        updatedAt: new Date().toISOString(),
      }
      fs.writeFileSync(this.installedFile, JSON.stringify(nextRecord, null, 2) + '\n', 'utf8')
      return nextRecord
    } catch (err) {
      fs.rmSync(stageBuildDir, { recursive: true, force: true })
      throw err
    }
  }

  /**
   * Resolve a verified asset file for `buildId`. Refuses path traversal or any
   * file not listed in the verified manifest of that build.
   */
  resolveVerifiedAsset(buildId: string, relPath: string): string | null {
    if (!/^[a-zA-Z0-9._-]+$/.test(buildId)) return null
    const buildDir = safeJoinRoot(this.packsDir, buildId)
    const manifestFile = path.join(buildDir, 'manifest.json')
    if (!fs.existsSync(manifestFile)) return null

    const cleanRel = relPath.replace(/^\/+/, '')
    const fullTarget = safeJoinRoot(buildDir, cleanRel)

    const manifest = parsePackManifest(JSON.parse(fs.readFileSync(manifestFile, 'utf8')))
    const allowed = new Set<string>()
    for (const pack of Object.values(manifest.packs)) {
      if (pack.withdrawn) continue
      for (const f of pack.files) allowed.add(f.path)
    }
    if (!allowed.has(cleanRel)) return null
    return fs.existsSync(fullTarget) ? fullTarget : null
  }

  /** Keep `current` + `previous` build directories; delete all older builds. */
  garbageCollect(currentBuildId: string, previousBuildId: string | null): string[] {
    if (!fs.existsSync(this.packsDir)) return []
    const keep = new Set<string>(['.staging', 'installed.json', currentBuildId])
    if (previousBuildId) keep.add(previousBuildId)

    const deleted: string[] = []
    for (const entry of fs.readdirSync(this.packsDir)) {
      if (keep.has(entry)) continue
      fs.rmSync(path.join(this.packsDir, entry), { recursive: true, force: true })
      deleted.push(entry)
    }
    return deleted
  }
}
