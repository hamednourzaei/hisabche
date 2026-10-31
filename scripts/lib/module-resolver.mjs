/**
 * High-Performance Deterministic Module Resolver for Hisabche
 * Resolves relative imports, tsconfig path aliases, workspace packages, and external packages.
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'

const ROOT = process.cwd()

/**
 * Normalizes file path to forward slashes and relative to monorepo root
 */
export function normalizePath(p) {
  if (!p) return ''
  const rel = relative(ROOT, resolve(ROOT, p))
  return rel.replace(/\\/g, '/')
}

/**
 * Common source extensions to check in priority order
 */
const EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.d.ts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '/index.ts',
  '/index.tsx',
  '/index.d.ts',
  '/index.js',
  '/index.jsx',
  '/index.mjs',
]

/**
 * Loads and merges tsconfig path aliases from root and packages
 */
export function loadPathAliases() {
  const aliases = new Map()

  // 1. Root tsconfig
  const rootTsconfigPath = join(ROOT, 'tsconfig.json')
  if (existsSync(rootTsconfigPath)) {
    try {
      const parsed = JSON.parse(readFileSync(rootTsconfigPath, 'utf8'))
      const paths = parsed.compilerOptions?.paths || {}
      for (const [pattern, targets] of Object.entries(paths)) {
        aliases.set(
          pattern,
          targets.map((t) => t.replace(/^\.\//, '')),
        )
      }
    } catch {}
  }

  // 2. Package tsconfigs (e.g. apps/web, apps/desktop, packages/ui)
  const pkgConfigs = [
    'apps/web/tsconfig.json',
    'apps/desktop/tsconfig.json',
    'packages/ui/tsconfig.json',
    'backend/tsconfig.json',
  ]

  for (const cfgRel of pkgConfigs) {
    const cfgPath = join(ROOT, cfgRel)
    if (existsSync(cfgPath)) {
      try {
        const parsed = JSON.parse(readFileSync(cfgPath, 'utf8'))
        const paths = parsed.compilerOptions?.paths || {}
        const baseDir = dirname(cfgRel)
        for (const [pattern, targets] of Object.entries(paths)) {
          if (!aliases.has(pattern)) {
            aliases.set(
              pattern,
              targets.map((t) => normalizePath(join(baseDir, t))),
            )
          }
        }
      } catch {}
    }
  }

  return aliases
}

/**
 * Workspace package map: packageName -> rootRelativePath
 */
export function loadWorkspacePackageMap(packages = []) {
  const map = new Map()
  for (const pkg of packages) {
    if (pkg.name && pkg.path) {
      map.set(pkg.name, pkg.path)
    }
  }
  return map
}

/**
 * Checks if candidate path points to an existing file
 */
function fileExists(absolutePath) {
  try {
    return existsSync(absolutePath) && statSync(absolutePath).isFile()
  } catch {
    return false
  }
}

/**
 * Resolves a module specifier from a source file
 * @param {string} fromFile - Relative path of importing file (e.g. "packages/local-engine/src/db.ts")
 * @param {string} specifier - Import string (e.g. "./routes", "@hisabche/validation", "fastify")
 * @param {object} options - Resolver options (aliases, workspacePackages)
 * @returns {object} { resolvedPath: string | null, status: 'RESOLVED' | 'EXTERNAL' | 'UNRESOLVED', isExternal: boolean }
 */
export function resolveModule(fromFile, specifier, options = {}) {
  const aliases = options.aliases || loadPathAliases()
  const workspacePackages = options.workspacePackages || new Map()

  if (!specifier || typeof specifier !== 'string') {
    return { resolvedPath: null, status: 'UNRESOLVED', isExternal: false }
  }

  // 1. Relative imports (./ or ../)
  if (specifier.startsWith('.')) {
    const fromDir = dirname(join(ROOT, fromFile))
    const targetBase = resolve(fromDir, specifier)

    for (const ext of EXTENSIONS) {
      const candidate = targetBase + ext
      if (fileExists(candidate)) {
        return {
          resolvedPath: normalizePath(candidate),
          status: 'RESOLVED',
          isExternal: false,
        }
      }
    }
    return { resolvedPath: null, status: 'UNRESOLVED', isExternal: false }
  }

  // 2. TypeScript Path Aliases (e.g. @hisabche/validation, @/components, @hisabche/ui/*)
  for (const [pattern, targets] of aliases.entries()) {
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1)
      if (specifier.startsWith(prefix)) {
        const suffix = specifier.slice(prefix.length)
        for (const target of targets) {
          const targetPrefix = target.endsWith('*') ? target.slice(0, -1) : target
          const candidateBase = resolve(ROOT, targetPrefix, suffix)
          for (const ext of EXTENSIONS) {
            const candidate = candidateBase + ext
            if (fileExists(candidate)) {
              return {
                resolvedPath: normalizePath(candidate),
                status: 'RESOLVED',
                isExternal: false,
              }
            }
          }
        }
      }
    } else if (pattern === specifier) {
      for (const target of targets) {
        const candidateBase = resolve(ROOT, target)
        for (const ext of EXTENSIONS) {
          const candidate = candidateBase + ext
          if (fileExists(candidate)) {
            return {
              resolvedPath: normalizePath(candidate),
              status: 'RESOLVED',
              isExternal: false,
            }
          }
        }
      }
    }
  }

  // 3. Workspace Packages (e.g. @hisabche/formatting -> packages/formatting/src/index.ts)
  if (specifier.startsWith('@hisabche/')) {
    const subpathMatch = specifier.match(/^@hisabche\/([^/]+)\/(.+)$/)
    if (subpathMatch) {
      const [, pName, sub] = subpathMatch
      const subCandidates = [
        `packages/${pName}/src/${sub}`,
        `packages/${pName}/${sub}`,
        `apps/${pName}/src/${sub}`,
        `apps/${pName}/${sub}`,
      ]
      for (const base of subCandidates) {
        for (const ext of EXTENSIONS) {
          const candidate = join(ROOT, base + ext)
          if (fileExists(candidate)) {
            return {
              resolvedPath: normalizePath(candidate),
              status: 'RESOLVED',
              isExternal: false,
            }
          }
        }
      }
    } else {
      const pkgName = specifier.split('/')[1]
      const candidates = [
        pkgName === 'backend' ? 'backend/src/index.ts' : '',
        pkgName === 'backend' ? 'backend/index.ts' : '',
        `packages/${pkgName}/src/index.ts`,
        `packages/${pkgName}/src/index.tsx`,
        `packages/${pkgName}/index.ts`,
        `packages/${pkgName}/src/index.js`,
        `apps/${pkgName}/src/index.ts`,
      ].filter(Boolean)
      for (const cand of candidates) {
        const full = join(ROOT, cand)
        if (fileExists(full)) {
          return {
            resolvedPath: normalizePath(cand),
            status: 'RESOLVED',
            isExternal: false,
          }
        }
      }
    }
  }

  // 4. External npm / Node built-in packages
  const isNodeBuiltin =
    specifier.startsWith('node:') ||
    [
      'fs',
      'path',
      'crypto',
      'child_process',
      'os',
      'http',
      'https',
      'stream',
      'events',
      'util',
      'url',
    ].includes(specifier)

  if (isNodeBuiltin || (!specifier.startsWith('.') && !specifier.startsWith('/'))) {
    return {
      resolvedPath: specifier,
      status: 'EXTERNAL',
      isExternal: true,
    }
  }

  return { resolvedPath: null, status: 'UNRESOLVED', isExternal: false }
}
