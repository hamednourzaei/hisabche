import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue
      walk(full, out)
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

function findTopLevelSideEffectFiles(pkgRoot: string): string[] {
  const srcRoot = path.join(pkgRoot, 'src')
  const files = walk(srcRoot)
  const result: string[] = []
  for (const file of files) {
    const clean = stripComments(fs.readFileSync(file, 'utf8'))
    const rel = `./${path.relative(pkgRoot, file).replace(/\\/g, '/')}`
    const lines = clean.split('\n')
    let hasSideEffect = false
    for (const line of lines) {
      if (/^\s*import\s+['"][^'"]+['"]/.test(line)) {
        hasSideEffect = true
        break
      }
      if (/^\s*import\s+.*['"][^'"]+\.css['"]/.test(line)) {
        hasSideEffect = true
        break
      }
      if (
        /^[a-zA-Z_$][\w$.]*\s*\(/.test(line) &&
        !/^(function|if|for|while|switch|catch)\b/.test(line)
      ) {
        hasSideEffect = true
        break
      }
      if (/^(window|document|globalThis)\./.test(line)) {
        hasSideEffect = true
        break
      }
    }
    if (hasSideEffect) result.push(rel)
  }
  return result
}

describe('sideEffects declaration guard (V62 Slice 2)', () => {
  it('declares every top-level side-effect file in packages/ui/package.json', () => {
    const uiRoot = path.resolve(__dirname, '../..')
    const pkg = JSON.parse(fs.readFileSync(path.join(uiRoot, 'package.json'), 'utf8')) as {
      sideEffects?: string[]
    }
    expect(Array.isArray(pkg.sideEffects)).toBe(true)
    const declared = new Set(pkg.sideEffects ?? [])
    expect(declared.has('**/*.css')).toBe(true)

    const detected = findTopLevelSideEffectFiles(uiRoot)
    for (const rel of detected) {
      const coveredByCss = rel.endsWith('.css') && declared.has('**/*.css')
      expect(
        coveredByCss || declared.has(rel),
        `File ${rel} has top-level side effects and must be listed in packages/ui/package.json#sideEffects`,
      ).toBe(true)
    }
  })

  it('declares every top-level side-effect file in packages/api/package.json', () => {
    const apiRoot = path.resolve(__dirname, '../../../api')
    const pkg = JSON.parse(fs.readFileSync(path.join(apiRoot, 'package.json'), 'utf8')) as {
      sideEffects?: string[]
    }
    expect(Array.isArray(pkg.sideEffects)).toBe(true)
    const declared = new Set(pkg.sideEffects ?? [])

    const detected = findTopLevelSideEffectFiles(apiRoot)
    for (const rel of detected) {
      expect(
        declared.has(rel),
        `File ${rel} has top-level side effects and must be listed in packages/api/package.json#sideEffects`,
      ).toBe(true)
    }
  })
})
