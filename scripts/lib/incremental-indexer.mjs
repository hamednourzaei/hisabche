/**
 * Hisabche Code Intelligence — Incremental Indexing Engine
 * Detects repository changes, calculates precise invalidation sets,
 * performs atomic publication, and guarantees full-rebuild equivalence.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
  copyFileSync,
  renameSync,
  statSync,
} from 'node:fs'
import { join, extname, basename, resolve } from 'node:path'
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'

import { extractSymbolsFromSource, inferPackageName } from './ast-symbol-extractor.mjs'
import { loadPathAliases, loadWorkspacePackageMap } from './module-resolver.mjs'
import { extractFileRelationships } from './ast-relationship-extractor.mjs'
import { buildDependencyGraph } from './dependency-graph.mjs'

const ROOT = process.cwd()
const AI_DIR = join(ROOT, '.ai', 'codebase')
const GRAPH_JSON = join(AI_DIR, 'graph.json')
const MAP_MD = join(AI_DIR, 'CODEBASE_MAP.md')
const CACHE_JSON = join(AI_DIR, 'cache.json')
const BACKUP_JSON = join(AI_DIR, 'graph.json.bak')

const INDEXER_VERSION = '2.0.0'

const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.expo',
  '.turbo',
  '.git',
  'coverage',
  '.vercel',
  '.vscode',
  '.idea',
  '__pycache__',
  '.p',
  'out',
  '.claude',
  'llm-council-results',
  'test-intelligence-results',
  'release-readiness-results',
  'android',
  'ios',
  '.eas',
  'e2e',
  '__tests__',
  'test-results',
  'scripts',
  'docs',
  'assets',
  'resources',
  'fonts',
  'public',
  'styles',
  'i18n',
])

const IGNORE_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '.env',
  '.env.local',
  '.env.production',
  '.env.staging',
  '.env.migrate',
  '.DS_Store',
  'tsconfig.tsbuildinfo',
  'eslint.sweep.tmp.mjs',
  'build-error.txt',
  'build.log',
  'build2.log',
  'tsc-web.txt',
  'tsc-web2.txt',
  'tsc-web3.txt',
  'tsc-ui.txt',
  'cls',
  'npm',
  'electron-vite',
  'dir',
  'README.md',
  'LICENSE',
])

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts', '.json'])

const CONFIG_FILES = ['package.json', 'tsconfig.json', 'tsconfig.base.json', 'turbo.json']

export function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

export function computeSha256(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}

export function getGitHash() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return 'unknown'
  }
}

/**
 * Computes a combined hash of configuration files affecting indexing semantics
 */
export function computeConfigFingerprint(rootDir = ROOT) {
  const hashes = []
  for (const cfg of CONFIG_FILES) {
    const full = join(rootDir, cfg)
    if (existsSync(full)) {
      try {
        const content = readFileSync(full, 'utf8')
        hashes.push(`${cfg}:${computeSha256(content)}`)
      } catch {}
    }
  }
  hashes.push(`indexerVersion:${INDEXER_VERSION}`)
  return computeSha256(hashes.join('\n'))
}

/**
 * Categorizes package type by path
 */
function categorizePackage(pkgPath) {
  const norm = normalizePath(pkgPath)
  if (norm.startsWith('apps/')) return 'app'
  if (norm.startsWith('packages/')) return 'package'
  if (norm === 'backend') return 'backend'
  return 'unknown'
}

/**
 * Scans packages in monorepo
 */
export function scanWorkspacePackages(rootDir = ROOT) {
  const workspaces = ['apps/*', 'packages/*', 'backend']
  const packages = []

  for (const ws of workspaces) {
    if (ws.includes('*')) {
      const baseDir = join(rootDir, ws.split('*')[0])
      if (existsSync(baseDir)) {
        const entries = readdirSync(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) {
            const pkgPath = join(ws.split('*')[0], entry.name)
            const pkgJsonPath = join(rootDir, pkgPath, 'package.json')
            if (existsSync(pkgJsonPath)) {
              try {
                const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
                packages.push({
                  path: pkgPath,
                  name: pkg.name || basename(pkgPath),
                  version: pkg.version,
                  main: pkg.main,
                  types: pkg.types,
                  scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
                  dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
                  devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
                  peerDependencies: pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : [],
                  type: categorizePackage(pkgPath),
                })
              } catch {}
            }
          }
        }
      }
    } else {
      const pkgJsonPath = join(rootDir, ws, 'package.json')
      if (existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
          packages.push({
            path: ws,
            name: pkg.name || basename(ws),
            version: pkg.version,
            main: pkg.main,
            types: pkg.types,
            scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
            dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
            devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
            peerDependencies: pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : [],
            type: categorizePackage(ws),
          })
        } catch {}
      }
    }
  }

  packages.sort((a, b) => a.name.localeCompare(b.name))
  return packages
}

