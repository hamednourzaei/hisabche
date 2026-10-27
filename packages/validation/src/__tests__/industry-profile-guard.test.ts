// ============================================
// STRUCTURAL GUARD — industry is a row, never a branch.
//
// Every new trade is ONE row in `industry-profiles.ts`. The moment a page,
// service or engine writes `industry === 'jewellery'` (or a switch on
// `businessType`), the product has started growing a second, scattered
// definition of what an industry means — the exact failure this architecture
// exists to prevent.
//
// This guard parses the TypeScript AST instead of grepping text, so a comment
// or a string that merely mentions an industry is not a false positive, while
// `x.businessType === 'gold'` is caught wherever it hides.
// ============================================

import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import * as ts from 'typescript'

const REPO_ROOT = resolve(__dirname, '../../../..')

/** Identifiers that mean «the selected industry» in this codebase. */
const INDUSTRY_IDENTIFIERS = new Set([
  'industry',
  'industries',
  'businessType',
  'businessTypes',
  'business_type',
  'business_types',
])

/**
 * The registry, its resolver and tests are the places allowed to name an
 * industry. Tests are excluded because they must be able to name the value
 * they assert.
 */
const ALLOWED = [
  'packages/validation/src/schemas/industry-profiles.ts',
  'packages/validation/src/schemas/business-capabilities.ts',
]

const SCAN_ROOTS = ['packages', 'backend/src']

function normalise(path: string): string {
  return path.split(sep).join('/')
}

function isAllowed(relativePath: string): boolean {
  const file = normalise(relativePath)
  if (ALLOWED.includes(file)) return true
  if (file.includes('/__tests__/')) return true
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) return true
  return false
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue
    const path = join(dir, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...collectSourceFiles(path))
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(path)
  }
  return out
}

function identifierName(node: ts.Node): string | null {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  if (ts.isElementAccessExpression(node)) {
    const argument = node.argumentExpression
    if (ts.isStringLiteral(argument)) return argument.text
  }
  return null
}

function isStringLiteral(node: ts.Node): boolean {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

/** Every comparison against a literal industry value, with its line. */
export function findIndustryBranches(source: string, fileName: string): string[] {
  const scriptKind = fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.ES2022, true, scriptKind)
  const found: string[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isBinaryExpression(node)) {
      const operator = node.operatorToken.kind
      const compares = [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(operator)
      if (compares) {
        const left = identifierName(node.left)
        const right = identifierName(node.right)
        const name = left && INDUSTRY_IDENTIFIERS.has(left) ? left : right
        if (name && INDUSTRY_IDENTIFIERS.has(name)) {
          if (isStringLiteral(node.left) || isStringLiteral(node.right)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
            found.push(`${normalise(fileName)}:${line + 1} — ${node.getText(sourceFile)}`)
          }
        }
      }
    }

    if (ts.isSwitchStatement(node)) {
      const name = identifierName(node.expression)
      if (name && INDUSTRY_IDENTIFIERS.has(name)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
        found.push(
          `${normalise(fileName)}:${line + 1} — switch (${node.expression.getText(sourceFile)})`,
        )
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return found
}

describe('industry is a registry row, not a branch', () => {
  it('no source outside the registry compares an industry to a literal', () => {
    const violations: string[] = []

    for (const root of SCAN_ROOTS) {
      const absolute = resolve(REPO_ROOT, root)
      for (const file of collectSourceFiles(absolute)) {
        const relativePath = normalise(relative(REPO_ROOT, file))
        if (isAllowed(relativePath)) continue
        const source = readFileSync(file, 'utf8')
        violations.push(...findIndustryBranches(source, relativePath))
      }
    }

    expect(violations).toEqual([])
  }, 60_000)

  it('the detector itself catches the shape it exists for', () => {
    const source = `
      export function priceFor(businessType: string) {
        if (businessType === 'jewellery') return 'gram'
        switch (businessType) { case 'grocery': return 'piece' }
        return 'piece'
      }
    `
    const found = findIndustryBranches(source, 'fixture.ts')
    expect(found.length).toBeGreaterThanOrEqual(2)
  })
})
