import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const root = 'C:/Users/hamed/Desktop/hisabche'
const adminRoot = path.join(root, 'apps/admin')
const skip = new Set(['node_modules', '.next', '__tests__', 'dist'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'next-env.d.ts') out.push(full)
  }
  return out
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const bundles = {}
for (const locale of ['fa', 'af', 'en']) {
  bundles[locale] = JSON.parse(
    readFileSync(path.join(root, `packages/i18n/messages/${locale}/common.json`), 'utf8'),
  )
}

function lookup(source, dotted) {
  let node = source
  for (const part of dotted.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = node[part]
  }
  return node
}

const uses = new Map()
for (const file of walk(adminRoot)) {
  const rel = path.relative(adminRoot, file).replace(/\\/g, '/')
  const source = stripComments(readFileSync(file, 'utf8'))
  const regexes = [/\bt\(\s*'([a-zA-Z0-9_.]+)'/g, /labelKey:\s*'([a-zA-Z0-9_.]+)'/g]
  for (const re of regexes) {
    let match
    while ((match = re.exec(source)) !== null) {
      const key = match[1]
      if (!key.includes('.')) continue
      if (!uses.has(key)) uses.set(key, new Set())
      uses.get(key).add(rel)
    }
  }
}

const missing = []
for (const [key, files] of uses) {
  for (const locale of ['fa', 'af', 'en']) {
    const value = lookup(bundles[locale], key)
    if (typeof value !== 'string' || value.trim() === '') {
      missing.push(`${locale} | ${key} | ${[...files].join(', ')}`)
    }
  }
}

console.log(`keys used: ${uses.size}`)
console.log(`missing entries: ${missing.length}`)
for (const line of missing.sort((a, b) =>
  (a.split('|')[1] ?? '').localeCompare(b.split('|')[1] ?? ''),
)) {
  console.log(line)
}
