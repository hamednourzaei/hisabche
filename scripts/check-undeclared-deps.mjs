// Finds imports a workspace package uses but does not declare in its own
// package.json. pnpm links only declared dependencies, so such an import works
// on a machine where the package happens to be hoisted and fails on a strict
// install (CI): `@hisabche/sync` imported `@hisabche/validation` this way and
// broke the mobile and desktop bundles.
//
//   node scripts/check-undeclared-deps.mjs
//
// Exit code 1 when anything is undeclared. Test files and type-only imports
// are skipped; `@types/*` of a declared package are not required.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]))
const IMPORT =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^'"\n]*?\sfrom\s+)?['"]([^'"\n]+)['"]|\brequire\(\s*['"]([^'"\n]+)['"]\s*\)|\bimport\(\s*['"]([^'"\n]+)['"]\s*\)/g

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (
      name === 'node_modules' ||
      name === 'dist' ||
      name === '.next' ||
      name === 'out' ||
      name.startsWith('.')
    )
      continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      if (name === '__tests__' || name === 'e2e' || name === '__mocks__') continue
      yield* walk(path)
    } else if (
      /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(name) &&
      !/\.(test|spec)\./.test(name) &&
      !name.endsWith('.d.ts')
    ) {
      yield path
    }
  }
}

const packageName = (spec) => {
  if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || spec.startsWith('~'))
    return null
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const dirs = []
for (const group of ['packages', 'apps']) {
  if (!existsSync(join(root, group))) continue
  for (const name of readdirSync(join(root, group))) dirs.push(join(root, group, name))
}

let problems = 0
for (const dir of dirs) {
  const pkgFile = join(dir, 'package.json')
  if (!existsSync(pkgFile) || !existsSync(join(dir, 'src'))) continue
  const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
  const declared = new Set([
    pkg.name,
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
  ])
  const missing = new Map()
  for (const file of walk(join(dir, 'src'))) {
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(IMPORT)) {
      const name = packageName(match[1] ?? match[2] ?? match[3] ?? '')
      if (!name || builtins.has(name) || declared.has(name)) continue
      if (!missing.has(name))
        missing.set(name, file.replace(root + '\\', '').replace(root + '/', ''))
    }
  }
  for (const [name, file] of missing) {
    problems++
    console.log(`${pkg.name}: imports "${name}" but does not declare it (first seen in ${file})`)
  }
}
console.log(problems === 0 ? 'every import is declared' : `${problems} undeclared import(s)`)
process.exit(problems === 0 ? 0 : 1)