/**
 * Recursively scans directory for indexable source files
 */
export function getAllSourceFiles(dir, prefix = '') {
  const files = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          files.push(...getAllSourceFiles(join(dir, entry.name), join(prefix, entry.name)))
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name)
        if (
          SOURCE_EXTS.has(ext) &&
          !IGNORE_FILES.has(entry.name) &&
          !entry.name.endsWith('.d.ts')
        ) {
          files.push(normalizePath(join(prefix, entry.name)))
        }
      }
    }
  } catch {}
  return files
}

/**
 * Recursively scans test files
 */
export function getAllTestFiles(dir, prefix = '') {
  const testFiles = []
  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (
          !['node_modules', '.p', '.git', '.next', 'dist', 'build', '.turbo', 'coverage'].includes(
            entry.name,
          )
        ) {
          testFiles.push(...getAllTestFiles(join(dir, entry.name), join(prefix, entry.name)))
        }
      } else if (entry.isFile()) {
        if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(entry.name)) {
          testFiles.push(normalizePath(join(prefix, entry.name)))
        }
      }
    }
  } catch {}
  return testFiles
}

/**
 * Incremental Indexer Engine Class
 */
export class IncrementalIndexer {
  constructor(options = {}) {
    this.rootDir = options.rootDir || ROOT
    this.aiDir = options.aiDir || AI_DIR
    this.graphPath = options.graphPath || GRAPH_JSON
    this.cachePath = options.cachePath || CACHE_JSON
    this.backupPath = options.backupPath || BACKUP_JSON
  }

  /**
   * Loads the existing cache metadata if available
   */
  loadCache() {
    if (!existsSync(this.cachePath)) return null
    try {
      return JSON.parse(readFileSync(this.cachePath, 'utf8'))
    } catch {
      return null
    }
  }

  /**
   * Loads the existing graph.json if available with automatic backup recovery
   */
  loadGraph() {
    if (!existsSync(this.graphPath)) {
      if (existsSync(this.backupPath)) {
        return this.recoverFromBackup()
      }
      return null
    }
    try {
      const content = readFileSync(this.graphPath, 'utf8')
      if (!content || content.trim().length === 0) {
        throw new Error('graph.json is empty or truncated')
      }
      return JSON.parse(content)
    } catch {
      // Corrupt or truncated graph: attempt recovery from backup
      if (existsSync(this.backupPath)) {
        const recovered = this.recoverFromBackup()
        if (recovered) return recovered
      }
      return null
    }
  }

  /**
   * Recovers graph.json from graph.json.bak
   */
  recoverFromBackup() {
    if (!existsSync(this.backupPath)) return null
    try {
      const backupContent = readFileSync(this.backupPath, 'utf8')
      const parsed = JSON.parse(backupContent)
      writeFileSync(this.graphPath, backupContent, 'utf8')
      return parsed
    } catch {
      return null
    }
  }

