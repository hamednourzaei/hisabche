/**
 * Shared Code Intelligence Query Engine for Hisabche
 * Evidence-first, anti-hallucination query core over canonical graph.json
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, relative, normalize } from 'node:path'
import { execSync } from 'node:child_process'
import crypto from 'node:crypto'
import { computeConfigFingerprint } from './incremental-indexer.mjs'
import { classifyFileDomainAndPlatform } from './domain-classifier.mjs'
import {
  expandQueryTokens,
  queryLexicalIndex,
  tokenizeText,
  MAX_INDEX_FILE_BYTES,
  MAX_QUERY_LENGTH,
} from './lexical-index.mjs'

const ROOT = process.cwd()
const GRAPH_PATH = join(ROOT, '.ai', 'codebase', 'graph.json')
const CACHE_PATH = join(ROOT, '.ai', 'codebase', 'cache.json')
const LEXICAL_PATH = join(ROOT, '.ai', 'codebase', 'lexical.json')

const FORBIDDEN_PATH_PATTERNS = ['.env', '.pem', '.key', '.p12', '.pfx', '.secret', 'node_modules']

function isForbiddenPath(filePath) {
  const lower = (filePath || '').toLowerCase()
  return FORBIDDEN_PATH_PATTERNS.some((pat) => lower.includes(pat))
}

function estimateTokens(objOrStr) {
  const str = typeof objOrStr === 'string' ? objOrStr : JSON.stringify(objOrStr)
  return Math.ceil(str.length / 4)
}

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
    this.cachePath = opts.cachePath || join(dirname(this.graphPath), 'cache.json')
    this.lexicalPath = opts.lexicalPath || join(dirname(this.graphPath), 'lexical.json')
    this.preloadedIndex = opts.preloadedIndex || null
    this.preloadedLexical = opts.preloadedLexical || null
    this.graph = null
    this.lexical = null
    this.queryCache = new Map()
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

    // 3. Load persisted lexical index or construct lightweight in-memory index from graph
    if (this.preloadedLexical) {
      this.lexical = this.preloadedLexical
    } else if (!this.preloadedIndex && existsSync(this.lexicalPath)) {
      try {
        this.lexical = JSON.parse(readFileSync(this.lexicalPath, 'utf8'))
      } catch {
        this.lexical = this._buildInMemoryLexicalFallback()
      }
    } else {
      this.lexical = this._buildInMemoryLexicalFallback()
    }

    this.loaded = true
    return this
  }

  _buildInMemoryLexicalFallback() {
    const docs = {}
    const postings = {}
    let totalLen = 0
    let count = 0
    for (const [file, meta] of Object.entries(this.graph?.files || {})) {
      const syms = this.symbolsByFile.get(file) || []
      const text = `${file} ${syms.map((s) => `${s.name} ${s.signature || ''} ${s.doc || ''}`).join(' ')}`
      const tokens = tokenizeText(text)
      const tfMap = new Map()
      for (const tok of tokens) tfMap.set(tok, (tfMap.get(tok) || 0) + 1)
      const classified = classifyFileDomainAndPlatform(file)
      docs[file] = {
        len: tokens.length || 1,
        pkg: meta?.pkg || 'unknown',
        domain: Array.isArray(meta?.domain) ? meta.domain[0] : meta?.domain || classified.domain,
        platform: Array.isArray(meta?.platform)
          ? meta.platform[0]
          : meta?.platform || classified.platform,
        layer: meta?.layer || classified.layer,
        errors: [],
      }
      for (const [tok, tf] of tfMap.entries()) {
        if (!postings[tok]) postings[tok] = []
        postings[tok].push([file, tf])
      }
      totalLen += docs[file].len
      count++
    }
    return {
      schemaVersion: 1,
      docCount: count,
      avgDocLength: count > 0 ? totalLen / count : 1,
      docs,
      postings,
    }
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
      if (
        filters.returns &&
        !(sym.signature || '').toLowerCase().includes(String(filters.returns).toLowerCase())
      ) {
        continue
      }

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
    if (isForbiddenPath(targetFile)) {
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

    if (statSync(resolvedPath).size > MAX_INDEX_FILE_BYTES) {
      return {
        success: false,
        error: `Security rejection: File '${targetFile}' exceeds max readable limit (${MAX_INDEX_FILE_BYTES} bytes).`,
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
    let cachedFingerprints = null
    if (existsSync(this.cachePath)) {
      try {
        const cacheData = JSON.parse(readFileSync(this.cachePath, 'utf8'))
        cachedFingerprints = cacheData.fileFingerprints || null
        const currentConfig = computeConfigFingerprint(ROOT)
        if (cacheData.configHash && cacheData.configHash !== currentConfig) {
          configMatch = false
          stalenessReasons.push(
            'Configuration or path aliases modified (tsconfig/package.json/.d.ts changed)',
          )
        }
      } catch {}
    }

    // 2. Check git staleness + dirty working tree
    let currentGitHead = 'unknown'
    let dirtyFiles = []
    try {
      currentGitHead = execSync('git rev-parse HEAD', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim()
      const porcelain = execSync('git status --porcelain -- apps packages backend', {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      dirtyFiles = porcelain
        .split(/\r?\n/)
        .map((l) => l.trim().replace(/^[AMDTR?]+\s+/, ''))
        .filter((f) => f && /\.(ts|tsx|js|jsx|mjs|mts|json)$/.test(f))
    } catch {}

    const gitMatch =
      metadata.gitHash && currentGitHead !== 'unknown' ? metadata.gitHash === currentGitHead : true
    if (!gitMatch) {
      stalenessReasons.push(
        `Git HEAD mismatch: indexed=${metadata.gitHash?.substring(0, 8)}, current=${currentGitHead.substring(0, 8)}`,
      )
    }

    // 3. Full manifest SHA-256 verification across all tracked files (eliminates 20-file sampling bug)
    let checkedFilesCount = 0
    let staleFilesCount = 0
    const staleFileExamples = []

    const fingerprintMap = cachedFingerprints || {}
    const filesToVerify =
      Object.keys(fingerprintMap).length > 0
        ? Object.keys(fingerprintMap)
        : Object.keys(this.graph.files || {})

    for (const f of filesToVerify) {
      const full = join(ROOT, f)
      checkedFilesCount++
      if (existsSync(full)) {
        try {
          const st = statSync(full)
          if (!st.isFile() || st.size > MAX_INDEX_FILE_BYTES) continue
          const expectedHash =
            fingerprintMap[f]?.hash || (this.symbolsByFile.get(f) || [])[0]?.fileHash || null
          if (expectedHash) {
            const code = readFileSync(full, 'utf8')
            const h = computeSha256(code)
            if (h !== expectedHash) {
              staleFilesCount++
              if (staleFileExamples.length < 10) staleFileExamples.push(f)
            }
          }
        } catch {
          staleFilesCount++
        }
      } else {
        staleFilesCount++
        if (staleFileExamples.length < 10) staleFileExamples.push(f)
      }
    }

    const unindexedDirtyFiles = dirtyFiles.filter((f) => !fingerprintMap[f])

    if (staleFilesCount > 0) {
      stalenessReasons.push(
        `${staleFilesCount} of ${checkedFilesCount} indexed files differ on disk`,
      )
    }
    if (unindexedDirtyFiles.length > 0 && staleFilesCount === 0) {
      stalenessReasons.push(
        `${unindexedDirtyFiles.length} new uncommitted workspace file(s) not yet indexed`,
      )
    }

    let status = 'FRESH'
    if (!configMatch) {
      status = 'STALE'
    } else if (!gitMatch || staleFilesCount > 0 || unindexedDirtyFiles.length > 0) {
      status = staleFilesCount > 5 || unindexedDirtyFiles.length > 5 ? 'STALE' : 'PARTIALLY_STALE'
    }

    return {
      status,
      schemaVersion: 2,
      codeIntelVersion: '3.0.0',
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
      totalFilesChecked: checkedFilesCount,
      staleFilesCount,
      staleFileExamples,
      dirtyWorkingTreeCount: dirtyFiles.length,
    }
  }

  /**
   * Hybrid AST + BM25 lexical search with strict token budgeting (Gap 31-40).
   */
  searchCode(query, options = {}) {
    this._ensureLoaded()
    const cleanQuery = String(query || '')
      .trim()
      .slice(0, MAX_QUERY_LENGTH)
    if (!cleanQuery) {
      return { status: 'INSUFFICIENT_EVIDENCE', query: '', totalMatches: 0, results: [] }
    }

    const cacheKey = `search:${cleanQuery}:${JSON.stringify(options)}`
    if (this.queryCache.has(cacheKey)) {
      return this.queryCache.get(cacheKey)
    }

    const limit = Math.min(options.limit || 10, 25)
    const bm25Hits = queryLexicalIndex(this.lexical, cleanQuery, {
      package: options.package || options.pkg,
      domain: options.domain,
      layer: options.layer,
      limit: limit * 2,
    })

    const symHits = this.findSymbols(cleanQuery, {
      package: options.package || options.pkg,
      domain: options.domain,
      limit: limit,
    }).results

    const byFile = new Map()
    for (const hit of bm25Hits) {
      byFile.set(hit.file, {
        file: hit.file,
        score: hit.score,
        domain: hit.domain,
        platform: hit.platform,
        layer: hit.layer,
        pkg: hit.pkg,
        matchedTokens: hit.matchedTokens || [],
        symbols: (this.symbolsByFile.get(hit.file) || []).slice(0, 4).map((s) => ({
          id: s.id,
          name: s.name,
          kind: s.kind,
          startLine: s.startLine,
          signature: s.signature,
        })),
      })
    }

    for (const sym of symHits) {
      const existing = byFile.get(sym.file)
      if (existing) {
        existing.score += 5
      } else {
        const classified = classifyFileDomainAndPlatform(sym.file)
        byFile.set(sym.file, {
          file: sym.file,
          score: 5,
          domain: sym.domain || classified.domain,
          platform: sym.platform || classified.platform,
          layer: classified.layer,
          pkg: sym.package,
          matchedTokens: [sym.name.toLowerCase()],
          symbols: [
            {
              id: sym.id,
              name: sym.name,
              kind: sym.kind,
              startLine: sym.startLine,
              signature: sym.signature,
            },
          ],
        })
      }
    }

    const ranked = [...byFile.values()].sort((a, b) => b.score - a.score).slice(0, limit)
    const results = ranked.map((entry) => {
      const targetSym = entry.symbols[0]
      const excerpt = targetSym
        ? this.getSourceExcerpt(targetSym.id, { contextLines: 2 })
        : this.getSourceExcerpt(entry.file, { startLine: 1, endLine: 12, contextLines: 0 })
      const snippet = excerpt.success
        ? excerpt.excerpt.split(/\r?\n/).slice(0, 12).join('\n')
        : null
      return {
        ...entry,
        snippet,
      }
    })

    const out = {
      status: results.length > 0 ? 'FOUND' : 'INSUFFICIENT_EVIDENCE',
      query: cleanQuery,
      totalMatches: results.length,
      results,
    }
    if (this.queryCache.size > 200) this.queryCache.clear()
    this.queryCache.set(cacheKey, out)
    return out
  }

  /**
   * Discovers an end-to-end Feature Graph across UI -> Hook -> Validation -> Route -> Service -> DB -> Sync -> Tests (Gap 41, 43).
   */
  discoverFeature(featureName, options = {}) {
    this._ensureLoaded()
    const clean = String(featureName || '')
      .trim()
      .slice(0, MAX_QUERY_LENGTH)
    if (!clean) {
      return { status: 'INSUFFICIENT_EVIDENCE', feature: '', layers: {}, nodes: [], edges: [] }
    }

    const hits = this.searchCode(clean, { limit: options.limit || 20 })
    if (hits.results.length === 0) {
      return { status: 'INSUFFICIENT_EVIDENCE', feature: clean, layers: {}, nodes: [], edges: [] }
    }

    const layers = {
      ui: [],
      hook: [],
      validation: [],
      route: [],
      service: [],
      db: [],
      sync: [],
      test: [],
      other: [],
    }
    const seenFiles = new Set()
    const edges = []

    const addFileToLayer = (file, explicitScore = 1) => {
      if (!file || seenFiles.has(file) || isForbiddenPath(file)) return
      seenFiles.add(file)
      const meta = this.graph.files?.[file] || {}
      const classified = classifyFileDomainAndPlatform(file)
      const layer = meta.layer || classified.layer || 'other'
      const bucket = layers[layer] ? layer : 'other'
      layers[bucket].push({
        file,
        domain: Array.isArray(meta.domain) ? meta.domain[0] : meta.domain || classified.domain,
        platform: Array.isArray(meta.platform)
          ? meta.platform[0]
          : meta.platform || classified.platform,
        score: explicitScore,
        exports: meta.exports || [],
      })
    }

    for (const hit of hits.results) {
      addFileToLayer(hit.file, hit.score)
      const outgoing = this.fileOutgoingRels.get(hit.file) || []
      for (const rel of outgoing.slice(0, 10)) {
        if (rel.status === 'RESOLVED' && rel.targetId && !rel.targetId.includes('#')) {
          addFileToLayer(rel.targetId, hit.score * 0.6)
          edges.push({ from: hit.file, to: rel.targetId, type: rel.type })
        }
      }
      const incoming = this.fileIncomingRels.get(hit.file) || []
      for (const rel of incoming.slice(0, 10)) {
        if (rel.file) {
          addFileToLayer(rel.file, hit.score * 0.5)
          edges.push({ from: rel.file, to: hit.file, type: rel.type })
        }
      }
    }

    return {
      status: 'FOUND',
      feature: clean,
      totalNodes: seenFiles.size,
      layers,
      edges: edges.slice(0, 80),
    }
  }

  /**
   * Generates a strictly token-budgeted Context Pack (<= 4000 tokens) for an agent task (Phase 2).
   */
  getContextPack(taskDescription, options = {}) {
    this._ensureLoaded()
    const task = String(taskDescription || '')
      .trim()
      .slice(0, MAX_QUERY_LENGTH)
    const maxTokens = Math.min(options.maxTokens || 3500, 4000)

    const { allTokens } = expandQueryTokens(task)
    const searchRes = this.searchCode(task, {
      package: options.package,
      domain: options.domain,
      limit: 10,
    })

    if (searchRes.results.length === 0) {
      return {
        status: 'INSUFFICIENT_EVIDENCE',
        task,
        keywords: allTokens,
        tokenEstimate: 0,
        maxTokens,
        truncated: false,
        relevantFiles: [],
        symbols: [],
        snippets: [],
        secondarySignatures: [],
        relatedTests: [],
        securityAndSyncWarnings: [],
      }
    }

    const snippets = []
    const secondarySignatures = []
    const relatedTests = new Set()
    const securityAndSyncWarnings = new Set()
    const relevantFiles = []
    const symbols = []

    for (const hit of searchRes.results) {
      relevantFiles.push({
        file: hit.file,
        domain: hit.domain,
        platform: hit.platform,
        layer: hit.layer,
        score: hit.score,
      })

      if (
        hit.layer === 'sync' ||
        hit.platform === 'OFFLINE_ENGINE' ||
        hit.file.includes('outbox')
      ) {
        securityAndSyncWarnings.add(
          `Offline/Sync dependency in ${hit.file}: preserve idempotency keys & local-engine parity.`,
        )
      }
      if (
        hit.domain === 'Auth' ||
        hit.file.includes('middleware') ||
        hit.file.includes('fencing') ||
        hit.file.includes('rls')
      ) {
        securityAndSyncWarnings.add(
          `Security boundary in ${hit.file}: preserve workspace_id tenancy, capability checks & fail-closed guards.`,
        )
      }

      const fileSyms = this.symbolsByFile.get(hit.file) || []
      for (const s of fileSyms.slice(0, 3)) {
        symbols.push({
          id: s.id,
          name: s.name,
          kind: s.kind,
          file: s.file,
          startLine: s.startLine,
          endLine: s.endLine,
          signature: s.signature,
        })

        // Bounded snippet (<= 15 lines) for top symbols within budget
        if (snippets.length < 6) {
          const ex = this.getSourceExcerpt(s.id, { contextLines: 1 })
          if (ex.success) {
            const bounded = ex.excerpt.split(/\r?\n/).slice(0, 15).join('\n')
            snippets.push({
              file: ex.file,
              symbolId: s.id,
              startLine: ex.contextFromLine,
              endLine: Math.min(ex.contextToLine, ex.contextFromLine + 14),
              code: bounded,
            })
          }
        } else {
          secondarySignatures.push({
            id: s.id,
            file: s.file,
            line: s.startLine,
            signature: s.signature,
          })
        }

        const relTests = this.getRelatedTests(s.id)
        for (const t of relTests.tests || []) {
          relatedTests.add(t.testFile)
        }
      }

      // Also check file-level test relationships
      for (const rel of this.fileIncomingRels.get(hit.file) || []) {
        if (rel.type === 'TESTS' && rel.file) relatedTests.add(rel.file)
      }
    }

    // Enforce hard <= maxTokens budget
    let truncated = false
    const pack = {
      status: 'READY',
      task,
      keywords: allTokens.slice(0, 20),
      maxTokens,
      truncated: false,
      relevantFiles,
      symbols,
      snippets,
      secondarySignatures: secondarySignatures.slice(0, 15),
      relatedTests: [...relatedTests].slice(0, 15),
      securityAndSyncWarnings: [...securityAndSyncWarnings],
    }

    while (estimateTokens(pack) > maxTokens && pack.snippets.length > 1) {
      pack.snippets.pop()
      truncated = true
    }
    while (estimateTokens(pack) > maxTokens && pack.secondarySignatures.length > 0) {
      pack.secondarySignatures.pop()
      truncated = true
    }
    while (estimateTokens(pack) > maxTokens && pack.symbols.length > 3) {
      pack.symbols.pop()
      truncated = true
    }

    pack.truncated = truncated
    pack.tokenEstimate = estimateTokens(pack)
    return pack
  }
}
