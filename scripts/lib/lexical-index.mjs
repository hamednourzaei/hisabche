/**
 * Hybrid Lexical Search Engine (Inverted Index + BM25 + Fuzzy + Concept Expansion)
 * Zero external dependencies. Designed for strict token economy in AI coding agents.
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const MAX_INDEX_FILE_BYTES = 1024 * 1024 // 1 MiB safety limit per file
export const MAX_QUERY_LENGTH = 256

/** Bilingual & domain synonym map (Persian / English / domain concepts) */
const CONCEPT_EXPANSIONS = {
  فاکتور: ['invoice', 'invoices', 'createinvoice', 'invoiceline', 'proforma'],
  مشتری: ['customer', 'customers', 'party', 'receivable'],
  پرداخت: ['payment', 'payments', 'allocation', 'settlement', 'receipt'],
  انبار: ['warehouse', 'inventory', 'stock', 'shelf', 'product_stock'],
  موجودی: ['stock', 'quantity', 'inventory', 'costing', 'product_stock'],
  حسابداری: ['accounting', 'ledger', 'journal', 'trial_balance', 'postdocument'],
  آفلاین: ['offline', 'sync', 'outbox', 'sqlite', 'local-engine', 'sync_queue'],
  همگام: ['sync', 'outbox', 'cursor', 'pull', 'push'],
  کاربر: ['user', 'member', 'auth', 'role', 'tenancy'],
  رمزنگاری: ['encryption', 'sqlcipher', 'cipher', 'safestorage', 'aead'],
  فروش: ['sale', 'sales', 'invoice', 'pos', 'checkout'],
  خرید: ['purchase', 'purchasing', 'supplier', 'rfq'],
  invoice: ['invoices', 'createinvoice', 'invoiceline', 'draft'],
  sync: ['outbox', 'cursor', 'sync_queue', 'rehydrate', 'localdb'],
  auth: ['authenticate', 'tenancy', 'capability', 'rbac', 'jwt'],
  fencing: ['writerfencingengine', 'lease', 'epoch', 'promote'],
  storage: ['storageadapter', 's3', 'signedurl', 'upload'],
}

/**
 * Splits camelCase, snake_case, kebab-case, and paths into normalized lowercase tokens.
 */
export function tokenizeText(text) {
  if (!text || typeof text !== 'string') return []
  const capped = text.slice(0, 200_000)
  const splitCamel = capped.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  const rawTokens = splitCamel.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || []
  const out = []
  for (const tok of rawTokens) {
    if (tok.includes('_')) {
      for (const sub of tok.split('_')) {
        if (sub.length >= 2) out.push(sub)
      }
    }
    out.push(tok)
  }
  return out
}

/**
 * Expands query tokens with bilingual/concept synonyms cleanly.
 */
export function expandQueryTokens(query) {
  const safeQuery = String(query || '').slice(0, MAX_QUERY_LENGTH)
  const baseTokens = tokenizeText(safeQuery)
  const expanded = new Set(baseTokens)
  for (const tok of baseTokens) {
    const syns = Object.hasOwn(CONCEPT_EXPANSIONS, tok) ? CONCEPT_EXPANSIONS[tok] : null
    if (syns) {
      for (const s of syns) expanded.add(s)
    }
  }
  return {
    baseTokens: [...new Set(baseTokens)],
    allTokens: [...expanded],
  }
}

/** Lightweight Levenshtein distance for short fuzzy query fallback (bounded length). */
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99
  const dp = Array.from({ length: a.length + 1 }, (_, i) => i)
  for (let j = 1; j <= b.length; j++) {
    let prev = dp[0]
    dp[0] = j
    for (let i = 1; i <= a.length; i++) {
      const temp = dp[i]
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1])
      prev = temp
    }
  }
  return dp[a.length]
}

/**
 * Builds a compact inverted index over source files, comments, error literals, and symbols.
 */