  /**
   * Scans workspace and detects changes between disk files and cached fingerprints
   */
  detectChanges(cachedFingerprints = {}, currentPackages = []) {
    const allDiskFiles = []
    for (const pkg of currentPackages) {
      const pkgDir = join(this.rootDir, pkg.path)
      if (existsSync(pkgDir)) {
        allDiskFiles.push(...getAllSourceFiles(pkgDir, pkg.path))
      }
    }

    const normalizedCached = {}
    for (const [k, v] of Object.entries(cachedFingerprints)) {
      normalizedCached[normalizePath(k)] = v
    }

    const diskFileSet = new Set(allDiskFiles)
    const cachedFileSet = new Set(Object.keys(normalizedCached))

    const added = []
    const modified = []
    const deleted = []
    const unchanged = []
    const currentFingerprints = {}

    // Check disk files
    for (const file of allDiskFiles) {
      const fullPath = join(this.rootDir, file)
      let content = ''
      try {
        content = readFileSync(fullPath, 'utf8')
      } catch {
        continue
      }

      const hash = computeSha256(content)
      const cached = normalizedCached[file]

      currentFingerprints[file] = {
        hash,
        size: content.length,
        lines: content.split('\n').length,
      }

      if (!cached) {
        added.push(file)
      } else if (cached.hash !== hash) {
        modified.push(file)
      } else {
        unchanged.push(file)
      }
    }

    // Check deleted files
    for (const cachedFile of cachedFileSet) {
      if (!diskFileSet.has(cachedFile)) {
        deleted.push(cachedFile)
      }
    }

    // Detect renames (matching content hash between deleted and added)
    const renames = []
    const remainingAdded = []
    for (const addFile of added) {
      const addHash = currentFingerprints[addFile].hash
      const delMatch = deleted.find((d) => normalizedCached[d]?.hash === addHash)
      if (delMatch) {
        renames.push({ from: delMatch, to: addFile })
      } else {
        remainingAdded.push(addFile)
      }
    }

    return {
      added: remainingAdded,
      renames,
      modified,
      deleted,
      unchanged,
      totalDiskFiles: allDiskFiles.length,
      currentFingerprints,
    }
  }

  /**
   * Calculates the full invalidation set based on changed files and dependent graph edges
   */
  computeInvalidationSet(changes, existingGraph) {
    const directlyChanged = new Set([
      ...changes.added,
      ...changes.modified,
      ...changes.deleted,
      ...changes.renames.map((r) => r.from),
      ...changes.renames.map((r) => r.to),
    ])

    const dependentInvalidated = new Set()
    const affectedTestFiles = new Set()

    if (!existingGraph || !existingGraph.files || !existingGraph.relationships) {
      return {
        directlyChanged: Array.from(directlyChanged),
        dependentInvalidated: [],
        affectedTestFiles: [],
        requiresFullRebuild: true,
        reason: 'Missing existing graph or relationships for dependency traversal',
      }
    }

    // 1. Files importing directly changed files
    for (const changedFile of directlyChanged) {
      const fileData = existingGraph.files[changedFile]
      if (fileData?.importedBy) {
        for (const dep of fileData.importedBy) {
          if (!directlyChanged.has(dep)) {
            dependentInvalidated.add(dep)
          }
        }
      }

      // Also check incoming IMPORTS / CALLS relationships targeting this file
      for (const rel of existingGraph.relationships) {
        if (
          rel.targetId === changedFile ||
          rel.targetId.startsWith(`${changedFile}::`) ||
          rel.targetId.includes(changedFile)
        ) {
          if (rel.file && !directlyChanged.has(rel.file)) {
            if (rel.type === 'TESTS') {
              affectedTestFiles.add(rel.file)
            } else {
              dependentInvalidated.add(rel.file)
            }
          }
        }
      }
    }

    return {
      directlyChanged: Array.from(directlyChanged),
      dependentInvalidated: Array.from(dependentInvalidated),
      affectedTestFiles: Array.from(affectedTestFiles),
      requiresFullRebuild: false,
    }
  }

  /**
   * Atomically writes index and cache with backup protection
   */
  atomicPublish(candidateGraph, candidateCache) {
    const tmpGraph = `${this.graphPath}.tmp.${process.pid}`
    const tmpCache = `${this.cachePath}.tmp.${process.pid}`

    try {
      // 1. Write candidates to temporary files
      writeFileSync(tmpGraph, JSON.stringify(candidateGraph, null, 2), 'utf8')
      writeFileSync(tmpCache, JSON.stringify(candidateCache, null, 2), 'utf8')

      // 2. Validate written temporary files can be parsed cleanly
      JSON.parse(readFileSync(tmpGraph, 'utf8'))
      JSON.parse(readFileSync(tmpCache, 'utf8'))

      // 3. Backup existing graph if it exists
      if (existsSync(this.graphPath)) {
        try {
          copyFileSync(this.graphPath, this.backupPath)
        } catch {}
      }

      // 4. Two-phase replacement with rollback guarantee
      let graphReplaced = false
      try {
        this._safeReplace(tmpGraph, this.graphPath)
        graphReplaced = true
        this._safeReplace(tmpCache, this.cachePath)
      } catch (swapErr) {
        // Rollback graph from backup if graph was replaced but cache failed
        if (graphReplaced && existsSync(this.backupPath)) {
          try {
            copyFileSync(this.backupPath, this.graphPath)
          } catch {}
        }
        throw swapErr
      }

      return { success: true }
    } catch (err) {
      // Clean up temporary files on error
      if (existsSync(tmpGraph))
        try {
          unlinkSync(tmpGraph)
        } catch {}
      if (existsSync(tmpCache))
        try {
          unlinkSync(tmpCache)
        } catch {}
      throw new Error(`Atomic publication failed: ${err.message}`)
    }
  }

