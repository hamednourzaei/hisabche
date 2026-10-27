// scripts/audit/build-ui-inventory.mjs
// Read-only UI crawler: maps Web pages, App-Shell routes, modals and components to hooks.
// Generates docs/audit/generated/ui-inventory.json.

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/audit/generated')
fs.mkdirSync(OUT, { recursive: true })

const SKIP = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  '.turbo',
  'graphify-out',
  '.git',
  'coverage',
  '.pgtest',
  'out',
])

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/')
const isCode = (p) => /\.(ts|tsx)$/.test(p)
const isTest = (p) => /(__tests__|\.test\.|\.spec\.|\/e2e\/)/.test(rel(p))

// 1. Load Hook Inventory
const hookInventoryFile = path.join(OUT, 'hook-inventory.json')
if (!fs.existsSync(hookInventoryFile)) {
  console.error(
    'Error: docs/audit/generated/hook-inventory.json not found. Run build-hook-inventory.mjs first.',
  )
  process.exit(1)
}
const allHooks = JSON.parse(fs.readFileSync(hookInventoryFile, 'utf8'))
const hookMap = new Map()
for (const h of allHooks) {
  hookMap.set(h.name, h)
}

// 2. Scan all UI and App code files
const uiDirs = [
  'packages/ui/src',
  'packages/app-shell/src',
  'apps/web/app',
  'apps/desktop/src',
  'apps/mobile/src',
]

const codeFiles = []
for (const d of uiDirs) {
  const files = walk(path.join(ROOT, d)).filter((f) => isCode(f) && !isTest(f))
  codeFiles.push(...files)
}

// Map each file to its imports and hook usages
const fileInfo = new Map() // filePath -> { imports: string[], hooksUsed: Set<string>, content: string }

for (const absPath of codeFiles) {
  const rPath = rel(absPath)
  const content = fs.readFileSync(absPath, 'utf8')

  // Find hook usages
  const hooksUsed = new Set()
  for (const [hookName] of hookMap) {
    const re = new RegExp(`\\b${hookName}\\b`)
    if (re.test(content)) {
      // Exclude definition if this is the hook definition file
      if (rPath.includes('packages/api/src/hooks/')) continue
      hooksUsed.add(hookName)
    }
  }

  // Find imported files / modules
  const rawImports = []
  const importRe = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g
  let m
  while ((m = importRe.exec(content))) {
    rawImports.push(m[1])
  }
  const dynamicImportRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((m = dynamicImportRe.exec(content))) {
    rawImports.push(m[1])
  }

  // Resolve imports to local file paths when relative or aliases
  const resolvedDeps = new Set()
  const fileDir = path.dirname(absPath)
  for (const imp of rawImports) {
    let candidate = null
    if (imp.startsWith('.')) {
      candidate = path.resolve(fileDir, imp)
    } else if (imp.startsWith('@/')) {
      // In packages/app-shell/src, @/ maps to packages/app-shell/src/
      if (rPath.startsWith('packages/app-shell/src/')) {
        candidate = path.resolve(ROOT, 'packages/app-shell/src', imp.slice(2))
      } else if (rPath.startsWith('apps/desktop/src/')) {
        candidate = path.resolve(ROOT, 'apps/desktop/src', imp.slice(2))
      } else if (rPath.startsWith('apps/web/')) {
        candidate = path.resolve(ROOT, 'apps/web', imp.slice(2))
      }
    } else if (imp === '@hisabche/ui') {
      candidate = path.resolve(ROOT, 'packages/ui/src/index.ts')
    } else if (imp.startsWith('@hisabche/ui/')) {
      candidate = path.resolve(ROOT, 'packages/ui/src', imp.slice('@hisabche/ui/'.length))
    }

    if (candidate) {
      // Try extensions: .ts, .tsx, /index.ts, /index.tsx
      const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx']
      for (const ext of exts) {
        const testP = candidate + ext
        if (fs.existsSync(testP) && fs.statSync(testP).isFile()) {
          resolvedDeps.add(rel(testP))
          break
        }
      }
    }
  }

  fileInfo.set(rPath, {
    imports: Array.from(resolvedDeps),
    hooksUsed: Array.from(hooksUsed),
  })
}

