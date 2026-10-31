/**
 * AST-Backed Symbol Extractor for Hisabche
 * Uses TypeScript Compiler API (typescript@5.9.3)
 * Extracts structured, source-verifiable Symbol Cards from TypeScript / JavaScript files.
 */

import ts from 'typescript'
import crypto from 'node:crypto'

/**
 * Normalizes file path to forward slashes
 */
export function normalizePath(p) {
  return p ? p.replace(/\\/g, '/') : ''
}

/**
 * Computes SHA-256 hash of normalized LF content
 */
export function computeSha256(text) {
  const normalized = (text || '').replace(/\r\n/g, '\n')
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex')
}

/**
 * Cleans raw JSDoc/TSDoc comment text
 */
export function cleanDocComment(commentText) {
  if (!commentText) return null
  return (
    commentText
      .replace(/^\/\*\*|\*\/$/g, '')
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trimEnd())
      .join('\n')
      .trim() || null
  )
}

/**
 * Extracts leading JSDoc / TSDoc comments for an AST node
 */
function extractDocComment(node, sourceFile, sourceCode) {
  // 1. Direct ts.node.jsDoc if available
  if (node.jsDoc && Array.isArray(node.jsDoc) && node.jsDoc.length > 0) {
    const raw = node.jsDoc
      .map((d) => (typeof d.comment === 'string' ? d.comment : d.getText(sourceFile)))
      .filter(Boolean)
      .join('\n')
    if (raw) return cleanDocComment(raw)
  }

  // 2. Scan leading comment ranges
  const commentRanges = ts.getLeadingCommentRanges(sourceCode, node.pos)
  if (commentRanges && commentRanges.length > 0) {
    for (let i = commentRanges.length - 1; i >= 0; i--) {
      const range = commentRanges[i]
      if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
        const text = sourceCode.slice(range.pos, range.end)
        if (text.startsWith('/**')) {
          return cleanDocComment(text)
        }
      }
    }
  }

  return null
}

/**
 * Determines script kind based on file extension
 */