  _safeReplace(source, target) {
    try {
      renameSync(source, target)
    } catch {
      // Windows file lock / existing file fallback
      copyFileSync(source, target)
      unlinkSync(source)
    }
  }

  /**
   * Performs an incremental update
   */
  update(options = {}) {
    const isDryRun = options.dryRun === true
    const forceFull = options.forceFull === true

    const currentPackages = scanWorkspacePackages(this.rootDir)
    const currentConfigHash = computeConfigFingerprint(this.rootDir)
    const cachedCache = this.loadCache()
    const existingGraph = this.loadGraph()

    // Fallback to full rebuild if:
    // 1. forceFull is true
    // 2. No existing graph or cache
    // 3. Indexer or schema version mismatch
    // 4. Configuration fingerprint changed (tsconfig/path aliases)
    const needsFullRebuild =
      forceFull ||
      !existingGraph ||
      !cachedCache ||
      cachedCache.indexerVersion !== INDEXER_VERSION ||
      cachedCache.configHash !== currentConfigHash

    if (needsFullRebuild) {
      const reason = forceFull
        ? 'Explicit --full rebuild requested'
        : !existingGraph
          ? 'graph.json missing'
          : !cachedCache
            ? 'cache.json missing'
            : cachedCache.indexerVersion !== INDEXER_VERSION
              ? 'Indexer version upgraded'
              : 'Configuration fingerprint changed (tsconfig / package dependencies)'

      if (isDryRun) {
        return {
          mode: 'FULL_REBUILD',
          reason,
          dryRun: true,
        }
      }

      return this.rebuildFull({ reason })
    }

    const changes = this.detectChanges(cachedCache.fileFingerprints || {}, currentPackages)

    // Check if nothing changed
    const hasChanges =
      changes.added.length > 0 ||
      changes.modified.length > 0 ||
      changes.deleted.length > 0 ||
      changes.renames.length > 0

    if (!hasChanges) {
      return {
        mode: 'NO_OP',
        status: 'FRESH',
        message: 'Repository is up-to-date with index. 0 files modified.',
        stats: {
          added: 0,
          modified: 0,
          deleted: 0,
          renamed: 0,
          invalidated: 0,
          reprocessed: 0,
        },
      }
    }

    const invalidation = this.computeInvalidationSet(changes, existingGraph)

    if (invalidation.requiresFullRebuild) {
      return this.rebuildFull({ reason: invalidation.reason })
    }

    const reprocessFiles = Array.from(
      new Set([
        ...changes.added,
        ...changes.modified,
        ...changes.renames.map((r) => r.to),
        ...invalidation.dependentInvalidated,
      ]),
    )

    if (isDryRun) {
      return {
        mode: 'INCREMENTAL_UPDATE',
        dryRun: true,
        changes,
        invalidation,
        reprocessCount: reprocessFiles.length,
        reprocessFiles,
      }
    }

    // Perform incremental mutation on cloned existing graph data
    const aliases = loadPathAliases()
    const workspacePackages = loadWorkspacePackageMap(currentPackages)

    const updatedFiles = { ...existingGraph.files }
    const updatedSymbols = { ...existingGraph.symbols }
    let updatedRelationships = existingGraph.relationships.filter((rel) => {
      // Remove relationships owned by deleted files or reprocessed files
      if (changes.deleted.includes(rel.file)) return false
      if (reprocessFiles.includes(rel.file)) return false
      return true
    })

    // Remove obsolete symbols belonging to deleted or reprocessed files
    const obsoleteFiles = new Set([
      ...changes.deleted,
      ...reprocessFiles,
      ...changes.renames.map((r) => r.from),
    ])
    for (const [key, sym] of Object.entries(updatedSymbols)) {
      if (obsoleteFiles.has(sym.file)) {
        delete updatedSymbols[key]
      }
    }

    // Remove deleted files from fileData
    for (const del of changes.deleted) {
      delete updatedFiles[del]
    }

    // Reprocess changed and invalidated files
    for (const file of reprocessFiles) {
      const fullPath = join(this.rootDir, file)
      let content = ''
      try {
        content = readFileSync(fullPath, 'utf8')
      } catch {
        continue
      }

      const pkgInfo = currentPackages.find((p) => file.startsWith(p.path))
      const pkgName = pkgInfo ? pkgInfo.name : inferPackageName(file)

      // 1. Extract AST symbols
      const astSymbols = extractSymbolsFromSource(file, content, {
        packageName: pkgName,
        domain: 'SHARED',
        platform: 'SHARED',
      })

      for (const sym of astSymbols) {
        const primaryKey = `${file}::${sym.name}`
        if (!updatedSymbols[primaryKey]) {
          updatedSymbols[primaryKey] = sym
        } else {
          updatedSymbols[sym.id] = sym
        }
      }

      const exportedSymbols = astSymbols.filter((s) => s.exported)
      const exportNames =
        exportedSymbols.length > 0
          ? [...new Set(exportedSymbols.map((s) => s.name))]
          : astSymbols.map((s) => s.name)

      updatedFiles[file] = {
        imports: [],
        importedBy: updatedFiles[file]?.importedBy || [],
        platform: updatedFiles[file]?.platform || ['SHARED'],
        domain: updatedFiles[file]?.domain || ['SHARED'],
        exports: exportNames,
        size: content.length,
        lines: content.split('\n').length,
      }

      // 2. Extract relationships
      const fileRels = extractFileRelationships(file, content, {
        packageName: pkgName,
        aliases,
        workspacePackages,
        symbolIndex: updatedSymbols,
        fileSymbols: astSymbols,
      })

      updatedRelationships.push(...fileRels)
    }

    // Sort relationships deterministically by ID
    updatedRelationships.sort((a, b) => a.id.localeCompare(b.id))

    // Rebuild dependency graph
    const depGraph = buildDependencyGraph(updatedRelationships)

    // Recompute stats
    const relByType = {}
    let relResolved = 0
    let relUnresolved = 0
    let relExternal = 0
    let relAmbiguous = 0

    for (const r of updatedRelationships) {
      relByType[r.type] = (relByType[r.type] || 0) + 1
      if (r.status === 'RESOLVED') relResolved++
      else if (r.status === 'UNRESOLVED') relUnresolved++
      else if (r.status === 'EXTERNAL') relExternal++
      else if (r.status === 'AMBIGUOUS' || r.status === 'DYNAMIC_UNRESOLVED') relAmbiguous++
    }

    const resolvedCount = Object.values(updatedSymbols).filter(
      (s) => s.signatureStatus === 'resolved',
    ).length
    const partialCount = Object.values(updatedSymbols).filter(
      (s) => s.signatureStatus === 'partially_resolved',
    ).length
    const unresolvedCount = Object.values(updatedSymbols).filter(
      (s) => s.signatureStatus === 'unresolved',
    ).length

    const gitHash = getGitHash()
    const timestamp = new Date().toISOString()

    const candidateGraph = {
      metadata: {
        gitHash,
        timestamp,
        lastFullBuild: cachedCache.lastFullBuild || timestamp,
        lastIncrementalUpdate: timestamp,
        totalFiles: Object.keys(updatedFiles).length,
        totalSymbols: Object.keys(updatedSymbols).length,
        totalPackages: currentPackages.length,
        astStats: {
          resolved: resolvedCount,
          partiallyResolved: partialCount,
          unresolved: unresolvedCount,
        },
        relationshipStats: {
          total: updatedRelationships.length,
          byType: relByType,
          resolved: relResolved,
          unresolved: relUnresolved,
          external: relExternal,
          ambiguous: relAmbiguous,
          fileCycles: depGraph.cycles.totalFileCycles,
          packageCycles: depGraph.cycles.totalPackageCycles,
        },
      },
      packages: currentPackages,
      packageDeps: existingGraph.packageDeps || {},
      files: updatedFiles,
      symbols: updatedSymbols,
      relationships: updatedRelationships,
      dependencies: depGraph,
      routes: existingGraph.routes || [],
    }

    // Update fingerprint cache
    const updatedFingerprints = { ...cachedCache.fileFingerprints }
    for (const del of changes.deleted) {
      delete updatedFingerprints[del]
    }
    for (const ren of changes.renames) {
      delete updatedFingerprints[ren.from]
      updatedFingerprints[ren.to] = changes.currentFingerprints[ren.to]
    }
    for (const file of reprocessFiles) {
      updatedFingerprints[file] = changes.currentFingerprints[file]
    }

    const candidateCache = {
      schemaVersion: 1,
      indexerVersion: INDEXER_VERSION,
      configHash: currentConfigHash,
      lastFullBuild: cachedCache.lastFullBuild || timestamp,
      lastIncrementalUpdate: timestamp,
      fileFingerprints: updatedFingerprints,
    }

    // Atomically publish
    this.atomicPublish(candidateGraph, candidateCache)

    return {
      mode: 'INCREMENTAL_UPDATE',
      status: 'FRESH',
      changes,
      stats: {
        added: changes.added.length,
        modified: changes.modified.length,
        deleted: changes.deleted.length,
        renamed: changes.renames.length,
        invalidated: invalidation.dependentInvalidated.length,
        reprocessed: reprocessFiles.length,
        totalFiles: Object.keys(updatedFiles).length,
        totalSymbols: Object.keys(updatedSymbols).length,
        totalRelationships: updatedRelationships.length,
      },
    }
  }

