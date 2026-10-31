/**
 * Shared Code Intelligence Query Engine for Hisabche
 * Evidence-first, anti-hallucination query core over canonical graph.json
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, resolve, relative, normalize } from 'node:path'
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { computeConfigFingerprint } from './incremental-indexer.mjs'

const ROOT = process.cwd()
const GRAPH_PATH = join(ROOT, '.ai', 'codebase', 'graph.json')
const CACHE_PATH = join(ROOT, '.ai', 'codebase', 'cache.json')

/**
 * Normalizes file path to forward slashes relative to root
 */
function normalizePath(p) {
  if (!p) return ''
  const rel = relative(ROOT, resolve(ROOT, p))
  return rel.replace(/\\/g, '/')
}

/**
 * Computes SHA-256 hash of normalized LF content
 */
function computeSha256(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * CodeIntelQueryEngine Class
 */
export class CodeIntelQueryEngine {
  constructor(options = {}) {
    const opts = typeof options === 'string' ? { graphPath: options } : options
    this.graphPath = opts.graphPath || GRAPH_PATH
    this.preloadedIndex = opts.preloadedIndex || null
    this.graph = null
    this.symbolsById = new Map()
    this.symbolsByName = new Map()
    this.symbolsByFile = new Map()
    this.incomingRels = new Map() // targetId -> Array<Relationship>
    this.outgoingRels = new Map() // sourceId -> Array<Relationship>
    this.fileIncomingRels = new Map() // targetFile -> Array<Relationship>
    this.fileOutgoingRels = new Map() // sourceFile -> Array<Relationship>
    this.loaded = false
  }

  /**
   * Loads and indexes the graph into in-memory lookup maps
   */
  load() {
    if (this.loaded) return this

    let parsed
    if (this.preloadedIndex) {
      parsed = this.preloadedIndex
    } else {
      if (!existsSync(this.graphPath)) {
        throw new Error(
          `Code intelligence index not found at ${this.graphPath}. Run 'node scripts/build-ai-index.mjs' first.`,
        )
      }

      try {
        parsed = JSON.parse(readFileSync(this.graphPath, 'utf8'))
      } catch (err) {
        throw new Error(`Failed to parse code intelligence graph: ${err.message}`)
      }
    }

    this.graph = parsed

    // 1. Index symbols (support both Object map and Array)
    const symbolList = Array.isArray(parsed.symbols)
      ? parsed.symbols
      : Object.values(parsed.symbols || {})

    for (const rawSym of symbolList) {
      const sym = {
        ...rawSym,
        id: rawSym.id || rawSym.symbolId,
        package: rawSym.package || rawSym.pkg,
        exported: rawSym.exported !== undefined ? rawSym.exported : rawSym.isExported,
        doc: rawSym.doc || rawSym.documentation,
      }
      this.symbolsById.set(sym.id, sym)
      if (rawSym.symbolId && rawSym.symbolId !== sym.id) {
        this.symbolsById.set(rawSym.symbolId, sym)
      }

      if (!this.symbolsByName.has(sym.name)) {
        this.symbolsByName.set(sym.name, [])
      }
      this.symbolsByName.get(sym.name).push(sym)

      if (sym.file) {
        if (!this.symbolsByFile.has(sym.file)) {
          this.symbolsByFile.set(sym.file, [])
        }
        this.symbolsByFile.get(sym.file).push(sym)
      }
    }

    // 2. Index relationships
    for (const rawRel of parsed.relationships || []) {
      const rel = {
        ...rawRel,
        sourceId: rawRel.sourceId || rawRel.sourceSymbolId,
      }
      // Outgoing
      if (!this.outgoingRels.has(rel.sourceId)) {
        this.outgoingRels.set(rel.sourceId, [])
      }
      this.outgoingRels.get(rel.sourceId).push(rel)

      // Incoming
      if (!this.incomingRels.has(rel.targetId)) {
        this.incomingRels.set(rel.targetId, [])
      }
      this.incomingRels.get(rel.targetId).push(rel)

      // File level
      if (rel.file) {
        if (!this.fileOutgoingRels.has(rel.file)) {
          this.fileOutgoingRels.set(rel.file, [])
        }
        this.fileOutgoingRels.get(rel.file).push(rel)
      }

      if (rel.targetId && !rel.targetId.includes('#') && !rel.targetId.includes('::')) {
        if (!this.fileIncomingRels.has(rel.targetId)) {
          this.fileIncomingRels.set(rel.targetId, [])
        }
        this.fileIncomingRels.get(rel.targetId).push(rel)
      }
    }

    this.loaded = true
    return this
  }

  /**
   * Ensures engine is loaded
   */
  _ensureLoaded() {
    if (!this.loaded) this.load()
  }

  /**
   * Resolves a symbol identifier or name to exact symbol card(s)
   */
  resolveSymbol(symbolIdOrName) {
    this._ensureLoaded()
    if (!symbolIdOrName) return []

    // Direct ID match
    if (this.symbolsById.has(symbolIdOrName)) {
      return [this.symbolsById.get(symbolIdOrName)]
    }

    // Direct name match
    if (this.symbolsByName.has(symbolIdOrName)) {
      return this.symbolsByName.get(symbolIdOrName)
    }

    return []
  }

  /**
   * Exact and fuzzy symbol search with filters
   */
  findSymbols(query, filters = {}) {
    this._ensureLoaded()
    const q = (query || '').trim()
    const isExact = filters.exact === true
    const limit = filters.limit || 50
    const results = []

    if (!q) return { results: [], totalFound: 0, query: q, searchScope: filters }

    for (const sym of this.symbolsById.values()) {
      // Deduplicate aliased keys pointing to same symbol card
      if (results.some((r) => r.id === sym.id)) continue

      let matches = false
      if (isExact) {
        matches = sym.name === q || sym.id === q
      } else {
        const lowerQ = q.toLowerCase()
        matches =
          sym.name.toLowerCase().includes(lowerQ) ||
          sym.id.toLowerCase().includes(lowerQ) ||
          (sym.signature && sym.signature.toLowerCase().includes(lowerQ))
      }

      if (!matches) continue

      // Apply explicit filters
      const targetPkg = filters.package || filters.pkg
      if (filters.kind && sym.kind !== filters.kind) continue
      if (targetPkg && sym.package !== targetPkg) continue
      if (filters.file && !sym.file.includes(filters.file)) continue
      if (filters.domain && sym.domain !== filters.domain) continue
      if (filters.exported !== undefined && sym.exported !== filters.exported) continue

      results.push(sym)
      if (results.length >= limit) break
    }

    // Sort: exact name first, then shorter names, then alphabetical
    results.sort((a, b) => {
      if (a.name === q && b.name !== q) return -1
      if (b.name === q && a.name !== q) return 1
      if (a.name.length !== b.name.length) return a.name.length - b.name.length
      return a.name.localeCompare(b.name)
    })

    return {
      query: q,
      searchScope: filters,
      isExact,
      totalFound: results.length,
      results,
    }
  }

  /**
   * Retrieves single exact symbol by ID or name
   */
  getSymbol(symbolIdOrName) {
    this._ensureLoaded()
    const matches = this.resolveSymbol(symbolIdOrName)

    if (matches.length === 0) {
      // Suggest fuzzy alternatives
      const fuzzy = this.findSymbols(symbolIdOrName, { exact: false, limit: 5 })
      return {
        found: false,
        symbol: null,
        error: `Symbol '${symbolIdOrName}' not found in index.`,
        candidates: fuzzy.results.map((c) => ({ id: c.id, name: c.name, file: c.file })),
      }
    }

    if (matches.length > 1) {
      return {
        found: true,
        ambiguous: true,
        symbol: matches[0],
        allMatches: matches,
        warning: `Multiple symbols named '${symbolIdOrName}' exist across different files. Showing first candidate. Specify full symbol ID for exact target.`,
      }
    }

    return {
      found: true,
      ambiguous: false,
      symbol: matches[0],
    }
  }

  /**
   * Retrieves all verified callers of a symbol
   */
  getCallers(symbolIdOrName, options = {}) {
    this._ensureLoaded()
    const symRes = this.getSymbol(symbolIdOrName)
    const verifiedOnly = options.verifiedOnly === true
    const limit = options.limit || 100

    if (!symRes.found) {
      return { target: symbolIdOrName, totalFound: 0, callers: [], error: symRes.error }
    }

    const targetSymbols = symRes.ambiguous ? symRes.allMatches : [symRes.symbol]
    const targetIds = new Set(targetSymbols.map((s) => s.id))
    for (const sym of targetSymbols) {
      targetIds.add(`${sym.file}::${sym.name}`)
      targetIds.add(sym.name)
    }

    const callers = []
    const seenRel = new Set()

    for (const targetId of targetIds) {
      const incoming = this.incomingRels.get(targetId) || []
      for (const rel of incoming) {
        if (rel.type !== 'CALLS' && rel.type !== 'INSTANTIATES') continue
        if (verifiedOnly && rel.status !== 'RESOLVED') continue
        if (seenRel.has(rel.id)) continue
        seenRel.add(rel.id)

        const callerSym = this.symbolsById.get(rel.sourceId) || null
        callers.push({
          relationshipId: rel.id,
          type: rel.type,
          callerSymbolId: rel.sourceId,
          callerSymbolName: callerSym ? callerSym.name : rel.sourceId.split('#')[1] || rel.sourceId,
          callerFile: rel.file,
          line: rel.startLine,
          column: rel.startColumn,
          rawIdentifier: rel.rawIdentifier,
          status: rel.status,
          evidence: rel.evidence,
        })

        if (callers.length >= limit) break
      }
      if (callers.length >= limit) break
    }

    return {
      target: symRes.symbol.id,
      targetName: symRes.symbol.name,
      totalFound: callers.length,
      callers,
    }
  }

  /**
   * Retrieves all callees called by a symbol
   */
  getCallees(symbolIdOrName, options = {}) {
    this._ensureLoaded()
    const symRes = this.getSymbol(symbolIdOrName)
    const verifiedOnly = options.verifiedOnly === true
    const limit = options.limit || 100

    if (!symRes.found) {
      return { target: symbolIdOrName, totalFound: 0, callees: [], error: symRes.error }
    }

    const outgoing = this.outgoingRels.get(symRes.symbol.id) || []
    const callees = []

    for (const rel of outgoing) {
      if (rel.type !== 'CALLS' && rel.type !== 'INSTANTIATES') continue
      if (verifiedOnly && rel.status !== 'RESOLVED') continue

      const targetSym = this.symbolsById.get(rel.targetId) || null
      callees.push({
        relationshipId: rel.id,
        type: rel.type,
        targetSymbolId: rel.targetId,
        targetSymbolName: targetSym ? targetSym.name : rel.rawIdentifier,
        file: rel.file,
        line: rel.startLine,
        column: rel.startColumn,
        rawIdentifier: rel.rawIdentifier,
        status: rel.status,
        evidence: rel.evidence,
      })

      if (callees.length >= limit) break
    }

    return {
      source: symRes.symbol.id,
      totalFound: callees.length,
      callees,
    }
  }

  /**
   * Retrieves imports and re-exports for a file or symbol
   */
  getImports(filePathOrSymbol) {
    this._ensureLoaded()
    let normFile = normalizePath(filePathOrSymbol)

    // If a symbol ID was passed, find its containing file
    if (this.symbolsById.has(filePathOrSymbol)) {
      normFile = this.symbolsById.get(filePathOrSymbol).file
    }

    const rels = this.fileOutgoingRels.get(normFile) || []
    const imports = []
    const reExports = []

    for (const rel of rels) {
      if (rel.type === 'IMPORTS' || rel.type === 'DYNAMIC_IMPORTS') {
        imports.push({
          type: rel.type,
          specifier: rel.rawIdentifier,
          resolvedTarget: rel.targetId,
          status: rel.status,
          line: rel.startLine,
          evidence: rel.evidence,
        })
      } else if (rel.type === 'RE_EXPORTS') {
        reExports.push({
          specifier: rel.rawIdentifier,
          resolvedTarget: rel.targetId,
          status: rel.status,
          line: rel.startLine,
          evidence: rel.evidence,
        })
      }
    }

    return {
      file: normFile,
      totalImports: imports.length,
      totalReExports: reExports.length,
      imports,
      reExports,
    }
  }

  /**
   * Retrieves test files and test relationships associated with a symbol
   */
  getRelatedTests(symbolIdOrName) {
    this._ensureLoaded()
    const symRes = this.getSymbol(symbolIdOrName)
    if (!symRes.found) {
      return { target: symbolIdOrName, totalTests: 0, tests: [], error: symRes.error }
    }

    const targetSymbols = symRes.ambiguous ? symRes.allMatches : [symRes.symbol]
    const targetIds = new Set(targetSymbols.map((s) => s.id))
    for (const sym of targetSymbols) {
      targetIds.add(`${sym.file}::${sym.name}`)
      targetIds.add(sym.name)
    }

    const tests = []
    const seen = new Set()

    for (const targetId of targetIds) {
      const incoming = this.incomingRels.get(targetId) || []
      for (const rel of incoming) {
        if (rel.type !== 'TESTS') continue
        if (seen.has(rel.sourceId)) continue
        seen.add(rel.sourceId)

        tests.push({
          relationshipId: rel.id,
          testFile: rel.sourceId || rel.file,
          targetSymbol: rel.targetId,
          evidence: rel.evidence,
          status: rel.status,
        })
      }
    }

    return {
      targetSymbol: symRes.symbol.id,
      totalTests: tests.length,
      tests,
    }
  }

  /**
   * Retrieves detailed file metadata, exports, and relationships
   */
  getFile(filePath) {
    this._ensureLoaded()
    const norm = normalizePath(filePath)
    const fileEntry = this.graph.files ? this.graph.files[norm] : null

    if (!fileEntry && !existsSync(join(ROOT, norm))) {
      return { found: false, file: norm, error: `File '${norm}' not found in index or disk.` }
    }

    const symbols = this.symbolsByFile.get(norm) || []
    const imports = this.getImports(norm)
    const dependents = []

    const incoming = this.fileIncomingRels.get(norm) || []
    for (const rel of incoming) {
      if (!dependents.includes(rel.file)) {
        dependents.push(rel.file)
      }
    }

    return {
      found: true,
      file: norm,
      platform: fileEntry ? fileEntry.platform : ['UNKNOWN'],
      domain: fileEntry ? fileEntry.domain : ['UNKNOWN'],
      totalSymbols: symbols.length,
      symbols: symbols.map((s) => ({
        id: s.id,
        name: s.name,
        kind: s.kind,
        line: s.startLine,
        exported: s.exported,
      })),
      imports: imports.imports,
      reExports: imports.reExports,
      directDependents: dependents,
    }
  }

  /**
   * Bounded static impact analysis for a symbol or file
   */
  getImpactSummary(symbolIdOrFile, options = {}) {
    this._ensureLoaded()
    const maxDepth = options.depth || 3
    const maxResults = options.limit || 50

    const isSymbol = this.symbolsById.has(symbolIdOrFile) || this.symbolsByName.has(symbolIdOrFile)
    const symRes = isSymbol ? this.getSymbol(symbolIdOrFile) : null

    const targetId = symRes && symRes.found ? symRes.symbol.id : normalizePath(symbolIdOrFile)
    const targetFile = symRes && symRes.found ? symRes.symbol.file : targetId

    // 1. Direct callers & callees
    const callers = isSymbol ? this.getCallers(targetId, { limit: maxResults }).callers : []
    const callees = isSymbol ? this.getCallees(targetId, { limit: maxResults }).callees : []

    // 2. Direct dependencies & dependents
    const fileInfo = this.getFile(targetFile)
    const directDependencies = fileInfo.imports.map((i) => i.resolvedTarget).filter(Boolean)
    const directDependents = fileInfo.directDependents

    // 3. Related tests
    const relatedTests = isSymbol ? this.getRelatedTests(targetId).tests : []

    // 4. Bounded transitive dependent traversal
    const transitiveDependents = new Set()
    const visitedFiles = new Set([targetFile])
    let queue = [targetFile]
    let currentDepth = 0
    let truncated = false

    while (queue.length > 0 && currentDepth < maxDepth) {
      currentDepth++
      const nextQueue = []

      for (const f of queue) {
        const incoming = this.fileIncomingRels.get(f) || []
        for (const rel of incoming) {
          if (!visitedFiles.has(rel.file)) {
            visitedFiles.add(rel.file)
            transitiveDependents.add(rel.file)
            nextQueue.push(rel.file)
            if (transitiveDependents.size >= maxResults) {
              truncated = true
              break
            }
          }
        }
        if (truncated) break
      }
      if (truncated) break
      queue = nextQueue
    }

    // 5. Relevant cycles
    const relevantCycles = []
    if (this.graph.dependencies?.cycles?.fileCycles) {
      for (const cyc of this.graph.dependencies.cycles.fileCycles) {
        if (cyc.participatingNodes.includes(targetFile)) {
          relevantCycles.push(cyc)
        }
      }
    }

    return {
      target: targetId,
      targetFile,
      isSymbol,
      depth: currentDepth,
      maxDepth,
      truncated,
      directCallers: callers,
      directCallees: callees,
      directDependencies,
      directDependents,
      transitiveDependents: Array.from(transitiveDependents),
      relatedTests,
      relevantCycles,
    }
  }

  /**
   * Retrieves source excerpt with security checks and freshness verification
   */
  getSourceExcerpt(symbolIdOrFile, options = {}) {
    this._ensureLoaded()
    const contextLines = options.contextLines !== undefined ? options.contextLines : 3

    let targetFile = ''
    let startLine = 1
    let endLine = 1
    let indexedSourceHash = ''
    let indexedFileHash = ''
    let symbolId = null

    // Determine target file and lines
    if (this.symbolsById.has(symbolIdOrFile)) {
      const sym = this.symbolsById.get(symbolIdOrFile)
      targetFile = sym.file
      startLine = sym.startLine
      endLine = sym.endLine
      indexedSourceHash = sym.sourceHash
      indexedFileHash = sym.fileHash
      symbolId = sym.id
    } else {
      const symRes = this.getSymbol(symbolIdOrFile)
      if (symRes.found) {
        const sym = symRes.symbol
        targetFile = sym.file
        startLine = sym.startLine
        endLine = sym.endLine
        indexedSourceHash = sym.sourceHash
        indexedFileHash = sym.fileHash
        symbolId = sym.id
      } else {
        targetFile = normalizePath(symbolIdOrFile)
        if (options.startLine !== undefined) startLine = options.startLine
        if (options.endLine !== undefined) endLine = options.endLine
      }
    }

    if (options.startLine !== undefined) startLine = options.startLine
    if (options.endLine !== undefined) endLine = options.endLine

    // Security checks: prevent path traversal outside repository
    const resolvedPath = resolve(ROOT, targetFile)
    const rel = relative(ROOT, resolvedPath)
    if (rel.startsWith('..') || resolve(resolvedPath) !== resolvedPath.replace(/\\/g, '\\')) {
      // Check for path traversal attempt
      if (rel.startsWith('..')) {
        return {
          success: false,
          error: 'Security rejection: Path traversal outside repository root is forbidden.',
        }
      }
    }

    // Check forbidden files
    if (targetFile.includes('.env') || targetFile.includes('node_modules')) {
      return {
        success: false,
        error: 'Security rejection: Access to sensitive or excluded files is forbidden.',
      }
    }

    if (!existsSync(resolvedPath) || !statSync(resolvedPath).isFile()) {
      return {
        success: false,
        error: `Source file '${targetFile}' does not exist on disk.`,
      }
    }

    const currentCode = readFileSync(resolvedPath, 'utf8')
    const currentFileHash = computeSha256(currentCode)
    const isStale = indexedFileHash ? currentFileHash !== indexedFileHash : false

    const lines = currentCode.split(/\r?\n/)
    const totalLines = lines.length

    const fromLine = Math.max(1, startLine - contextLines)
    const toLine = Math.min(totalLines, endLine + contextLines)
    const excerptLines = lines.slice(fromLine - 1, toLine)

    return {
      success: true,
      file: targetFile,
      symbolId,
      startLine,
      endLine,
      contextFromLine: fromLine,
      contextToLine: toLine,
      totalFileLines: totalLines,
      isStale,
      staleWarning: isStale
        ? 'Source file modified since index was built. Line numbers and hashes may differ. Rebuild with node scripts/build-ai-index.mjs'
        : null,
      currentFileHash,
      indexedFileHash,
      indexedSourceHash,
      excerpt: excerptLines.join('\n'),
      linesWithNumbers: excerptLines.map((l, i) => `${fromLine + i} | ${l}`).join('\n'),
    }
  }

  /**
   * Retrieves index health, schema version, and staleness status
   */
  getIndexStatus() {
    if (!existsSync(this.graphPath)) {
      return {
        status: 'MISSING',
        message: 'Index graph.json does not exist. Run node scripts/build-ai-index.mjs',
      }
    }

    try {
      this._ensureLoaded()
    } catch (loadErr) {
      return {
        status: 'CORRUPT',
        message: `Index graph is corrupted: ${loadErr.message}. Run pnpm code-intel update --full`,
      }
    }

    if (!this.graph || !this.graph.symbols) {
      return {
        status: 'CORRUPT',
        message: 'Index graph.json is corrupted or unparseable. Run pnpm code-intel update --full',
      }
    }

    const metadata = this.graph.metadata || {}
    const stalenessReasons = []

    // 1. Check configuration fingerprint
    let configMatch = true
    if (existsSync(CACHE_PATH)) {
      try {
        const cacheData = JSON.parse(readFileSync(CACHE_PATH, 'utf8'))
        const currentConfig = computeConfigFingerprint(ROOT)
        if (cacheData.configHash && cacheData.configHash !== currentConfig) {
          configMatch = false
          stalenessReasons.push(
            'Configuration or path aliases modified (tsconfig/package.json changed)',
          )
        }
      } catch {}
    }

    // 2. Check git staleness
    let currentGitHead = 'unknown'
    try {
      currentGitHead = execSync('git rev-parse HEAD', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim()
    } catch {}

    const gitMatch =
      metadata.gitHash && currentGitHead !== 'unknown' ? metadata.gitHash === currentGitHead : true
    if (!gitMatch) {
      stalenessReasons.push(
        `Git HEAD mismatch: indexed=${metadata.gitHash?.substring(0, 8)}, current=${currentGitHead.substring(0, 8)}`,
      )
    }

    // 3. Sample 20 files to check hash match
    let sampledFilesCount = 0
    let staleFilesCount = 0

    const filesToSample = Object.keys(this.graph.files || {}).slice(0, 20)
    for (const f of filesToSample) {
      const full = join(ROOT, f)
      if (existsSync(full)) {
        sampledFilesCount++
        const code = readFileSync(full, 'utf8')
        const h = computeSha256(code)
        // Check symbol in file
        const syms = this.symbolsByFile.get(f) || []
        if (syms.length > 0 && syms[0].fileHash && syms[0].fileHash !== h) {
          staleFilesCount++
        }
      } else {
        staleFilesCount++
      }
    }

    if (staleFilesCount > 0) {
      stalenessReasons.push(
        `${staleFilesCount} of ${sampledFilesCount} sampled files have modified content on disk`,
      )
    }

    let status = 'FRESH'
    if (!configMatch) {
      status = 'STALE'
    } else if (!gitMatch || staleFilesCount > 0) {
      status = staleFilesCount > 5 ? 'STALE' : 'PARTIALLY_STALE'
    }

    return {
      status,
      schemaVersion: 2,
      stalenessReasons,
      indexedGitHash: metadata.gitHash,
      currentGitHead,
      gitMatch,
      configMatch,
      timestamp: metadata.timestamp,
      lastFullBuild: metadata.lastFullBuild || metadata.timestamp,
      lastIncrementalUpdate: metadata.lastIncrementalUpdate || metadata.timestamp,
      totalFiles: metadata.totalFiles,
      totalSymbols: metadata.totalSymbols,
      totalPackages: metadata.totalPackages,
      astStats: metadata.astStats,
      relationshipStats: metadata.relationshipStats,
      sampledFilesChecked: sampledFilesCount,
      sampledStaleFiles: staleFilesCount,
    }
  }
}