function getScriptKind(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (lower.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (lower.endsWith('.ts') || lower.endsWith('.mts')) return ts.ScriptKind.TS
  if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs'))
    return ts.ScriptKind.JS
  if (lower.endsWith('.json')) return ts.ScriptKind.JSON
  return ts.ScriptKind.Unknown
}

/**
 * Check if node or its descendants contain JSX syntax
 */
function containsJsx(node) {
  let hasJsx = false
  function visit(n) {
    if (hasJsx) return
    if (
      n.kind === ts.SyntaxKind.JsxElement ||
      n.kind === ts.SyntaxKind.JsxSelfClosingElement ||
      n.kind === ts.SyntaxKind.JsxFragment
    ) {
      hasJsx = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return hasJsx
}

/**
 * Formats a clean single-line representation of text, collapsing excess whitespace and normalizing parens
 */
function collapseWhitespace(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/,\s*\)/g, ')')
    .trim()
}

/**
 * Resolves default package name from file path if none provided
 */
export function inferPackageName(filePath) {
  const norm = normalizePath(filePath)
  if (norm.startsWith('packages/')) {
    const segments = norm.split('/')
    if (segments.length >= 2) {
      return `@hisabche/${segments[1]}`
    }
  }
  if (norm.startsWith('apps/')) {
    const segments = norm.split('/')
    if (segments.length >= 2) {
      return `@hisabche/${segments[1]}`
    }
  }
  if (norm.startsWith('backend/')) {
    return '@hisabche/backend'
  }
  return 'root'
}

/**
 * Helper to check if a call expression is React.memo, memo, forwardRef, etc.
 */
function isReactHoc(callExpr, sourceFile) {
  const calleeText = callExpr.expression.getText(sourceFile)
  return (
    calleeText === 'memo' ||
    calleeText === 'React.memo' ||
    calleeText === 'forwardRef' ||
    calleeText === 'React.forwardRef'
  )
}

/**
 * Main AST symbol extraction entry point
 * @param {string} filePath - Relative file path (e.g. packages/local-engine/src/db.ts)
 * @param {string} sourceCode - Raw file contents
 * @param {object} options - Extraction options (packageName, domain, platform, etc.)
 * @returns {Array<object>} Array of structured Symbol Cards
 */
export function extractSymbolsFromSource(filePath, sourceCode, options = {}) {
  const normFile = normalizePath(filePath)
  const scriptKind = getScriptKind(normFile)
  if (scriptKind === ts.ScriptKind.Unknown || scriptKind === ts.ScriptKind.JSON) {
    return []
  }

  const pkgName = options.packageName || inferPackageName(normFile)
  const domain = options.domain || 'SHARED'
  const platform = options.platform || 'SHARED'
  const fileHash = computeSha256(sourceCode)

  let sourceFile
  try {
    sourceFile = ts.createSourceFile(normFile, sourceCode, ts.ScriptTarget.Latest, true, scriptKind)
  } catch (err) {
    return [
      {
        schemaVersion: 1,
        id: `${pkgName}/${normFile}#__PARSE_ERROR__`,
        name: '__PARSE_ERROR__',
        kind: 'declaration',
        signature: `// Failed to parse: ${err.message}`,
        signatureStatus: 'unresolved',
        file: normFile,
        line: 1,
        startLine: 1,
        endLine: 1,
        package: pkgName,
        exported: false,
        exportPaths: [],
        overloadGroup: null,
        doc: null,
        sourceHash: fileHash,
        fileHash,
        extractionStatus: 'degraded',
        domain,
        platform,
      },
    ]
  }

  const symbols = []
  const symbolCountByName = new Map()
  const overloadCandidates = new Map()
  const namedExportsMap = new Map() // localName -> exportName[]
  let defaultExportedLocalName = null

  // Pass 1: Collect export statements (export { a, b as c }, export default x)
  for (const stmt of sourceFile.statements) {
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const spec of stmt.exportClause.elements) {
          const localName = spec.propertyName ? spec.propertyName.text : spec.name.text
          const exportedAs = spec.name.text
          if (!namedExportsMap.has(localName)) {
            namedExportsMap.set(localName, [])
          }
          namedExportsMap.get(localName).push(exportedAs)
        }
      }
    } else if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      if (ts.isIdentifier(stmt.expression)) {
        defaultExportedLocalName = stmt.expression.text
      }
    }
  }

  // Helper to record symbol card
  function addSymbolCard(card) {
    // Generate unique ID
    const count = (symbolCountByName.get(card.name) || 0) + 1
    symbolCountByName.set(card.name, count)

    let disambiguator = ''
    if (count > 1) {
      disambiguator = `#${count}`
    }

    const id = `${pkgName}/${normFile}#${card.name}${disambiguator}`

    symbols.push({
      schemaVersion: 1,
      id,
      name: card.name,
      kind: card.kind,
      signature: card.signature,
      signatureStatus: card.signatureStatus,
      file: normFile,
      line: card.startLine, // legacy backward compatibility
      startLine: card.startLine,
      endLine: card.endLine,
      package: pkgName,
      exported: card.exported,
      exportPaths: card.exportPaths,
      overloadGroup: card.overloadGroup || null,
      doc: card.doc || null,
      sourceHash: card.sourceHash,
      fileHash,
      extractionStatus: card.extractionStatus || 'ok',
      domain,
      platform,
    })
  }

  // Pass 2: Extract top-level declarations and member symbols
  for (const stmt of sourceFile.statements) {
    const hasExportKeyword =
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) || false
    const hasDefaultKeyword =
      stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) || false

    const startLine = sourceFile.getLineAndCharacterOfPosition(stmt.getStart(sourceFile)).line + 1
    const endLine = sourceFile.getLineAndCharacterOfPosition(stmt.getEnd()).line + 1
    const doc = extractDocComment(stmt, sourceFile, sourceCode)
    const sourceHash = computeSha256(stmt.getText(sourceFile))

    // 1. Function Declaration
    if (ts.isFunctionDeclaration(stmt)) {
      const name = stmt.name ? stmt.name.text : 'default'
      const isExported =
        hasExportKeyword || namedExportsMap.has(name) || defaultExportedLocalName === name
      const exportPaths = []
      if (hasDefaultKeyword || defaultExportedLocalName === name) exportPaths.push('default')
      if (hasExportKeyword && !hasDefaultKeyword) exportPaths.push('named')
      if (namedExportsMap.has(name)) {
        exportPaths.push(...namedExportsMap.get(name).map((exp) => `named:${exp}`))
      }

      // Check overload
      const hasBody = !!stmt.body
      if (!overloadCandidates.has(name)) {
        overloadCandidates.set(name, [])
      }
      overloadCandidates.get(name).push({ hasBody, startLine })

      // Determine kind
      let kind = 'function'
      const isAsync = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
      const isGenerator = !!stmt.asteriskToken

      if (/^use[A-Z0-9]/.test(name)) {
        kind = 'react_hook'
      } else if (
        /^[A-Z][a-zA-Z0-9]*$/.test(name) &&
        (containsJsx(stmt) || normFile.endsWith('.tsx') || normFile.endsWith('.jsx'))
      ) {
        kind = 'react_component'
      } else if (isAsync) {
        kind = 'async_function'
      } else if (isGenerator) {
        kind = 'generator_function'
      }

      // Build clean signature
      let signature = ''
      if (hasBody) {
        const sigEnd = stmt.body.getStart(sourceFile)
        signature = sourceCode.slice(stmt.getStart(sourceFile), sigEnd).trim()
      } else {
        signature = sourceCode.slice(stmt.getStart(sourceFile), stmt.getEnd()).trim()
      }
      signature = collapseWhitespace(signature).replace(/;$/, '')

      // Signature status
      const hasParamTypes = stmt.parameters.length === 0 || stmt.parameters.some((p) => !!p.type)
      const hasReturnType = !!stmt.type
      const signatureStatus =
        hasParamTypes && (hasReturnType || !hasBody)
          ? 'resolved'
          : hasParamTypes || hasReturnType
            ? 'partially_resolved'
            : 'unresolved'

      addSymbolCard({
        name,
        kind,
        signature,
        signatureStatus,
        startLine,
        endLine,
        exported: isExported,
        exportPaths: [...new Set(exportPaths)],
        overloadGroup: null, // Will be linked in Pass 3
        doc,
        sourceHash,
      })
      continue
    }

    // 2. Variable Statements (const, let, var, arrow functions, HOC components)
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        const name = decl.name.text
        const isExported =
          hasExportKeyword || namedExportsMap.has(name) || defaultExportedLocalName === name
        const exportPaths = []
        if (hasDefaultKeyword || defaultExportedLocalName === name) exportPaths.push('default')
        if (hasExportKeyword && !hasDefaultKeyword) exportPaths.push('named')
        if (namedExportsMap.has(name)) {
          exportPaths.push(...namedExportsMap.get(name).map((exp) => `named:${exp}`))
        }

        const declStartLine =
          sourceFile.getLineAndCharacterOfPosition(decl.getStart(sourceFile)).line + 1
        const declEndLine = sourceFile.getLineAndCharacterOfPosition(decl.getEnd()).line + 1
        const declHash = computeSha256(decl.getText(sourceFile))

        let kind = 'variable'
        let signature = ''
        let signatureStatus = 'unresolved'

        const init = decl.initializer
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          const isAsync = init.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)
          if (/^use[A-Z0-9]/.test(name)) {
            kind = 'react_hook'
          } else if (
            /^[A-Z][a-zA-Z0-9]*$/.test(name) &&
            (containsJsx(init) || normFile.endsWith('.tsx') || normFile.endsWith('.jsx'))
          ) {
            kind = 'react_component'
          } else if (isAsync) {
            kind = 'async_function'
          } else {
            kind = 'arrow_function'
          }

          const hasParamTypes =
            init.parameters.length === 0 || init.parameters.some((p) => !!p.type)
          const hasReturnType = !!init.type || !!decl.type
          signatureStatus =
            hasParamTypes && hasReturnType
              ? 'resolved'
              : hasParamTypes || hasReturnType
                ? 'partially_resolved'
                : 'unresolved'

          if (init.body) {
            const sigEnd = init.body.getStart(sourceFile)
            const sigHead = sourceCode.slice(init.getStart(sourceFile), sigEnd).trim()
            const typeStr = decl.type ? `: ${decl.type.getText(sourceFile)}` : ''
            signature = collapseWhitespace(`const ${name}${typeStr} = ${sigHead}`).replace(
              /=>$/,
              '=> { ... }',
            )
          } else {
            signature = collapseWhitespace(`const ${name} = ${init.getText(sourceFile)}`)
          }
        } else if (
          init &&
          ts.isCallExpression(init) &&
          /^[A-Z][a-zA-Z0-9]*$/.test(name) &&
          (isReactHoc(init, sourceFile) || containsJsx(init) || normFile.endsWith('.tsx'))
        ) {
          // React Higher-Order Component wrapper: memo(function DashboardHeader...) or forwardRef(...)
          kind = 'react_component'
          const initText = collapseWhitespace(init.getText(sourceFile))
          const truncated = initText.length > 100 ? `${initText.slice(0, 97)}...` : initText
          signature = `const ${name} = ${truncated}`
          signatureStatus = decl.type ? 'resolved' : 'partially_resolved'
        } else {
          // Regular variable or constant
          const isConst = (stmt.declarationList.flags & ts.NodeFlags.Const) !== 0
          const isUpper = /^[A-Z0-9_]+$/.test(name)
          kind = isUpper || isConst ? 'constant' : 'variable'

          if (decl.type) {
            signature = collapseWhitespace(`const ${name}: ${decl.type.getText(sourceFile)}`)
            signatureStatus = 'resolved'
          } else if (init) {
            const initText = collapseWhitespace(init.getText(sourceFile))
            const truncated = initText.length > 80 ? `${initText.slice(0, 77)}...` : initText
            signature = `const ${name} = ${truncated}`
            signatureStatus = 'partially_resolved'
          } else {
            signature = `let ${name}`
            signatureStatus = 'unresolved'
          }
        }

        addSymbolCard({
          name,
          kind,
          signature,
          signatureStatus,
          startLine: declStartLine,
          endLine: declEndLine,
          exported: isExported,
          exportPaths: [...new Set(exportPaths)],
          overloadGroup: null,
          doc,
          sourceHash: declHash,
        })
      }
      continue
    }

    // 3. Class Declaration
    if (ts.isClassDeclaration(stmt)) {
      const name = stmt.name ? stmt.name.text : 'default'
      const isExported =
        hasExportKeyword || namedExportsMap.has(name) || defaultExportedLocalName === name
      const exportPaths = []
      if (hasDefaultKeyword || defaultExportedLocalName === name) exportPaths.push('default')
      if (hasExportKeyword && !hasDefaultKeyword) exportPaths.push('named')
      if (namedExportsMap.has(name)) {
        exportPaths.push(...namedExportsMap.get(name).map((exp) => `named:${exp}`))
      }

      // Class header signature
      let headerEnd = stmt.getEnd()
      if (stmt.members && stmt.members.length > 0) {
        headerEnd = stmt.members[0].pos
      } else {
        const openBrace = stmt.getText(sourceFile).indexOf('{')
        if (openBrace !== -1) {
          headerEnd = stmt.getStart(sourceFile) + openBrace
        }
      }
      const rawHeader = sourceCode.slice(stmt.getStart(sourceFile), headerEnd).trim()
      const signature = collapseWhitespace(rawHeader).replace(/\{?$/, '').trim() + ' { ... }'

      addSymbolCard({
        name,
        kind: 'class',
        signature,
        signatureStatus: 'resolved',
        startLine,
        endLine,
        exported: isExported,
        exportPaths: [...new Set(exportPaths)],
        overloadGroup: null,
        doc,
        sourceHash,
      })

      // Class members: constructor & methods
      for (const member of stmt.members) {
        if (ts.isConstructorDeclaration(member)) {
          const mStart =
            sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1
          const mEnd = sourceFile.getLineAndCharacterOfPosition(member.getEnd()).line + 1
          const mDoc = extractDocComment(member, sourceFile, sourceCode)
          const mHash = computeSha256(member.getText(sourceFile))

          let mSig = ''
          if (member.body) {
            const sigEnd = member.body.getStart(sourceFile)
            mSig = sourceCode.slice(member.getStart(sourceFile), sigEnd).trim()
          } else {
            mSig = sourceCode.slice(member.getStart(sourceFile), member.getEnd()).trim()
          }
          mSig = collapseWhitespace(mSig)

          addSymbolCard({
            name: `${name}.constructor`,
            kind: 'constructor',
            signature: mSig,
            signatureStatus: 'resolved',
            startLine: mStart,
            endLine: mEnd,
            exported: isExported,
            exportPaths: [...new Set(exportPaths)],
            overloadGroup: null,
            doc: mDoc,
            sourceHash: mHash,
          })
        } else if (ts.isMethodDeclaration(member)) {
          const methodName = member.name ? member.name.getText(sourceFile) : 'method'
          const mStart =
            sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile)).line + 1
          const mEnd = sourceFile.getLineAndCharacterOfPosition(member.getEnd()).line + 1
          const mDoc = extractDocComment(member, sourceFile, sourceCode)
          const mHash = computeSha256(member.getText(sourceFile))

          let mSig = ''
          if (member.body) {
            const sigEnd = member.body.getStart(sourceFile)
            mSig = sourceCode.slice(member.getStart(sourceFile), sigEnd).trim()
          } else {
            mSig = sourceCode.slice(member.getStart(sourceFile), member.getEnd()).trim()
          }
          mSig = collapseWhitespace(mSig)

          addSymbolCard({
            name: `${name}.${methodName}`,
            kind: 'method',
            signature: mSig,
            signatureStatus: member.type ? 'resolved' : 'partially_resolved',
            startLine: mStart,
            endLine: mEnd,
            exported: isExported,
            exportPaths: [...new Set(exportPaths)],
            overloadGroup: null,
            doc: mDoc,
            sourceHash: mHash,
          })
        }
      }
      continue
    }

    // 4. Interface Declaration
    if (ts.isInterfaceDeclaration(stmt)) {
      const name = stmt.name.text
      const isExported =
        hasExportKeyword || namedExportsMap.has(name) || defaultExportedLocalName === name
      const exportPaths = []
      if (hasDefaultKeyword || defaultExportedLocalName === name) exportPaths.push('default')
      if (hasExportKeyword && !hasDefaultKeyword) exportPaths.push('named')
      if (namedExportsMap.has(name)) {
        exportPaths.push(...namedExportsMap.get(name).map((exp) => `named:${exp}`))
      }

      // Compact signature representation
      const typeParams = stmt.typeParameters
        ? `<${stmt.typeParameters.map((tp) => tp.getText(sourceFile)).join(', ')}>`
        : ''
      const heritage = stmt.heritageClauses
        ? ` ${stmt.heritageClauses.map((h) => h.getText(sourceFile)).join(' ')}`
        : ''
      const signature = `interface ${name}${typeParams}${heritage} { ... }`

      addSymbolCard({
        name,
        kind: 'interface',
        signature,
        signatureStatus: 'resolved',
        startLine,
        endLine,
        exported: isExported,
        exportPaths: [...new Set(exportPaths)],
        overloadGroup: null,
        doc,
        sourceHash,
      })
      continue
    }

    // 5. Type Alias Declaration
    if (ts.isTypeAliasDeclaration(stmt)) {
      const name = stmt.name.text
      const isExported =
        hasExportKeyword || namedExportsMap.has(name) || defaultExportedLocalName === name
      const exportPaths = []
      if (hasDefaultKeyword || defaultExportedLocalName === name) exportPaths.push('default')
      if (hasExportKeyword && !hasDefaultKeyword) exportPaths.push('named')
      if (namedExportsMap.has(name)) {
        exportPaths.push(...namedExportsMap.get(name).map((exp) => `named:${exp}`))
      }

      const typeParams = stmt.typeParameters
        ? `<${stmt.typeParameters.map((tp) => tp.getText(sourceFile)).join(', ')}>`
        : ''
      const typeDefText = collapseWhitespace(stmt.type.getText(sourceFile))
      const truncated = typeDefText.length > 120 ? `${typeDefText.slice(0, 117)}...` : typeDefText
      const signature = `type ${name}${typeParams} = ${truncated}`

      addSymbolCard({
        name,
        kind: 'type_alias',
        signature,
        signatureStatus: 'resolved',
        startLine,
        endLine,
        exported: isExported,
        exportPaths: [...new Set(exportPaths)],
        overloadGroup: null,
        doc,
        sourceHash,
      })
      continue
    }

    // 6. Enum Declaration
    if (ts.isEnumDeclaration(stmt)) {
      const name = stmt.name.text
      const isExported =
        hasExportKeyword || namedExportsMap.has(name) || defaultExportedLocalName === name
      const exportPaths = []
      if (hasDefaultKeyword || defaultExportedLocalName === name) exportPaths.push('default')
      if (hasExportKeyword && !hasDefaultKeyword) exportPaths.push('named')
      if (namedExportsMap.has(name)) {
        exportPaths.push(...namedExportsMap.get(name).map((exp) => `named:${exp}`))
      }

      const members = stmt.members
        .map((m) => m.name.getText(sourceFile))
        .slice(0, 5)
        .join(', ')
      const more = stmt.members.length > 5 ? '...' : ''
      const signature = `enum ${name} { ${members}${more} }`

      addSymbolCard({
        name,
        kind: 'enum',
        signature,
        signatureStatus: 'resolved',
        startLine,
        endLine,
        exported: isExported,
        exportPaths: [...new Set(exportPaths)],
        overloadGroup: null,
        doc,
        sourceHash,
      })
      continue
    }

    // 7. Re-export Declarations (export { a, b as c } from './foo', export * from './foo')
    if (ts.isExportDeclaration(stmt)) {
      const moduleSpecifier = stmt.moduleSpecifier ? stmt.moduleSpecifier.text : null

      if (!stmt.exportClause && moduleSpecifier) {
        // Barrel export: export * from './foo'
        addSymbolCard({
          name: '*',
          kind: 're_export',
          signature: `export * from '${moduleSpecifier}'`,
          signatureStatus: 'resolved',
          startLine,
          endLine,
          exported: true,
          exportPaths: ['barrel'],
          overloadGroup: null,
          doc,
          sourceHash,
        })
      } else if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const spec of stmt.exportClause.elements) {
          const exportName = spec.name.text
          const localName = spec.propertyName ? spec.propertyName.text : exportName
          const isReExport = !!moduleSpecifier

          // If it's a re-export from another module, add a symbol card
          if (isReExport) {
            const sig = `export { ${spec.getText(sourceFile)} } from '${moduleSpecifier}'`
            addSymbolCard({
              name: exportName,
              kind: 're_export',
              signature: sig,
              signatureStatus: 'resolved',
              startLine,
              endLine,
              exported: true,
              exportPaths: [`re_export:${moduleSpecifier}`],
              overloadGroup: null,
              doc,
              sourceHash,
            })
          }
        }
      }
      continue
    }

    // 8. Standalone Export Assignment (export default expr)
    if (ts.isExportAssignment(stmt) && !stmt.isExportEquals) {
      const exprText = collapseWhitespace(stmt.expression.getText(sourceFile))
      const truncated = exprText.length > 80 ? `${exprText.slice(0, 77)}...` : exprText
      addSymbolCard({
        name: 'default',
        kind: 'export_assignment',
        signature: `export default ${truncated}`,
        signatureStatus: 'partially_resolved',
        startLine,
        endLine,
        exported: true,
        exportPaths: ['default'],
        overloadGroup: null,
        doc,
        sourceHash,
      })
      continue
    }
  }

  // Pass 3: Link overload groups
  for (const [fnName, occurrences] of overloadCandidates.entries()) {
    if (occurrences.length > 1) {
      const groupId = `${pkgName}/${normFile}#${fnName}#overloads`
      for (const sym of symbols) {
        if (sym.name === fnName && (sym.kind === 'function' || sym.kind === 'async_function')) {
          sym.overloadGroup = groupId
        }
      }
    }
  }

  return symbols
}