  /**
   * Performs a clean full rebuild and writes initial cache
   */
  rebuildFull(options = {}) {
    const currentPackages = scanWorkspacePackages(this.rootDir)
    const currentConfigHash = computeConfigFingerprint(this.rootDir)
    const allFiles = []

    for (const pkg of currentPackages) {
      const pkgDir = join(this.rootDir, pkg.path)
      if (existsSync(pkgDir)) {
        allFiles.push(...getAllSourceFiles(pkgDir, pkg.path))
      }
    }

    const fileData = {}
    const symbolIndex = {}
    const packageDeps = {}
    const routes = []
    const aliases = loadPathAliases()
    const workspacePackages = loadWorkspacePackageMap(currentPackages)
    const allRelationships = []
    const fileFingerprints = {}

    for (const file of allFiles) {
      const fullPath = join(this.rootDir, file)
      let content = ''
      try {
        content = readFileSync(fullPath, 'utf8')
      } catch {
        continue
      }

      fileFingerprints[file] = {
        hash: computeSha256(content),
        size: content.length,
        lines: content.split('\n').length,
      }

      const pkgInfo = currentPackages.find((p) => file.startsWith(p.path))
      const pkgName = pkgInfo ? pkgInfo.name : inferPackageName(file)

      const astSymbols = extractSymbolsFromSource(file, content, {
        packageName: pkgName,
        domain: 'SHARED',
        platform: 'SHARED',
      })

      const exportedSymbols = astSymbols.filter((s) => s.exported)
      const exportNames =
        exportedSymbols.length > 0
          ? [...new Set(exportedSymbols.map((s) => s.name))]
          : astSymbols.map((s) => s.name)

      fileData[file] = {
        imports: [],
        importedBy: [],
        platform: ['SHARED'],
        domain: ['SHARED'],
        exports: exportNames,
        size: content.length,
        lines: content.split('\n').length,
      }

      for (const sym of astSymbols) {
        const primaryKey = `${file}::${sym.name}`
        if (!symbolIndex[primaryKey]) {
          symbolIndex[primaryKey] = sym
        } else {
          symbolIndex[sym.id] = sym
        }
      }

      const fileRels = extractFileRelationships(file, content, {
        packageName: pkgName,
        aliases,
        workspacePackages,
        symbolIndex,
        fileSymbols: astSymbols,
      })

      allRelationships.push(...fileRels)
    }

    // Test relationships
    const testFiles = getAllTestFiles(this.rootDir)
    for (const tFile of testFiles) {
      const fullPath = join(this.rootDir, tFile)
      let tContent = ''
      try {
        tContent = readFileSync(fullPath, 'utf8')
      } catch {
        continue
      }

      const tRels = extractFileRelationships(tFile, tContent, {
        aliases,
        workspacePackages,
        symbolIndex,
      })
      for (const r of tRels) {
        if (r.type === 'TESTS') {
          allRelationships.push(r)
        }
      }
    }

    allRelationships.sort((a, b) => a.id.localeCompare(b.id))
    const depGraph = buildDependencyGraph(allRelationships)

    const relByType = {}
    let relResolved = 0
    let relUnresolved = 0
    let relExternal = 0
    let relAmbiguous = 0

    for (const r of allRelationships) {
      relByType[r.type] = (relByType[r.type] || 0) + 1
      if (r.status === 'RESOLVED') relResolved++
      else if (r.status === 'UNRESOLVED') relUnresolved++
      else if (r.status === 'EXTERNAL') relExternal++
      else if (r.status === 'AMBIGUOUS' || r.status === 'DYNAMIC_UNRESOLVED') relAmbiguous++
    }

    const resolvedCount = Object.values(symbolIndex).filter(
      (s) => s.signatureStatus === 'resolved',
    ).length
    const partialCount = Object.values(symbolIndex).filter(
      (s) => s.signatureStatus === 'partially_resolved',
    ).length
    const unresolvedCount = Object.values(symbolIndex).filter(
      (s) => s.signatureStatus === 'unresolved',
    ).length

    const gitHash = getGitHash()
    const timestamp = new Date().toISOString()

    const graph = {
      metadata: {
        gitHash,
        timestamp,
        lastFullBuild: timestamp,
        lastIncrementalUpdate: timestamp,
        totalFiles: allFiles.length,
        totalSymbols: Object.keys(symbolIndex).length,
        totalPackages: currentPackages.length,
        astStats: {
          resolved: resolvedCount,
          partiallyResolved: partialCount,
          unresolved: unresolvedCount,
        },
        relationshipStats: {
          total: allRelationships.length,
          byType: relByType,
          resolved: relResolved,
          unresolved: relUnresolved,
          external: relExternal,
          ambiguous: relAmbiguous,
          fileCycles: depGraph.cycles.totalFileCycles,
          packageCycles: depGraph.cycles.totalPackageCycles,
        },
      },
      packages: currentPackages,
      packageDeps,
      files: fileData,
      symbols: symbolIndex,
      relationships: allRelationships,
      dependencies: depGraph,
      routes,
    }

    const cache = {
      schemaVersion: 1,
      indexerVersion: INDEXER_VERSION,
      configHash: currentConfigHash,
      lastFullBuild: timestamp,
      lastIncrementalUpdate: timestamp,
      fileFingerprints,
    }

    this.atomicPublish(graph, cache)

    return {
      mode: 'FULL_REBUILD',
      status: 'FRESH',
      reason: options.reason || 'Requested full rebuild',
      stats: {
        totalFiles: allFiles.length,
        totalSymbols: Object.keys(symbolIndex).length,
        totalRelationships: allRelationships.length,
      },
    }
  }

