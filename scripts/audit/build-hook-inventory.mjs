// ============================================
// scripts/audit/build-hook-inventory.mjs
//
// Static analyzer for React Query and data hooks in @hisabche/api:
// hook name, file:line, type (query/mutation), queryKey, HTTP endpoint,
// invalidations, enabled guards, optimistic updates, and offline matrix status.
// ============================================

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const rd = (p) => fs.readFileSync(p, 'utf8')
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')

const walk = (d, o = []) => {
  if (!fs.existsSync(d)) return o
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, o)
    else if (p.endsWith('.ts') && !p.includes('__tests__') && !p.endsWith('.d.ts')) o.push(p)
  }
  return o
}

// 1. Load OFFLINE_ENDPOINT_MATRIX from packages/validation
const matrixSrc = rd(path.join(ROOT, 'packages/validation/src/schemas/offline-endpoint-matrix.ts'))
const offlineMatrix = new Map()
const matrixRe =
  /['"`]([A-Z]+)\s+([^'"`]+)['"`]\s*:\s*\[\s*['"`]([^'"`]+)['"`]\s*,\s*['"`]([^'"`]+)['"`]\s*\]/g
let mm
while ((mm = matrixRe.exec(matrixSrc))) {
  offlineMatrix.set(`${mm[1]} ${mm[2]}`, { feature: mm[3], status: mm[4] })
}

// 2. Discover all hook files in packages/api/src/hooks
const hookFiles = walk(path.join(ROOT, 'packages/api/src/hooks')).sort()

// Helper to normalize URL: e.g. `/invoices/${id}` or `/invoices/:id` -> `/api/invoices/:id`
function normalizeUrl(url) {
  if (!url) return null
  let clean = url
    .replace(/\$\{[^}]+\}/g, ':id')
    .replace(/:[a-zA-Z0-9_]+/g, ':id')
    .replace(/\?.*$/, '')
    .trim()

  if (
    !clean.startsWith('/api') &&
    !clean.startsWith('/mcp') &&
    !clean.startsWith('/odata') &&
    !clean.startsWith('/updates')
  ) {
    clean = `/api/${clean.replace(/^\/+/, '')}`
  }
  return clean
}

const hooks = []

