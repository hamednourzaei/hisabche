#!/usr/bin/env node
/**
 * Hisabche Codebase Intelligence Indexer
 * Generates .ai/codebase/CODEBASE_MAP.md (human) and .ai/codebase/graph.json (machine)
 * Run with: node scripts/build-ai-index.mjs
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { join, extname, basename } from 'path'
import { execSync } from 'child_process'

const ROOT = process.cwd()
const AI_DIR = join(ROOT, '.ai', 'codebase')
const GRAPH_JSON = join(AI_DIR, 'graph.json')
const MAP_MD = join(AI_DIR, 'CODEBASE_MAP.md')

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
  'e2e',
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

const DOMAIN_KEYWORDS = {
  Invoices: ['invoice', 'invoices'],
  POS: ['pos', 'point-of-sale', 'pointofsale'],
  Inventory: [
    'inventory',
    'stock',
    'product',
    'products',
    'variant',
    'variants',
    'sku',
    'warehouse',
    'shelf',
    'storage',
  ],
  Warehouse: ['warehouse', 'storage_place', 'storageplace', 'shelf', 'bin', 'location'],
  Customers: ['customer', 'customers', 'crm', 'contact', 'lead', 'prospect'],
  Payments: [
    'payment',
    'payments',
    'receivable',
    'receivables',
    'collection',
    'collections',
    'allocation',
    'allocations',
  ],
  Accounting: [
    'accounting',
    'journal',
    'ledger',
    'account',
    'accounts',
    'trial-balance',
    'trialbalance',
    'profit',
    'loss',
    'balance-sheet',
    'balancesheet',
    'financial',
  ],
  Employees: [
    'employee',
    'employees',
    'hr',
    'human-resources',
    'humanresources',
    'payroll',
    'attendance',
    'leave',
    'timesheet',
  ],
  Manufacturing: [
    'manufacturing',
    'bom',
    'bill-of-materials',
    'billofmaterials',
    'production',
    'work-order',
    'workorder',
    'mrp',
  ],
  Reports: [
    'report',
    'reports',
    'analytics',
    'dashboard',
    'chart',
    'visualization',
    'kpi',
    'metric',
  ],
  Settings: ['settings', 'configuration', 'config', 'preference', 'preferences'],
  Auth: [
    'auth',
    'authentication',
    'authorization',
    'login',
    'logout',
    'session',
    'token',
    'jwt',
    'oauth',
    'sso',
    'mfa',
    '2fa',
    'totp',
  ],
  Offline: [
    'offline',
    'sync',
    'local-engine',
    'local_engine',
    'localdb',
    'local_db',
    'sqlite',
    'watermelon',
    'rxdb',
  ],
  Sync: ['sync', 'synchronization', 'replication', 'conflict', 'delta', 'changeset', 'changeset'],
  Migration: ['migration', 'migrate', 'import', 'export', 'data-migration', 'datamigration'],
  Permissions: [
    'permission',
    'permissions',
    'role',
    'roles',
    'capability',
    'capabilities',
    'rbac',
    'acl',
    'policy',
    'policies',
  ],
  Localization: [
    'i18n',
    'locale',
    'translation',
    'translate',
    'language',
    'lang',
    'rtl',
    'dari',
    'persian',
    'pashto',
  ],
}

function getGitHash() {
  try {
    return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }).trim()
  } catch {
    return 'unknown'
  }
}

function getAllSourceFiles(dir, prefix = '') {
  const files = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        files.push(...getAllSourceFiles(join(dir, entry.name), join(prefix, entry.name)))
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name)
      if (SOURCE_EXTS.has(ext) && !IGNORE_FILES.has(entry.name) && !entry.name.endsWith('.d.ts')) {
        files.push(join(prefix, entry.name))
      }
    }
  }
  return files
}

function readFileContent(filePath) {
  try {
    return readFileSync(join(ROOT, filePath), 'utf8')
  } catch {
    return ''
  }
}

function extractImports(content) {
  const imports = []
  const importRegex = /^import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm
  let match
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

function extractExports(content) {
  const exports = []
  const exportRegex =
    /^export\s+(?:default\s+)?(?:const|function|class|interface|type|enum|var|let)\s+(\w+)/gm
  const namedExportRegex = /^export\s+\{([^}]+)\}/gm
  const defaultExportRegex = /^export\s+default\s+(\w+)/gm

  let match
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      kind: 'declaration',
      line: content.substring(0, match.index).split('\n').length,
    })
  }

  while ((match = namedExportRegex.exec(content)) !== null) {
    const names = match[1]
      .split(',')
      .map((n) => n.trim().split(' as ')[0].trim())
      .filter(Boolean)
    for (const name of names) {
      exports.push({
        name,
        kind: 'named',
        line: content.substring(0, match.index).split('\n').length,
      })
    }
  }

  while ((match = defaultExportRegex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      kind: 'default',
      line: content.substring(0, match.index).split('\n').length,
    })
  }

  return exports
}

function detectPlatform(content, filePath) {
  const platforms = new Set()
  const normPath = normalizePath(filePath).toLowerCase()

  // Platform detection based on file location (much more reliable than content keywords)
  if (normPath.startsWith('apps/mobile/') || normPath.startsWith('packages/mobile-ui/')) {
    platforms.add('REACT_NATIVE')
    platforms.add('HERMES')
    platforms.add('EXPO')
    platforms.add('MOBILE_ONLY')
  } else if (
    normPath.startsWith('apps/desktop/') ||
    normPath.startsWith('apps/desktop/electron/')
  ) {
    platforms.add('ELECTRON')
    platforms.add('NODE')
    platforms.add('WINDOWS_ONLY')
  } else if (normPath.startsWith('apps/web/') || normPath.startsWith('apps/admin/')) {
    platforms.add('BROWSER')
    platforms.add('WEB_ONLY')
  } else if (normPath.startsWith('backend/')) {
    platforms.add('NODE')
    platforms.add('SERVER_ONLY')
  } else if (normPath.startsWith('packages/')) {
    // Shared packages - determine by package name
    if (normPath.includes('mobile-ui')) {
      platforms.add('REACT_NATIVE')
      platforms.add('HERMES')
      platforms.add('EXPO')
      platforms.add('MOBILE_ONLY')
    } else if (normPath.includes('app-shell') || normPath.includes('app-bridge')) {
      platforms.add('PLATFORM_ADAPTER')
    } else if (normPath.includes('local-engine') || normPath.includes('sync')) {
      platforms.add('OFFLINE_ENGINE')
      platforms.add('REACT_NATIVE')
      platforms.add('HERMES')
      platforms.add('EXPO')
    } else {
      platforms.add('SHARED')
    }
  } else {
    platforms.add('SHARED')
  }

  // Also check for explicit platform-specific imports in content as secondary signal
  const lowerContent = content.toLowerCase()
  if (
    lowerContent.includes("from 'electron'") ||
    lowerContent.includes('from "electron"') ||
    lowerContent.includes("require('electron')") ||
    lowerContent.includes('require("electron")')
  ) {
    platforms.add('ELECTRON')
  }
  if (
    lowerContent.includes("from 'react-native'") ||
    lowerContent.includes('from "react-native"')
  ) {
    platforms.add('REACT_NATIVE')
  }
  if (
    lowerContent.includes("from 'expo'") ||
    lowerContent.includes('from "expo"') ||
    lowerContent.includes('@expo/')
  ) {
    platforms.add('EXPO')
  }

  return Array.from(platforms)
}

function detectDomain(filePath, content) {
  const normPath = normalizePath(filePath).toLowerCase()
  const lowerContent = content.toLowerCase()
  const domains = new Set()

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    for (const keyword of keywords) {
      if (
        normPath.includes(keyword.toLowerCase()) ||
        lowerContent.includes(keyword.toLowerCase())
      ) {
        domains.add(domain)
        break
      }
    }
  }

  if (domains.size === 0) {
    if (
      normPath.includes('shared') ||
      normPath.includes('common') ||
      normPath.includes('lib') ||
      normPath.includes('util')
    ) {
      domains.add('SHARED')
    }
  }

  return Array.from(domains)
}

function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

function categorizePackage(pkgPath) {
  const norm = normalizePath(pkgPath)
  if (norm.startsWith('apps/')) return 'app'
  if (norm.startsWith('packages/')) return 'package'
  if (norm === 'backend') return 'backend'
  return 'unknown'
}

function getPackageInfo(pkgPath) {
  const pkgJsonPath = join(ROOT, pkgPath, 'package.json')
  if (!existsSync(pkgJsonPath)) return null

  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
  return {
    name: pkg.name || basename(pkgPath),
    version: pkg.version,
    main: pkg.main,
    types: pkg.types,
    scripts: pkg.scripts ? Object.keys(pkg.scripts) : [],
    dependencies: pkg.dependencies ? Object.keys(pkg.dependencies) : [],
    devDependencies: pkg.devDependencies ? Object.keys(pkg.devDependencies) : [],
    peerDependencies: pkg.peerDependencies ? Object.keys(pkg.peerDependencies) : [],
  }
}

function scanWorkspace() {
  const workspaces = ['apps/*', 'packages/*', 'backend']
  const packages = []

  for (const ws of workspaces) {
    if (ws.includes('*')) {
      const baseDir = join(ROOT, ws.split('*')[0])
      if (existsSync(baseDir)) {
        const entries = readdirSync(baseDir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) {
            const pkgPath = join(ws.split('*')[0], entry.name)
            const info = getPackageInfo(pkgPath)
            if (info) {
              packages.push({ path: pkgPath, ...info, type: categorizePackage(pkgPath) })
            }
          }
        }
      }
    } else {
      const info = getPackageInfo(ws)
      if (info) {
        packages.push({ path: ws, ...info, type: categorizePackage(ws) })
      }
    }
  }

  return packages
}

function buildIndex() {
  console.log('Scanning workspace...')
  const packages = scanWorkspace()

  console.log('Scanning source files...')
  const allFiles = []
  for (const pkg of packages) {
    const pkgDir = join(ROOT, pkg.path)
    if (existsSync(pkgDir)) {
      const files = getAllSourceFiles(pkgDir, pkg.path)
      allFiles.push(...files)
    }
  }

  console.log(`Found ${allFiles.length} source files. Analyzing...`)

  const fileData = {}
  const symbolIndex = {}
  const packageDeps = {}
  const routes = []

  for (const file of allFiles) {
    const content = readFileContent(file)
    if (!content) continue

    const imports = extractImports(content)
    const exports = extractExports(content)
    const platforms = detectPlatform(content, file)
    const domains = detectDomain(file, content)

    fileData[file] = {
      imports,
      importedBy: [],
      platform: platforms.length > 0 ? platforms : ['SHARED'],
      domain: domains.length > 0 ? domains : ['SHARED'],
      exports: exports.map((e) => e.name),
      size: content.length,
      lines: content.split('\n').length,
    }

    for (const exp of exports) {
      const key = `${file}::${exp.name}`
      symbolIndex[key] = {
        file,
        line: exp.line,
        name: exp.name,
        kind: exp.kind,
        domain: domains.length > 0 ? domains[0] : 'SHARED',
        platform: platforms.length > 0 ? platforms[0] : 'SHARED',
      }
    }

    if (file.includes('routes') && (file.endsWith('.routes.ts') || file.endsWith('.routes.js'))) {
      routes.push({ file, domain: domains[0] || 'SHARED' })
    }

    const pkgInfo = packages.find((p) => file.startsWith(p.path))
    if (pkgInfo) {
      if (!packageDeps[pkgInfo.name])
        packageDeps[pkgInfo.name] = { deps: new Set(), dependents: new Set() }
      for (const imp of imports) {
        if (imp.startsWith('@hisabche/') || imp.startsWith('../') || imp.startsWith('./')) {
          packageDeps[pkgInfo.name].deps.add(imp)
        }
      }
    }
  }

  // Build reverse imports
  for (const [file, data] of Object.entries(fileData)) {
    for (const imp of data.imports) {
      for (const [otherFile, otherData] of Object.entries(fileData)) {
        if (otherFile !== file) {
          const otherExports = otherData.exports
          const impName = imp.replace(/^\.+\//, '').replace(/@hisabche\//, '')
          if (otherExports.some((e) => imp.includes(e) || e.includes(impName))) {
            otherData.importedBy.push(file)
          }
        }
      }
    }
  }

  // Convert sets to arrays
  for (const pkg of Object.values(packageDeps)) {
    pkg.deps = Array.from(pkg.deps)
    pkg.dependents = Array.from(pkg.dependents)
  }

  const gitHash = getGitHash()
  const timestamp = new Date().toISOString()

  const graph = {
    metadata: {
      gitHash,
      timestamp,
      totalFiles: allFiles.length,
      totalSymbols: Object.keys(symbolIndex).length,
      totalPackages: packages.length,
    },
    packages,
    packageDeps,
    files: fileData,
    symbols: symbolIndex,
    routes,
  }

  writeFileSync(GRAPH_JSON, JSON.stringify(graph, null, 2))
  console.log(`Graph written to ${GRAPH_JSON}`)

  generateMarkdownMap(graph)
  console.log(`Map written to ${MAP_MD}`)

  return graph
}

function generateMarkdownMap(graph) {
  const { packages, metadata } = graph

  const apps = packages.filter((p) => p.type === 'app')
  const pkgs = packages.filter((p) => p.type === 'package')
  const backend = packages.find((p) => p.type === 'backend')

  let md = `# Hisabche Codebase Map\n\n`
  md += `Generated: ${metadata.timestamp} | Git: ${metadata.gitHash.substring(0, 8)} | Files: ${metadata.totalFiles} | Symbols: ${metadata.totalSymbols}\n\n`

  // 1. Workspace & App Topology
  md += `## 1. Workspace & App Topology\n\n`

  md += `### Apps\n`
  for (const app of apps) {
    const platform = getAppPlatform(app.path)
    const cmds = app.scripts || []
    md += `- **${app.name}** (\`${app.path}\`) — ${platform}\n`
    md += `  - Commands: ${cmds.join(', ') || 'none'}\n`
    md += `  - Deps: ${app.dependencies.slice(0, 10).join(', ')}${app.dependencies.length > 10 ? '…' : ''}\n`
  }

  md += `\n### Packages\n`
  for (const pkg of pkgs) {
    const platform = getPackagePlatform(pkg.path)
    md += `- **${pkg.name}** (\`${pkg.path}\`) — ${platform}\n`
    md += `  - Exports: ${pkg.main || 'none'}, Types: ${pkg.types || 'none'}\n`
    md += `  - Deps: ${pkg.dependencies.slice(0, 8).join(', ')}${pkg.dependencies.length > 8 ? '…' : ''}\n`
  }

  if (backend) {
    md += `\n### Backend\n`
    md += `- **${backend.name}** (\`${backend.path}\`) — SERVER_ONLY\n`
    md += `  - Entry: \`${backend.main || 'src/index.ts'}\`\n`
    md += `  - Deps: ${backend.dependencies.slice(0, 10).join(', ')}${backend.dependencies.length > 10 ? '…' : ''}\n`
  }

  // 2. Platform Hazard Map
  md += `\n## 2. Platform Hazard Map\n\n`
  const platformFiles = {}
  for (const [file, data] of Object.entries(graph.files)) {
    for (const platform of data.platform) {
      if (!platformFiles[platform]) platformFiles[platform] = []
      platformFiles[platform].push(file)
    }
  }

  const platformOrder = [
    'MOBILE_ONLY',
    'WINDOWS_ONLY',
    'WEB_ONLY',
    'SERVER_ONLY',
    'PLATFORM_ADAPTER',
    'OFFLINE_ENGINE',
    'SHARED',
    'REACT_NATIVE',
    'HERMES',
    'EXPO',
    'ELECTRON',
    'NODE',
    'BROWSER',
  ]
  for (const platform of platformOrder) {
    const files = platformFiles[platform]
    if (!files || files.length === 0) continue
    md += `### ${platform}\n`
    const uniqueFiles = [...new Set(files)].slice(0, 15)
    for (const f of uniqueFiles) {
      md += `- \`${f}\`\n`
    }
    if (files.length > 15) md += `- … and ${files.length - 15} more\n`
    md += `\n`
  }

  // 3. Domain Ownership Matrix
  md += `## 3. Domain Ownership Matrix\n\n`
  const domainMap = buildDomainMap(graph)

  const domains = [
    'Invoices',
    'POS',
    'Inventory',
    'Warehouse',
    'Customers',
    'Payments',
    'Accounting',
    'Employees',
    'Manufacturing',
    'Reports',
    'Settings',
    'Auth',
    'Offline',
    'Sync',
    'Migration',
    'Permissions',
    'Localization',
  ]

  for (const domain of domains) {
    const info = domainMap[domain]
    if (!info) continue
    md += `### ${domain}\n`
    if (info.sharedLogic) md += `- **Shared Logic**: \`${info.sharedLogic.join('`, `')}\`\n`
    if (info.uiEntry.size > 0)
      md += `- **UI Entry**: \`${Array.from(info.uiEntry).join('`, `')}\`\n`
    if (info.hooks) md += `- **Hooks/Store**: \`${info.hooks.join('`, `')}\`\n`
    if (info.apiRoutes) md += `- **API Routes**: \`${info.apiRoutes.join('`, `')}\`\n`
    if (info.dbSchema) md += `- **DB/Schema**: \`${info.dbSchema.join('`, `')}\`\n`
    if (info.offlineSync) md += `- **Offline/Sync**: \`${info.offlineSync.join('`, `')}\`\n`
    md += `\n`
  }

  // 4. Data Flow Templates
  md += `## 4. End-to-End Data Flow Templates\n\n`
  md += `### Online Flow\n`
  md += `\`\`\`text\nUI → Hook → Query/Mutation → API Route → Service → Repository → Postgres\n\`\`\`\n\n`
  md += `### Offline Flow\n`
  md += `\`\`\`text\nUI → Shared Hook → Local Engine → Local DB → Sync Engine → Server → Postgres\n\`\`\`\n\n`

  // Key entry points
  md += `## 5. High-Confidence Entry Points\n\n`
  for (const domain of domains) {
    const info = domainMap[domain]
    if (info && info.primary) {
      md += `- **${domain}**: ${info.primary.map((p) => `\`${p}\``).join(' → ')}\n`
    }
  }

  writeFileSync(MAP_MD, md)
}

function getAppPlatform(appPath) {
  const norm = normalizePath(appPath)
  if (norm.includes('web')) return 'WEB_ONLY (Next.js)'
  if (norm.includes('mobile')) return 'MOBILE_ONLY (Expo/React Native/Android)'
  if (norm.includes('desktop')) return 'WINDOWS_ONLY (Electron)'
  if (norm.includes('admin')) return 'WEB_ONLY (Next.js Admin)'
  return 'UNKNOWN'
}

function getPackagePlatform(pkgPath) {
  const norm = normalizePath(pkgPath)
  if (norm.includes('mobile-ui')) return 'MOBILE_ONLY'
  if (norm.includes('app-shell') || norm.includes('app-bridge')) return 'PLATFORM_ADAPTER'
  if (norm.includes('local-engine') || norm.includes('sync')) return 'OFFLINE_ENGINE'
  if (norm.includes('ui') && !norm.includes('mobile')) return 'SHARED (Web/Desktop)'
  if (norm.includes('api')) return 'SHARED (Client)'
  if (norm.includes('auth')) return 'SHARED'
  if (
    norm.includes('validation') ||
    norm.includes('formatting') ||
    norm.includes('i18n') ||
    norm.includes('store') ||
    norm.includes('config') ||
    norm.includes('design-tokens') ||
    norm.includes('db-schema')
  )
    return 'SHARED'
  return 'SHARED'
}

function buildDomainMap(graph) {
  const domainMap = {}
  const { symbols } = graph

  for (const sym of Object.values(symbols)) {
    const domain = sym.domain
    if (!domainMap[domain]) {
      domainMap[domain] = {
        sharedLogic: new Set(),
        uiEntry: new Set(),
        hooks: new Set(),
        apiRoutes: new Set(),
        dbSchema: new Set(),
        offlineSync: new Set(),
        primary: [],
      }
    }

    const file = normalizePath(sym.file)
    if (file.includes('domain') || file.includes('service') || file.includes('.domain.ts')) {
      domainMap[domain].sharedLogic.add(sym.file)
    }
    if (file.includes('hook') || (file.includes('use') && sym.kind === 'declaration')) {
      domainMap[domain].hooks.add(sym.file)
    }
    if (file.includes('routes') && file.endsWith('.routes.ts')) {
      domainMap[domain].apiRoutes.add(sym.file)
    }
    if (file.includes('schema') || file.includes('drizzle') || file.includes('db')) {
      domainMap[domain].dbSchema.add(sym.file)
    }
    if (file.includes('offline') || file.includes('sync') || file.includes('local-engine')) {
      domainMap[domain].offlineSync.add(sym.file)
    }
    if (
      file.includes('screen') ||
      file.includes('page') ||
      file.includes('component') ||
      file.includes('hub')
    ) {
      domainMap[domain].uiEntry.add(sym.file)
    }
  }

  // Determine primary entry points per domain
  for (const info of Object.values(domainMap)) {
    const candidates = [...info.sharedLogic, ...info.uiEntry, ...info.hooks, ...info.apiRoutes]
    info.primary = [...new Set(candidates)].slice(0, 3)
    info.sharedLogic = [...info.sharedLogic].slice(0, 5)
    info.uiEntry = [...info.uiEntry].slice(0, 5)
    info.hooks = [...info.hooks].slice(0, 5)
    info.apiRoutes = [...info.apiRoutes].slice(0, 5)
    info.dbSchema = [...info.dbSchema].slice(0, 5)
    info.offlineSync = [...info.offlineSync].slice(0, 5)
  }

  return domainMap
}

// Run
buildIndex()
console.log('Done!')