// Helper: Traverse dependencies transitively from an entry file (depth limit 6)
function collectTransitiveData(entryFile, maxDepth = 6) {
  const visited = new Set()
  const allHooksUsed = new Set()
  const allComponents = new Set()

  function dfs(curr, depth) {
    if (depth > maxDepth || visited.has(curr)) return
    visited.add(curr)
    allComponents.add(curr)

    const info = fileInfo.get(curr)
    if (!info) return

    for (const h of info.hooksUsed) {
      allHooksUsed.add(h)
    }

    for (const dep of info.imports) {
      dfs(dep, depth + 1)
    }
  }

  dfs(entryFile, 0)
  return {
    components: Array.from(allComponents),
    hooks: Array.from(allHooksUsed),
  }
}

// 3. Collect Web Pages
const webPages = []
const webPageFiles = walk(path.join(ROOT, 'apps/web/app')).filter(
  (f) => f.endsWith('page.tsx') && !isTest(f),
)

for (const wp of webPageFiles) {
  const rPath = rel(wp)
  // Derive route: e.g. apps/web/app/[lang]/(dashboard)/accounting/page.tsx -> /accounting
  let relInside = rPath.replace(/^apps\/web\/app\//, '').replace(/\/page\.tsx$/, '')
  // Strip [lang] and route groups (xxx)
  relInside = relInside
    .split('/')
    .filter((seg) => !seg.startsWith('(') && !seg.endsWith(')'))
    .filter((seg) => seg !== '[lang]')
    .join('/')

  let routeUrl = '/' + relInside
  if (routeUrl === '//' || routeUrl === '') routeUrl = '/'
  // Normalize dynamic params [id] -> :id
  routeUrl = routeUrl.replace(/\[([^\]]+)\]/g, ':$1')

  const { components, hooks } = collectTransitiveData(rPath)
  webPages.push({
    id: `web:${routeUrl}`,
    platform: 'web',
    route: routeUrl,
    entryFile: rPath,
    componentsCount: components.length,
    components,
    hooks,
  })
}