export function buildLexicalIndex(rootDir, filesMap, symbolsByFile) {
  const docs = Object.create(null) // file -> { length, domain, platform, layer, errorStrings[] }
  const postings = Object.create(null) // token -> Array<[file, tf]>
  let totalDocLength = 0
  let docCount = 0

  for (const [file, meta] of Object.entries(filesMap || {})) {
    const lowerFile = file.toLowerCase()
    if (
      lowerFile.includes('.env') ||
      lowerFile.endsWith('.pem') ||
      lowerFile.endsWith('.key') ||
      lowerFile.includes('node_modules')
    ) {
      continue
    }

    const fullPath = join(rootDir, file)
    if (!existsSync(fullPath)) continue
    let st
    try {
      st = statSync(fullPath)
    } catch {
      continue
    }
    if (!st.isFile() || st.size > MAX_INDEX_FILE_BYTES) continue

    let content = ''
    try {
      content = readFileSync(fullPath, 'utf8')
    } catch {
      continue
    }

    const syms = symbolsByFile.get(file) || []
    const symbolText = syms.map((s) => `${s.name} ${s.signature || ''} ${s.doc || ''}`).join(' ')

    // Extract error/throw message literals for fast error-string lookup (Gap 35)
    const errorMatches = []
    for (const m of content.matchAll(/(?:Error|code)\s*[:(]\s*['"`]([^'"`\n]{3,120})['"`]/g)) {
      if (m[1]) errorMatches.push(m[1])
    }

    const combined = `${file} ${symbolText} ${errorMatches.join(' ')} ${content}`
    const tokens = tokenizeText(combined)
    const tfMap = new Map()
    for (const tok of tokens) {
      tfMap.set(tok, (tfMap.get(tok) || 0) + 1)
    }

    // Weight filename & symbol names higher via synthetic boost
    for (const tok of tokenizeText(`${file} ${syms.map((s) => s.name).join(' ')}`)) {
      tfMap.set(tok, (tfMap.get(tok) || 0) + 3)
    }

    const docLen = tokens.length || 1
    totalDocLength += docLen
    docCount++

    docs[file] = {
      len: docLen,
      pkg: meta.pkg || meta.package || 'unknown',
      domain: Array.isArray(meta.domain) ? meta.domain[0] : meta.domain || 'SHARED',
      platform: Array.isArray(meta.platform) ? meta.platform[0] : meta.platform || 'SHARED',
      layer: meta.layer || 'other',
      errors: errorMatches.slice(0, 12),
    }

    for (const [tok, tf] of tfMap.entries()) {
      if (!Object.hasOwn(postings, tok)) postings[tok] = []
      postings[tok].push([file, tf])
    }
  }

  return {
    schemaVersion: 1,
    docCount,
    avgDocLength: docCount > 0 ? totalDocLength / docCount : 1,
    docs,
    postings,
  }
}

/**
 * Ranks documents using Okapi BM25 + optional fuzzy fallback when exact postings miss.
 */
export function queryLexicalIndex(lexicalIndex, query, filters = {}) {
  if (!lexicalIndex || !lexicalIndex.docs) return []
  const { baseTokens, allTokens } = expandQueryTokens(query)
  if (allTokens.length === 0) return []

  const N = lexicalIndex.docCount || 1
  const avgdl = lexicalIndex.avgDocLength || 1
  const k1 = 1.5
  const b = 0.75

  const scores = new Map()
  const matchedTokensByFile = new Map()

  const applyPosting = (tok, weight, postingList) => {
    const df = postingList.length
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5))
    for (const [file, tf] of postingList) {
      const doc = Object.hasOwn(lexicalIndex.docs, file) ? lexicalIndex.docs[file] : null
      if (!doc) continue
      if (filters.package && doc.pkg !== filters.package) continue
      if (filters.domain && doc.domain.toLowerCase() !== filters.domain.toLowerCase()) continue
      if (filters.layer && doc.layer !== filters.layer) continue

      const denom = tf + k1 * (1 - b + b * (doc.len / avgdl))
      const bm25 = idf * ((tf * (k1 + 1)) / denom) * weight
      scores.set(file, (scores.get(file) || 0) + bm25)
      if (!matchedTokensByFile.has(file)) matchedTokensByFile.set(file, new Set())
      matchedTokensByFile.get(file).add(tok)
    }
  }

  for (const tok of allTokens) {
    const isBase = baseTokens.includes(tok)
    const weight = isBase ? 1.5 : 0.8
    const posting = Object.hasOwn(lexicalIndex.postings, tok) ? lexicalIndex.postings[tok] : null
    if (posting) {
      applyPosting(tok, weight, posting)
    }
  }

  // Fuzzy fallback when base tokens yield too few results (Gap 33)
  if (scores.size < 3 && baseTokens.length > 0) {
    const vocab = Object.keys(lexicalIndex.postings)
    for (const qTok of baseTokens) {
      if (qTok.length < 4) continue
      for (const vTok of vocab) {
        if (Math.abs(vTok.length - qTok.length) <= 1 && vTok[0] === qTok[0]) {
          if (editDistance(qTok, vTok) <= 1) {
            applyPosting(vTok, 0.5, lexicalIndex.postings[vTok])
          }
        }
      }
    }
  }

  const limit = Math.min(filters.limit || 10, 25)
  return [...scores.entries()]
    .map(([file, score]) => ({
      file,
      score: Number(score.toFixed(4)),
      matchedTokens: [...(matchedTokensByFile.get(file) || [])],
      ...lexicalIndex.docs[file],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