for (const hf of hookFiles) {
  if (hf.endsWith('index.ts') || hf.endsWith('useAuthReady.ts') || hf.endsWith('useRealtime.ts')) {
    // continue or inspect if needed
  }
  const src = rd(hf)
  const relFile = rel(hf)

  // Find all exported functions or consts starting with 'use'

  // Split file into function blocks or scan declarations
  const declRe = /export\s+(?:(?:async\s+)?function|(?:const))\s+(use[A-Z][A-Za-z0-9_]*)/g
  let dm
  const declStarts = []
  while ((dm = declRe.exec(src))) {
    declStarts.push({ index: dm.index, name: dm[1] })
  }

  // Collect file constants e.g. const TAX_RETURN = '/tax/return'
  const fileConstants = new Map()
  for (const cm of src.matchAll(/const\s+([A-Za-z0-9_]+)\s*=\s*['"`]([^'"`]+)['"`]/g)) {
    fileConstants.set(cm[1], cm[2])
  }

  for (let i = 0; i < declStarts.length; i++) {
    const cur = declStarts[i]
    const nextIndex = declStarts[i + 1]?.index ?? src.length
    const body = src.slice(cur.index, nextIndex)
    const line = src.slice(0, cur.index).split('\n').length

    // Determine type: useQuery, useMutation, useInfiniteQuery, custom
    let type = 'utility'
    if (/useInfiniteQuery\s*\(/.test(body)) type = 'infiniteQuery'
    else if (/useQuery\s*\(/.test(body)) type = 'query'
    else if (/useMutation\s*\(/.test(body)) type = 'mutation'

    // Extract queryKey
    const qkMatch = body.match(/queryKey\s*:\s*([^,\n}]+|\[[^\]]*\])/)
    const queryKey = qkMatch ? qkMatch[1].trim() : null

    // Extract HTTP verb and URL
    let method = 'GET'
    let rawUrl = null
    const clientCall = body.match(
      /apiClient\.(get|post|put|patch|delete)[^(]*?\(\s*(['"`][^'"`]+['"`]|\`[^\`]+\`|[A-Za-z0-9_]+)/,
    )
    if (clientCall) {
      method = clientCall[1].toUpperCase()
      const arg = clientCall[2]
      if (arg.startsWith("'") || arg.startsWith('"') || arg.startsWith('`')) {
        rawUrl = arg.slice(1, -1)
      } else if (fileConstants.has(arg)) {
        rawUrl = fileConstants.get(arg)
      }
    } else {
      // Check localRequest or generic request
      const localCall = body.match(
        /localRequest\s*[^(]*?\(\s*['"`](GET|POST|PUT|PATCH|DELETE)['"`]\s*,\s*(['"`][^'"`]+['"`]|\`[^\`]+\`|[A-Za-z0-9_]+)/,
      )
      if (localCall) {
        method = localCall[1].toUpperCase()
        const arg = localCall[2]
        if (arg.startsWith("'") || arg.startsWith('"') || arg.startsWith('`')) {
          rawUrl = arg.slice(1, -1)
        } else if (fileConstants.has(arg)) {
          rawUrl = fileConstants.get(arg)
        }
      } else {
        const genCall = body.match(
          /apiClient\(\s*\{[^}]*method:\s*['"`]([A-Za-z]+)['"`][^}]*url:\s*(['"`][^'"`]+['"`]|\`[^\`]+\`)/,
        )
        if (genCall) {
          method = genCall[1].toUpperCase()
          rawUrl = genCall[2].slice(1, -1)
        }
      }
    }

    if (!rawUrl && type === 'mutation') {
      // Look for apiClient inside mutationFn
      const mutCall = body.match(
        /(?:mutationFn|mutation)\s*:[^;]*?apiClient\.(get|post|put|patch|delete)[^(]*?\(\s*(['"`][^'"`]+['"`]|\`[^\`]+\`|[A-Za-z0-9_]+)/s,
      )
      if (mutCall) {
        method = mutCall[1].toUpperCase()
        const arg = mutCall[2]
        if (arg.startsWith("'") || arg.startsWith('"') || arg.startsWith('`')) {
          rawUrl = arg.slice(1, -1)
        } else if (fileConstants.has(arg)) {
          rawUrl = fileConstants.get(arg)
        }
      }
    }

    if (!rawUrl) {
      // Check budget transition helper: useBudgetTransition('submit')
      const transMatch = body.match(/useBudgetTransition\(\s*['"](\w+)['"]\s*\)/)
      if (transMatch) {
        method = 'POST'
        rawUrl = `/operations/budgets/:id/${transMatch[1]}`
      }
    }

    if (!rawUrl) {
      // Check if body calls any local helper function defined in the file
      for (const fm of src.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)) {
        const helperName = fm[1]
        if (helperName === cur.name) continue
        if (body.includes(helperName)) {
          const helperRe = new RegExp(
            `(?:async\\s+)?function\\s+${helperName}\\s*\\([^)]*\\)[\\s\\S]*?\\{([\\s\\S]*?)(?:\\n(?:async\\s+)?function|\\nexport|\\Z)`,
          )
          const helperMatch = src.match(helperRe)
          if (helperMatch) {
            const helperBody = helperMatch[1]
            const hCall = helperBody.match(
              /apiClient\.(get|post|put|patch|delete)[^(]*?\(\s*(['"`][^'"`]+['"`]|\`[^\`]+\`|[A-Za-z0-9_]+)/,
            )
            if (hCall) {
              method = hCall[1].toUpperCase()
              const arg = hCall[2]
              if (arg.startsWith("'") || arg.startsWith('"') || arg.startsWith('`')) {
                rawUrl = arg.slice(1, -1)
              } else if (fileConstants.has(arg)) {
                rawUrl = fileConstants.get(arg)
              }
              break
            }
          }
        }
      }
    }

    const canonicalUrl = rawUrl ? normalizeUrl(rawUrl) : null

    // Invalidations
    const invalidations = []
    for (const invMatch of body.matchAll(
      /invalidateQueries\(\s*\{[^}]*queryKey\s*:\s*([^}\n]+)\}/g,
    )) {
      invalidations.push(invMatch[1].trim())
    }

    // Enabled guard
    const enabledMatch = body.match(/enabled\s*:\s*([^,\n}]+)/)
    const enabled = enabledMatch ? enabledMatch[1].trim() : null

    // Optimistic update
    const optimistic = /onMutate\s*:/.test(body)

    // Error handling
    const errorHandling = /onError\s*:|apiErrorMessage/.test(body)

    // Persistence
    const metaPersist = /meta\s*:\s*\{[^}]*persist/i.test(body)

    // Offline status lookup
    let offlineStatus = 'ONLINE_ONLY'
    let offlineFeature = null
    if (canonicalUrl) {
      const matchKey = `${method} ${canonicalUrl}`
      const matrixHit =
        offlineMatrix.get(matchKey) ||
        offlineMatrix.get(`${method} ${canonicalUrl.replace(/:id/g, ':id')}`)
      if (matrixHit) {
        offlineFeature = matrixHit.feature
        if (matrixHit.status === 'available') offlineStatus = 'OFFLINE_COMPLETE'
        else if (matrixHit.status === 'online_required') offlineStatus = 'ONLINE_ONLY'
        else if (matrixHit.status === 'not_supported') offlineStatus = 'NOT_APPLICABLE'
      } else {
        // Check if localRequest was explicitly handled
        if (/read.*FromDevice|localRequest/.test(body)) {
          offlineStatus = 'OFFLINE_PARTIAL'
        }
      }
    }

    hooks.push({
      name: cur.name,
      file: relFile,
      line,
      type,
      queryKey,
      method: rawUrl ? method : type === 'mutation' ? 'POST' : 'GET',
      rawUrl,
      canonicalUrl,
      invalidations,
      enabled,
      optimistic,
      errorHandling,
      metaPersist,
      offline: {
        feature: offlineFeature,
        status: offlineStatus,
      },
    })
  }
}

// Write generated hook inventory
const outDir = path.join(ROOT, 'docs/audit/generated')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'hook-inventory.json'), JSON.stringify(hooks, null, 2))

console.log('--- Hook Inventory Summary ---')
console.log('Total hooks scanned:', hooks.length)
const byType = {}
for (const h of hooks) {
  byType[h.type] = (byType[h.type] || 0) + 1
}
console.log('By Type:', byType)
console.log('With resolved endpoint:', hooks.filter((h) => h.canonicalUrl).length)