// 4. Collect App Shell Routes (from packages/app-shell/src/app/app.tsx)
const appShellRoutes = []
const appShellFile = path.join(ROOT, 'packages/app-shell/src/app/app.tsx')
if (fs.existsSync(appShellFile)) {
  const src = fs.readFileSync(appShellFile, 'utf8')
  // Match lazy imports: const InvoicesPage = lazy(() => import('@/features/sales/invoices-page'))
  const lazyImports = new Map()
  const lazyRe = /const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(['"]([^'"]+)['"]\)\s*\)/g
  let lm
  while ((lm = lazyRe.exec(src))) {
    let target = lm[2].replace('@/', 'packages/app-shell/src/')
    // Try extensions
    for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts']) {
      if (fs.existsSync(path.join(ROOT, target + ext))) {
        target = target + ext
        break
      }
    }
    lazyImports.set(lm[1], target)
  }

  // Match routes: { path: 'invoices', element: <InvoicesPage /> }
  const routeRe =
    /{\s*(?:index:\s*true\s*,\s*)?path:\s*['"]([^'"]+)['"]\s*,\s*element:\s*<(\w+)[^>]*\/>/g
  let rm
  while ((rm = routeRe.exec(src))) {
    const rPath = rm[1].startsWith('/') ? rm[1] : '/' + rm[1]
    const compName = rm[2]
    const entryFile = lazyImports.get(compName) || 'packages/app-shell/src/app/app.tsx'

    const { components, hooks } = collectTransitiveData(entryFile)
    appShellRoutes.push({
      id: `shell:${rPath}`,
      platform: 'desktop_mobile_shell',
      route: rPath,
      componentName: compName,
      entryFile,
      componentsCount: components.length,
      components,
      hooks,
    })
  }

  // Also check index route (dashboard)
  const indexMatch = src.match(/{\s*index:\s*true\s*,\s*element:\s*<(\w+)/)
  if (indexMatch) {
    const compName = indexMatch[1]
    const entryFile = lazyImports.get(compName) || 'packages/app-shell/src/app/app.tsx'
    const { components, hooks } = collectTransitiveData(entryFile)
    appShellRoutes.push({
      id: 'shell:/',
      platform: 'desktop_mobile_shell',
      route: '/',
      componentName: compName,
      entryFile,
      componentsCount: components.length,
      components,
      hooks,
    })
  }
}

// 5. Invert: Map each hook to its consumers and reaching UI surfaces
const hookUsageList = []
const hookUsageById = new Map()
const hooksByName = new Map()

for (const h of allHooks) {
  const id = `${h.file}:${h.line}:${h.name}`
  const entry = {
    id,
    name: h.name,
    file: h.file,
    line: h.line,
    type: h.type,
    method: h.method,
    canonicalUrl: h.canonicalUrl,
    directCallingFiles: [],
    webSurfaces: [],
    shellSurfaces: [],
    totalConsumerFiles: 0,
    hasCallers: false,
  }
  hookUsageById.set(id, entry)
  hookUsageList.push(entry)
  if (!hooksByName.has(h.name)) hooksByName.set(h.name, [])
  hooksByName.get(h.name).push(entry)
}

// Find direct calling files across all scanned files
for (const [fPath, info] of fileInfo) {
  for (const hName of info.hooksUsed) {
    const entries = hooksByName.get(hName)
    if (entries) {
      for (const entry of entries) {
        if (!entry.directCallingFiles.includes(fPath)) {
          entry.directCallingFiles.push(fPath)
        }
      }
    }
  }
}

// Link reaching web surfaces
for (const wp of webPages) {
  for (const hName of wp.hooks) {
    const entries = hooksByName.get(hName)
    if (entries) {
      for (const entry of entries) {
        if (!entry.webSurfaces.includes(wp.route)) {
          entry.webSurfaces.push(wp.route)
        }
      }
    }
  }
}

// Link reaching shell surfaces
for (const sp of appShellRoutes) {
  for (const hName of sp.hooks) {
    const entries = hooksByName.get(hName)
    if (entries) {
      for (const entry of entries) {
        if (!entry.shellSurfaces.includes(sp.route)) {
          entry.shellSurfaces.push(sp.route)
        }
      }
    }
  }
}

let activeHooksCount = 0
let hooksWithoutCallersCount = 0

for (const entry of hookUsageList) {
  entry.totalConsumerFiles = entry.directCallingFiles.length
  entry.hasCallers = entry.totalConsumerFiles > 0
  if (entry.hasCallers) {
    activeHooksCount++
  } else {
    hooksWithoutCallersCount++
  }
}

// 6. Write final UI Inventory
const uiInventory = {
  summary: {
    scannedFiles: codeFiles.length,
    webPagesCount: webPages.length,
    appShellRoutesCount: appShellRoutes.length,
    totalHooks: allHooks.length,
    activeHooks: activeHooksCount,
    hooksWithoutCallers: hooksWithoutCallersCount,
  },
  webPages,
  appShellRoutes,
  hookUsage: hookUsageList,
}

fs.writeFileSync(path.join(OUT, 'ui-inventory.json'), JSON.stringify(uiInventory, null, 2))

console.log(`UI inventory generated successfully!`)
console.log(`- Web pages: ${webPages.length}`)
console.log(`- App shell routes: ${appShellRoutes.length}`)
console.log(`- Total hooks: ${allHooks.length}`)
console.log(`- Active hooks (with callers): ${activeHooksCount}`)
console.log(`- Hooks with no calling file: ${hooksWithoutCallersCount}`)
console.log(`- Sum: ${activeHooksCount + hooksWithoutCallersCount} === ${allHooks.length}`)
console.log(`- Output written to: ${rel(path.join(OUT, 'ui-inventory.json'))}`)
