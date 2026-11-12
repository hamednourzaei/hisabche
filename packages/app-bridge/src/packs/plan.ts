// ============================================
// packages/app-bridge/src/packs/plan.ts
//
// V62 Slice 8 — Pure pack install/upgrade/remove planner.
// ============================================

import type { PackManifest } from './manifest'

export interface InstalledPackState {
  readonly coreBuildId: string
  readonly packs: readonly string[]
}

export interface PackInstallPlan {
  readonly coreBuildId: string
  readonly toDownload: readonly string[]
  readonly toKeep: readonly string[]
  readonly toRemove: readonly string[]
  readonly blockedWithdrawn: readonly string[]
  readonly filesToFetch: readonly {
    packId: string
    path: string
    sha256: string
    sizeBytes: number
  }[]
}

export function planInstall(
  manifest: PackManifest,
  installed: InstalledPackState | null,
  wantedPacks: readonly string[],
): PackInstallPlan {
  const resolved = new Set<string>()
  const blockedWithdrawn = new Set<string>()

  const visit = (id: string) => {
    if (resolved.has(id) || blockedWithdrawn.has(id)) return
    const entry = manifest.packs[id]
    if (!entry) return
    if (entry.withdrawn) {
      blockedWithdrawn.add(id)
      return
    }
    for (const dep of entry.dependsOn) {
      visit(dep)
      if (blockedWithdrawn.has(dep)) {
        blockedWithdrawn.add(id)
        return
      }
    }
    resolved.add(id)
  }

  for (const id of wantedPacks) visit(id)

  const sameBuild = installed?.coreBuildId === manifest.coreBuildId
  const currentlyInstalled = new Set(sameBuild ? (installed?.packs ?? []) : [])

  const toKeep: string[] = []
  const toDownload: string[] = []
  for (const id of resolved) {
    if (currentlyInstalled.has(id)) {
      toKeep.push(id)
    } else {
      toDownload.push(id)
    }
  }

  const toRemove: string[] = []
  for (const id of currentlyInstalled) {
    if (!resolved.has(id)) {
      toRemove.push(id)
    }
  }

  const filesToFetch: Array<{ packId: string; path: string; sha256: string; sizeBytes: number }> =
    []
  const seenFiles = new Set<string>()
  for (const packId of toDownload) {
    const entry = manifest.packs[packId]
    if (!entry) continue
    for (const file of entry.files) {
      if (seenFiles.has(file.path)) continue
      seenFiles.add(file.path)
      filesToFetch.push({
        packId,
        path: file.path,
        sha256: file.sha256,
        sizeBytes: file.sizeBytes,
      })
    }
  }

  return {
    coreBuildId: manifest.coreBuildId,
    toDownload,
    toKeep,
    toRemove,
    blockedWithdrawn: [...blockedWithdrawn],
    filesToFetch,
  }
}