  /**
   * Compares an incremental graph against a clean full rebuild graph
   * Returns { equivalent: boolean, differences: string[] }
   */
  static compareSemanticEquivalence(incrementalGraph, fullGraph) {
    const diffs = []

    // 1. Files equivalence
    const incFiles = Object.keys(incrementalGraph.files || {}).sort()
    const fullFiles = Object.keys(fullGraph.files || {}).sort()

    if (incFiles.length !== fullFiles.length) {
      diffs.push(`File count mismatch: incremental=${incFiles.length}, full=${fullFiles.length}`)
    }
    for (let i = 0; i < Math.min(incFiles.length, fullFiles.length); i++) {
      if (incFiles[i] !== fullFiles[i]) {
        diffs.push(`File mismatch at index ${i}: '${incFiles[i]}' vs '${fullFiles[i]}'`)
        break
      }
    }

    // 2. Symbols equivalence
    const incSymbols = Object.keys(incrementalGraph.symbols || {}).sort()
    const fullSymbols = Object.keys(fullGraph.symbols || {}).sort()

    if (incSymbols.length !== fullSymbols.length) {
      diffs.push(
        `Symbol count mismatch: incremental=${incSymbols.length}, full=${fullSymbols.length}`,
      )
    }

    for (let i = 0; i < Math.min(incSymbols.length, fullSymbols.length); i++) {
      const key = incSymbols[i]
      if (key !== fullSymbols[i]) {
        diffs.push(`Symbol key mismatch at index ${i}: '${key}' vs '${fullSymbols[i]}'`)
        break
      }
      const incSym = incrementalGraph.symbols[key]
      const fullSym = fullGraph.symbols[key]
      if (incSym.signature !== fullSym.signature) {
        diffs.push(
          `Symbol signature mismatch for '${key}': '${incSym.signature}' vs '${fullSym.signature}'`,
        )
      }
    }

    // 3. Relationships equivalence (Count + Deep Identity & Properties)
    const incRels = incrementalGraph.relationships || []
    const fullRels = fullGraph.relationships || []

    if (incRels.length !== fullRels.length) {
      diffs.push(
        `Relationship count mismatch: incremental=${incRels.length}, full=${fullRels.length}`,
      )
    }

    const fullRelMap = new Map(fullRels.map((r) => [r.id, r]))
    for (const incR of incRels) {
      const fullR = fullRelMap.get(incR.id)
      if (!fullR) {
        diffs.push(`Relationship '${incR.id}' present in incremental but missing in full rebuild`)
      } else {
        if (incR.sourceId !== fullR.sourceId) {
          diffs.push(
            `Relationship '${incR.id}' sourceId mismatch: '${incR.sourceId}' vs '${fullR.sourceId}'`,
          )
        }
        if (incR.targetId !== fullR.targetId) {
          diffs.push(
            `Relationship '${incR.id}' targetId mismatch: '${incR.targetId}' vs '${fullR.targetId}'`,
          )
        }
        if (incR.type !== fullR.type) {
          diffs.push(`Relationship '${incR.id}' type mismatch: '${incR.type}' vs '${fullR.type}'`)
        }
        if (incR.status !== fullR.status) {
          diffs.push(
            `Relationship '${incR.id}' status mismatch: '${incR.status}' vs '${fullR.status}'`,
          )
        }
      }
    }

    // 4. File-level imports / exports equivalence
    for (const file of incFiles) {
      const incF = incrementalGraph.files[file]
      const fullF = fullGraph.files[file]
      if (incF && fullF) {
        const incExports = (incF.exports || []).slice().sort()
        const fullExports = (fullF.exports || []).slice().sort()
        if (incExports.join(',') !== fullExports.join(',')) {
          diffs.push(`File exports mismatch for '${file}': [${incExports}] vs [${fullExports}]`)
        }
        const incImports = (incF.imports || []).slice().sort()
        const fullImports = (fullF.imports || []).slice().sort()
        if (incImports.join(',') !== fullImports.join(',')) {
          diffs.push(`File imports mismatch for '${file}': [${incImports}] vs [${fullImports}]`)
        }
      }
    }

    // 5. Orphan Detection (Strict Anti-Orphan Verification)
    const incFileSet = new Set(incFiles)
    for (const [symId, sym] of Object.entries(incrementalGraph.symbols || {})) {
      if (sym.file && !incFileSet.has(sym.file)) {
        diffs.push(
          `Orphaned symbol detected: '${symId}' references non-existent file '${sym.file}'`,
        )
      }
    }
    for (const rel of incRels) {
      if (rel.file && !incFileSet.has(rel.file)) {
        diffs.push(
          `Orphaned relationship detected: '${rel.id}' references non-existent file '${rel.file}'`,
        )
      }
    }

    // 6. Cycles equivalence
    const incCycles = incrementalGraph.dependencies?.cycles?.totalFileCycles || 0
    const fullCycles = fullGraph.dependencies?.cycles?.totalFileCycles || 0
    if (incCycles !== fullCycles) {
      diffs.push(`File cycles mismatch: incremental=${incCycles}, full=${fullCycles}`)
    }

    return {
      equivalent: diffs.length === 0,
      differences: diffs,
    }
  }
}
