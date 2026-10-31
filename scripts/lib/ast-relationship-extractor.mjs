/**
 * AST-Backed Relationship Extractor for Hisabche
 * Extracts verified module, symbol, and test relationships using TypeScript Compiler API.
 */

import ts from 'typescript'
import crypto from 'node:crypto'
import { resolveModule, normalizePath } from './module-resolver.mjs'
import { inferPackageName } from './ast-symbol-extractor.mjs'

/**
 * Computes deterministic SHA-256 hash of normalized LF text
 */
function computeSha256(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * Generates a stable deterministic relationship ID
 */
export function generateRelationshipId(type, sourceId, targetId, file, line, col) {
  const base = `${type}:${sourceId}->${targetId}:${file}:${line}:${col}`
  const hash = crypto.createHash('sha256').update(base, 'utf8').digest('hex').slice(0, 16)
  return `rel:${type}:${hash}`
}

/**
 * Known JavaScript/TypeScript global functions and identifiers
 */
const GLOBAL_SYMBOLS = new Set([
  'fetch',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'setImmediate',
  'clearImmediate',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'encodeURI',
  'encodeURIComponent',
  'decodeURI',
  'decodeURIComponent',
  'structuredClone',
  'queueMicrotask',
  'atob',
  'btoa',
  'eval',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'Promise',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Array',
  'Object',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'Date',
  'RegExp',
  'JSON',
  'Math',
  'Reflect',
  'Proxy',
  'Intl',
])

/**
 * Resolves a symbol's canonical ID through a potential re-export chain
 */
export function resolveCanonicalSymbolId(
  targetFile,
  remoteName,
  symbolIndex = {},
  reExportsMap = new Map(),
) {
  if (!targetFile) return null
  const directKey = `${targetFile}::${remoteName}`
  if (symbolIndex[directKey]) {
    return symbolIndex[directKey].id
  }

  // Follow re-exports if targetFile re-exports from another file
  const reExports = reExportsMap.get(targetFile) || []
  for (const reExp of reExports) {
    if (reExp.names.has(remoteName) || reExp.isStar) {
      const canonicalKey = `${reExp.targetFile}::${remoteName}`
      if (symbolIndex[canonicalKey]) {
        return symbolIndex[canonicalKey].id
      }
      // Follow one deeper level if needed
      const nestedReExports = reExportsMap.get(reExp.targetFile) || []
      for (const nested of nestedReExports) {
        if (nested.names.has(remoteName) || nested.isStar) {
          const nestedKey = `${nested.targetFile}::${remoteName}`
          if (symbolIndex[nestedKey]) {
            return symbolIndex[nestedKey].id
          }
        }
      }
    }
  }

  // Fallback to synthetic stable ID
  const pkg = inferPackageName(targetFile)
  return `${pkg}/${targetFile}#${remoteName}`
}

/**
 * Extracts all relationships from a single source file
 * @param {string} filePath - Relative file path (e.g. packages/local-engine/src/db.ts)
 * @param {string} sourceCode - Raw file text
 * @param {object} options - Extraction options
 * @returns {Array<object>} Array of typed relationship records
 */
export function extractFileRelationships(filePath, sourceCode, options = {}) {
  const normFile = normalizePath(filePath)
  const isTestFile = /\.(test|spec)\.(ts|tsx|js|mjs)$/.test(normFile)
  const pkgName = options.packageName || inferPackageName(normFile)
  const symbolIndex = options.symbolIndex || {}
  const reExportsMap = options.reExportsMap || new Map()
  const localSymbols = options.fileSymbols || []

  // Fast lookup for local symbols declared in this file
  const localSymbolsByName = new Map()
  for (const sym of localSymbols) {
    localSymbolsByName.set(sym.name, sym)
  }

  const scriptKind = normFile.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : normFile.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : normFile.endsWith('.ts')
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS

  let sourceFile
  try {
    sourceFile = ts.createSourceFile(normFile, sourceCode, ts.ScriptTarget.Latest, true, scriptKind)
  } catch {
    return []
  }

  const relationships = []
  const relationshipsSet = new Set() // Prevent duplicate identical edges
  const importedBindings = new Map() // localName -> { targetFile, remoteName, isExternal, isTypeOnly }
  const namespaceImports = new Map() // localNs -> { targetFile, isExternal }

  function addRelationship(rel) {
    const key = `${rel.type}:${rel.sourceId}->${rel.targetId}:${rel.startLine}:${rel.startColumn}`
    if (relationshipsSet.has(key)) return
    relationshipsSet.add(key)

    const id = generateRelationshipId(
      rel.type,
      rel.sourceId,
      rel.targetId,
      normFile,
      rel.startLine,
      rel.startColumn,
    )

    relationships.push({
      id,
      type: rel.type,
      sourceId: rel.sourceId,
      targetId: rel.targetId,
      file: normFile,
      startLine: rel.startLine,
      startColumn: rel.startColumn,
      endLine: rel.endLine,
      endColumn: rel.endColumn,
      rawIdentifier: rel.rawIdentifier,
      status: rel.status,
      evidence: rel.evidence,
      sourceHash: rel.sourceHash || '',
    })
  }

  // PASS 1: Extract module imports and re-exports
  for (const stmt of sourceFile.statements) {
    const startLoc = sourceFile.getLineAndCharacterOfPosition(stmt.getStart(sourceFile))
    const endLoc = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd())
    const startLine = startLoc.line + 1
    const startColumn = startLoc.character + 1
    const endLine = endLoc.line + 1
    const endColumn = endLoc.character + 1
    const stmtHash = computeSha256(stmt.getText(sourceFile))

    // 1. Import Declaration
    if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier) {
      const specifier = stmt.moduleSpecifier.text
      const resolution = resolveModule(normFile, specifier, options)
      const isTypeOnly = !!stmt.importClause?.isTypeOnly
      const targetId = resolution.resolvedPath || specifier

      // Module-level relationship
      addRelationship({
        type: 'IMPORTS',
        sourceId: normFile,
        targetId,
        startLine,
        startColumn,
        endLine,
        endColumn,
        rawIdentifier: specifier,
        status: resolution.status,
        evidence: 'AST_VERIFIED',
        sourceHash: stmtHash,
      })

      // Bind imported names
      if (stmt.importClause) {
        // Default import
        if (stmt.importClause.name) {
          importedBindings.set(stmt.importClause.name.text, {
            targetFile: resolution.resolvedPath,
            remoteName: 'default',
            isExternal: resolution.isExternal,
            isTypeOnly,
          })
        }

        // Named or Namespace imports
        if (stmt.importClause.namedBindings) {
          if (ts.isNamedImports(stmt.importClause.namedBindings)) {
            for (const spec of stmt.importClause.namedBindings.elements) {
              const localName = spec.name.text
              const remoteName = spec.propertyName ? spec.propertyName.text : localName
              importedBindings.set(localName, {
                targetFile: resolution.resolvedPath,
                remoteName,
                isExternal: resolution.isExternal,
                isTypeOnly: isTypeOnly || !!spec.isTypeOnly,
              })
            }
          } else if (ts.isNamespaceImport(stmt.importClause.namedBindings)) {
            namespaceImports.set(stmt.importClause.namedBindings.name.text, {
              targetFile: resolution.resolvedPath,
              isExternal: resolution.isExternal,
            })
          }
        }
      }
    }

    // 2. Re-export Declaration
    if (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier) {
      const specifier = stmt.moduleSpecifier.text
      const resolution = resolveModule(normFile, specifier, options)
      const targetId = resolution.resolvedPath || specifier

      addRelationship({
        type: 'RE_EXPORTS',
        sourceId: normFile,
        targetId,
        startLine,
        startColumn,
        endLine,
        endColumn,
        rawIdentifier: specifier,
        status: resolution.status,
        evidence: 'AST_VERIFIED',
        sourceHash: stmtHash,
      })
    }
  }

  // PASS 2: Traverse AST to extract symbol-level relationships (CALLS, EXTENDS, IMPLEMENTS, INSTANTIATES, USES_TYPE)
  let currentEnclosingSymbolId = `${pkgName}/${normFile}#file`

  function findEnclosingSymbolId(node) {
    const nodeStartLine =
      sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
    // Find symbol that contains this line
    for (const sym of localSymbols) {
      if (nodeStartLine >= sym.startLine && nodeStartLine <= sym.endLine) {
        return sym.id
      }
    }
    return currentEnclosingSymbolId
  }

  function visit(node) {
    // 1. Dynamic imports: import('./path')
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const loc = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const endLoc = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
      const arg = node.arguments[0]

      if (arg && ts.isStringLiteral(arg)) {
        const specifier = arg.text
        const resolution = resolveModule(normFile, specifier, options)
        addRelationship({
          type: 'DYNAMIC_IMPORTS',
          sourceId: normFile,
          targetId: resolution.resolvedPath || specifier,
          startLine: loc.line + 1,
          startColumn: loc.character + 1,
          endLine: endLoc.line + 1,
          endColumn: endLoc.character + 1,
          rawIdentifier: specifier,
          status: resolution.status,
          evidence: 'AST_VERIFIED',
          sourceHash: computeSha256(node.getText(sourceFile)),
        })
      } else {
        addRelationship({
          type: 'DYNAMIC_IMPORTS',
          sourceId: normFile,
          targetId: '<dynamic_expression>',
          startLine: loc.line + 1,
          startColumn: loc.character + 1,
          endLine: endLoc.line + 1,
          endColumn: endLoc.character + 1,
          rawIdentifier: node.getText(sourceFile),
          status: 'DYNAMIC_UNRESOLVED',
          evidence: 'STATIC_INFERENCE',
          sourceHash: computeSha256(node.getText(sourceFile)),
        })
      }
    }

    // 2. Class Heritage (EXTENDS, IMPLEMENTS)
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text
      const classSymbolId = `${pkgName}/${normFile}#${className}`

      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          const isExtends = clause.token === ts.SyntaxKind.ExtendsKeyword
          const relType = isExtends ? 'EXTENDS' : 'IMPLEMENTS'

          for (const typeNode of clause.types) {
            const loc = sourceFile.getLineAndCharacterOfPosition(typeNode.getStart(sourceFile))
            const rawName = typeNode.expression.getText(sourceFile)

            let targetId = rawName
            let status = 'UNRESOLVED'
            let evidence = 'STATIC_INFERENCE'

            if (importedBindings.has(rawName)) {
              const binding = importedBindings.get(rawName)
              if (binding.isExternal) {
                targetId = `${binding.targetFile}#${binding.remoteName}`
                status = 'EXTERNAL'
              } else if (binding.targetFile) {
                targetId = resolveCanonicalSymbolId(
                  binding.targetFile,
                  binding.remoteName,
                  symbolIndex,
                  reExportsMap,
                )
                status = 'RESOLVED'
                evidence = 'AST_VERIFIED'
              } else {
                targetId = rawName
                status = 'UNRESOLVED'
                evidence = 'STATIC_INFERENCE'
              }
            } else if (localSymbolsByName.has(rawName)) {
              targetId = localSymbolsByName.get(rawName).id
              status = 'RESOLVED'
              evidence = 'AST_VERIFIED'
            }

            addRelationship({
              type: relType,
              sourceId: classSymbolId,
              targetId,
              startLine: loc.line + 1,
              startColumn: loc.character + 1,
              endLine: loc.line + 1,
              endColumn: loc.character + rawName.length + 1,
              rawIdentifier: rawName,
              status,
              evidence,
              sourceHash: computeSha256(typeNode.getText(sourceFile)),
            })
          }
        }
      }
    }

    // 3. Constructor Instantiation: new Foo(...)
    if (ts.isNewExpression(node)) {
      const loc = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const endLoc = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
      const enclosingId = findEnclosingSymbolId(node)
      const rawExpr = node.expression.getText(sourceFile)

      if (ts.isIdentifier(node.expression)) {
        const rawName = node.expression.text
        let targetId = rawName
        let status = 'UNRESOLVED'
        let evidence = 'STATIC_INFERENCE'

        if (GLOBAL_SYMBOLS.has(rawName)) {
          targetId = `global:${rawName}`
          status = 'EXTERNAL'
        } else if (importedBindings.has(rawName)) {
          const binding = importedBindings.get(rawName)
          if (binding.isExternal) {
            targetId = `${binding.targetFile}#${binding.remoteName}`
            status = 'EXTERNAL'
          } else if (binding.targetFile) {
            targetId = resolveCanonicalSymbolId(
              binding.targetFile,
              binding.remoteName,
              symbolIndex,
              reExportsMap,
            )
            status = 'RESOLVED'
            evidence = 'AST_VERIFIED'
          } else {
            targetId = rawName
            status = 'UNRESOLVED'
            evidence = 'STATIC_INFERENCE'
          }
        } else if (localSymbolsByName.has(rawName)) {
          targetId = localSymbolsByName.get(rawName).id
          status = 'RESOLVED'
          evidence = 'AST_VERIFIED'
        }

        addRelationship({
          type: 'INSTANTIATES',
          sourceId: enclosingId,
          targetId,
          startLine: loc.line + 1,
          startColumn: loc.character + 1,
          endLine: endLoc.line + 1,
          endColumn: endLoc.character + 1,
          rawIdentifier: rawName,
          status,
          evidence,
          sourceHash: computeSha256(node.getText(sourceFile)),
        })
      }
    }

    // 4. Function & Method Calls (CALLS)
    if (ts.isCallExpression(node) && node.expression.kind !== ts.SyntaxKind.ImportKeyword) {
      const loc = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const endLoc = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
      const enclosingId = findEnclosingSymbolId(node)
      const expr = node.expression

      // Direct function call: foo()
      if (ts.isIdentifier(expr)) {
        const rawName = expr.text
        let targetId = rawName
        let status = 'UNRESOLVED'
        let evidence = 'STATIC_INFERENCE'

        if (GLOBAL_SYMBOLS.has(rawName)) {
          targetId = `global:${rawName}`
          status = 'EXTERNAL'
        } else if (importedBindings.has(rawName)) {
          const binding = importedBindings.get(rawName)
          if (binding.isExternal) {
            targetId = `${binding.targetFile}#${binding.remoteName}`
            status = 'EXTERNAL'
          } else if (binding.targetFile) {
            targetId = resolveCanonicalSymbolId(
              binding.targetFile,
              binding.remoteName,
              symbolIndex,
              reExportsMap,
            )
            status = 'RESOLVED'
            evidence = 'AST_VERIFIED'
          } else {
            targetId = rawName
            status = 'UNRESOLVED'
            evidence = 'STATIC_INFERENCE'
          }
        } else if (localSymbolsByName.has(rawName)) {
          targetId = localSymbolsByName.get(rawName).id
          status = 'RESOLVED'
          evidence = 'AST_VERIFIED'
        }

        addRelationship({
          type: 'CALLS',
          sourceId: enclosingId,
          targetId,
          startLine: loc.line + 1,
          startColumn: loc.character + 1,
          endLine: endLoc.line + 1,
          endColumn: endLoc.character + 1,
          rawIdentifier: rawName,
          status,
          evidence,
          sourceHash: computeSha256(node.getText(sourceFile)),
        })
      } else if (ts.isPropertyAccessExpression(expr)) {
        // Method or Namespace call
        const propName = expr.name.text
        const objExpr = expr.expression

        // this.method() or super.method()
        if (
          objExpr.kind === ts.SyntaxKind.ThisKeyword ||
          objExpr.kind === ts.SyntaxKind.SuperKeyword
        ) {
          // Inside a class
          let className = null
          for (const sym of localSymbols) {
            if (
              sym.kind === 'class' &&
              loc.line + 1 >= sym.startLine &&
              loc.line + 1 <= sym.endLine
            ) {
              className = sym.name
              break
            }
          }
          const targetId = className ? `${pkgName}/${normFile}#${className}.${propName}` : propName
          addRelationship({
            type: 'CALLS',
            sourceId: enclosingId,
            targetId,
            startLine: loc.line + 1,
            startColumn: loc.character + 1,
            endLine: endLoc.line + 1,
            endColumn: endLoc.character + 1,
            rawIdentifier: `this.${propName}`,
            status: className ? 'RESOLVED' : 'UNRESOLVED',
            evidence: 'AST_VERIFIED',
            sourceHash: computeSha256(node.getText(sourceFile)),
          })
        } else if (ts.isIdentifier(objExpr)) {
          // Namespace call: ns.method()
          const nsName = objExpr.text
          if (namespaceImports.has(nsName)) {
            const nsInfo = namespaceImports.get(nsName)
            if (nsInfo.isExternal) {
              addRelationship({
                type: 'CALLS',
                sourceId: enclosingId,
                targetId: `${nsInfo.targetFile}#${propName}`,
                startLine: loc.line + 1,
                startColumn: loc.character + 1,
                endLine: endLoc.line + 1,
                endColumn: endLoc.character + 1,
                rawIdentifier: `${nsName}.${propName}`,
                status: 'EXTERNAL',
                evidence: 'AST_VERIFIED',
                sourceHash: computeSha256(node.getText(sourceFile)),
              })
            } else {
              const targetId = resolveCanonicalSymbolId(
                nsInfo.targetFile,
                propName,
                symbolIndex,
                reExportsMap,
              )
              addRelationship({
                type: 'CALLS',
                sourceId: enclosingId,
                targetId,
                startLine: loc.line + 1,
                startColumn: loc.character + 1,
                endLine: endLoc.line + 1,
                endColumn: endLoc.character + 1,
                rawIdentifier: `${nsName}.${propName}`,
                status: 'RESOLVED',
                evidence: 'AST_VERIFIED',
                sourceHash: computeSha256(node.getText(sourceFile)),
              })
            }
          }
        }
      }
    }

    // 5. Type references: USES_TYPE / RETURNS_TYPE
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
      const typeName = node.typeName.text
      const loc = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      const endLoc = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
      const enclosingId = findEnclosingSymbolId(node)

      if (
        !GLOBAL_SYMBOLS.has(typeName) &&
        !['Promise', 'Record', 'Partial', 'Pick', 'Omit', 'Array'].includes(typeName)
      ) {
        let targetId = typeName
        let status = 'UNRESOLVED'
        let evidence = 'STATIC_INFERENCE'

        if (importedBindings.has(typeName)) {
          const binding = importedBindings.get(typeName)
          if (binding.isExternal) {
            targetId = `${binding.targetFile}#${binding.remoteName}`
            status = 'EXTERNAL'
          } else if (binding.targetFile) {
            targetId = resolveCanonicalSymbolId(
              binding.targetFile,
              binding.remoteName,
              symbolIndex,
              reExportsMap,
            )
            status = 'RESOLVED'
            evidence = 'AST_VERIFIED'
          } else {
            targetId = typeName
            status = 'UNRESOLVED'
            evidence = 'STATIC_INFERENCE'
          }
        } else if (localSymbolsByName.has(typeName)) {
          targetId = localSymbolsByName.get(typeName).id
          status = 'RESOLVED'
          evidence = 'AST_VERIFIED'
        }

        addRelationship({
          type: 'USES_TYPE',
          sourceId: enclosingId,
          targetId,
          startLine: loc.line + 1,
          startColumn: loc.character + 1,
          endLine: endLoc.line + 1,
          endColumn: endLoc.character + 1,
          rawIdentifier: typeName,
          status,
          evidence,
          sourceHash: computeSha256(node.getText(sourceFile)),
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // PASS 3: Test file relationships (TESTS)
  if (isTestFile) {
    // Collect all production symbols referenced or called in this test file
    const productionSymbolsTested = new Set()

    for (const rel of relationships) {
      if (
        (rel.type === 'CALLS' || rel.type === 'INSTANTIATES') &&
        rel.status === 'RESOLVED' &&
        rel.targetId &&
        !rel.targetId.startsWith('global:') &&
        !rel.targetId.includes('__tests__')
      ) {
        productionSymbolsTested.add(rel.targetId)
      }
    }

    // Also link any direct imports of production symbols in the test
    for (const [localName, binding] of importedBindings.entries()) {
      if (binding.targetFile && !binding.isExternal && !binding.targetFile.includes('__tests__')) {
        const canonicalId = resolveCanonicalSymbolId(
          binding.targetFile,
          binding.remoteName,
          symbolIndex,
          reExportsMap,
        )
        if (canonicalId) {
          productionSymbolsTested.add(canonicalId)
        }
      }
    }

    for (const targetSymbolId of productionSymbolsTested) {
      addRelationship({
        type: 'TESTS',
        sourceId: normFile,
        targetId: targetSymbolId,
        startLine: 1,
        startColumn: 1,
        endLine: sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1,
        endColumn: 1,
        rawIdentifier: targetSymbolId.split('#')[1] || targetSymbolId,
        status: 'RESOLVED',
        evidence: 'AST_VERIFIED',
        sourceHash: computeSha256(sourceCode),
      })
    }
  }

  return relationships
}
