#!/usr/bin/env node
/**
 * Hisabche Code Intelligence CLI
 * Unified query interface for coding agents and developers
 * Usage:
 *   node scripts/code-intel.mjs symbol find <name> [--exact] [--json]
 *   node scripts/code-intel.mjs symbol show <id> [--json]
 *   node scripts/code-intel.mjs callers <id> [--verified-only] [--json]
 *   node scripts/code-intel.mjs callees <id> [--verified-only] [--json]
 *   node scripts/code-intel.mjs imports <path> [--json]
 *   node scripts/code-intel.mjs tests <id> [--json]
 *   node scripts/code-intel.mjs impact <id|file> [--depth <n>] [--json]
 *   node scripts/code-intel.mjs file <path> [--json]
 *   node scripts/code-intel.mjs source <id|file> [--context <n>] [--json]
 *   node scripts/code-intel.mjs status [--json]
 */

import { CodeIntelQueryEngine } from './lib/code-intel-query.mjs'
import { IncrementalIndexer } from './lib/incremental-indexer.mjs'

const args = process.argv.slice(2)

function parseFlags(rawArgs) {
  const flags = {}
  const positional = []
  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      if (['exact', 'verified-only', 'json', 'full', 'dry-run'].includes(key)) {
        flags[key] = true
      } else if (i + 1 < rawArgs.length && !rawArgs[i + 1].startsWith('--')) {
        flags[key] = rawArgs[++i]
      } else {
        flags[key] = true
      }
    } else {
      positional.push(a)
    }
  }
  return { flags, positional }
}

const { flags, positional } = parseFlags(args)
const isJson = flags.json === true

function printJsonContract(operation, target, results, extra = {}) {
  const engine = new CodeIntelQueryEngine()
  let indexStatus = 'FRESH'
  try {
    indexStatus = engine.getIndexStatus().status
  } catch {
    indexStatus = 'UNKNOWN'
  }

  const output = {
    query: {
      operation,
      target,
      flags,
    },
    index: {
      status: indexStatus,
      schemaVersion: 2,
    },
    resultCount: Array.isArray(results) ? results.length : results ? 1 : 0,
    truncated: extra.truncated || false,
    results: results || [],
    warnings: extra.warnings || [],
    errors: extra.errors || [],
  }
  console.log(JSON.stringify(output, null, 2))
}

function printHelp() {
  console.log(`
Hisabche Universal Code Intelligence CLI

Commands:
  symbol find <name>     Find symbols by exact or partial name
    --exact              Exact name match only
    --kind <kind>        Filter by kind (function, class, interface, etc.)
    --domain <domain>    Filter by business domain
    --pkg <package>      Filter by package name
    --limit <n>          Limit number of results (default 50)
  
  symbol show <id>       Show full symbol card by ID or name
  callers <id>           Show verified callers of a symbol
    --verified-only      Show only AST_VERIFIED callers
  callees <id>           Show functions/methods called by a symbol
  imports <path>         Show imports and re-exports of a file
  tests <id>             Show tests that reference/call this symbol
  impact <id|file>       Show bounded static impact analysis
    --depth <n>          Maximum traversal depth (default 3)
  file <path>            Show file details, exports, and dependents
  source <id|path>       Retrieve exact source code excerpt
    --context <n>        Number of context lines (default 3)
  status                 Show index health, freshness, and statistics
  update                 Run incremental index update or rebuild
    --full               Force clean full rebuild
    --dry-run            Analyze changes without writing index

Options:
  --json                 Output clean machine-readable JSON contract
`)
}

async function run() {
  if (positional.length === 0 || positional[0] === 'help' || positional[0] === '--help') {
    printHelp()
    process.exit(0)
  }

  const engine = new CodeIntelQueryEngine()

  try {
    engine.load()
  } catch (err) {
    if (isJson) {
      printJsonContract('load', null, [], { errors: [err.message] })
    } else {
      console.error(`Error loading index: ${err.message}`)
    }
    process.exit(2)
  }

  const command = positional[0]

  // 1. symbol find / symbol show
  if (command === 'symbol') {
    const sub = positional[1]
    const target = positional[2]

    if (sub === 'find') {
      if (!target) {
        if (isJson) printJsonContract('symbol find', '', [], { errors: ['Missing search query'] })
        else console.error('Error: Please provide a symbol name to search.')
        process.exit(1)
      }

      const res = engine.findSymbols(target, {
        exact: flags.exact === true,
        kind: flags.kind,
        domain: flags.domain,
        package: flags.pkg,
        limit: flags.limit ? parseInt(flags.limit, 10) : 50,
      })

      if (isJson) {
        printJsonContract('symbol find', target, res.results)
      } else {
        console.log(`\nFound ${res.totalFound} symbol(s) matching '${target}':`)
        for (const s of res.results) {
          console.log(`- [${s.kind}] ${s.name} (${s.package})`)
          console.log(`    ID: ${s.id}`)
          console.log(`    File: ${s.file}:${s.startLine}`)
          if (s.signature) console.log(`    Signature: ${s.signature}`)
          console.log()
        }
      }
      process.exit(0)
    }

    if (sub === 'show') {
      if (!target) {
        if (isJson) printJsonContract('symbol show', '', [], { errors: ['Missing symbol ID'] })
        else console.error('Error: Please provide a symbol ID or name.')
        process.exit(1)
      }

      const res = engine.getSymbol(target)
      if (isJson) {
        printJsonContract('symbol show', target, res.symbol ? [res.symbol] : [], {
          warnings: res.warning ? [res.warning] : [],
          errors: res.error ? [res.error] : [],
        })
      } else {
        if (!res.found) {
          console.log(`Symbol '${target}' not found.`)
          if (res.candidates && res.candidates.length > 0) {
            console.log('Did you mean:')
            for (const c of res.candidates) console.log(`- ${c.name} (${c.id})`)
          }
        } else {
          const s = res.symbol
          console.log(`\nSymbol: ${s.name} [${s.kind}]`)
          console.log(`ID: ${s.id}`)
          console.log(`Location: ${s.file}:${s.startLine}-${s.endLine}`)
          console.log(`Package: ${s.package} | Domain: ${s.domain} | Platform: ${s.platform}`)
          console.log(`Exported: ${s.exported} (${s.exportPaths.join(', ')})`)
          console.log(`Signature: ${s.signature}`)
          if (s.doc) console.log(`Documentation:\n${s.doc}`)
        }
      }
      process.exit(0)
    }
  }

  // 2. callers
  if (command === 'callers') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('callers', '', [], { errors: ['Missing symbol target'] })
      else console.error('Error: Please provide a symbol ID or name.')
      process.exit(1)
    }

    const res = engine.getCallers(target, {
      verifiedOnly: flags['verified-only'] === true,
      limit: flags.limit ? parseInt(flags.limit, 10) : 100,
    })

    if (isJson) {
      printJsonContract('callers', target, res.callers, { errors: res.error ? [res.error] : [] })
    } else {
      console.log(`\nCallers for '${target}' (${res.totalFound} found):`)
      for (const c of res.callers) {
        console.log(`- ${c.callerSymbolName} [${c.status} / ${c.evidence}]`)
        console.log(`    File: ${c.callerFile}:${c.line}:${c.column}`)
        console.log(`    Caller ID: ${c.callerSymbolId}`)
      }
    }
    process.exit(0)
  }

  // 3. callees
  if (command === 'callees') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('callees', '', [], { errors: ['Missing symbol target'] })
      else console.error('Error: Please provide a symbol ID or name.')
      process.exit(1)
    }

    const res = engine.getCallees(target, {
      verifiedOnly: flags['verified-only'] === true,
      limit: flags.limit ? parseInt(flags.limit, 10) : 100,
    })

    if (isJson) {
      printJsonContract('callees', target, res.callees, { errors: res.error ? [res.error] : [] })
    } else {
      console.log(`\nCallees called by '${target}' (${res.totalFound} found):`)
      for (const c of res.callees) {
        console.log(`- ${c.targetSymbolName} [${c.status} / ${c.evidence}]`)
        console.log(`    File: ${c.file}:${c.line}:${c.column}`)
        console.log(`    Target ID: ${c.targetSymbolId}`)
      }
    }
    process.exit(0)
  }

  // 4. imports
  if (command === 'imports') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('imports', '', [], { errors: ['Missing file target'] })
      else console.error('Error: Please provide a file path.')
      process.exit(1)
    }

    const res = engine.getImports(target)
    if (isJson) {
      printJsonContract('imports', target, res.imports)
    } else {
      console.log(
        `\nImports for '${res.file}' (${res.totalImports} imports, ${res.totalReExports} re-exports):`,
      )
      for (const imp of res.imports) {
        console.log(
          `- ${imp.specifier} -> ${imp.resolvedTarget} [${imp.status}] (Line ${imp.line})`,
        )
      }
      for (const re of res.reExports) {
        console.log(
          `- [RE-EXPORT] ${re.specifier} -> ${re.resolvedTarget} [${re.status}] (Line ${re.line})`,
        )
      }
    }
    process.exit(0)
  }

  // 5. tests
  if (command === 'tests') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('tests', '', [], { errors: ['Missing symbol target'] })
      else console.error('Error: Please provide a symbol ID or name.')
      process.exit(1)
    }

    const res = engine.getRelatedTests(target)
    if (isJson) {
      printJsonContract('tests', target, res.tests, { errors: res.error ? [res.error] : [] })
    } else {
      console.log(`\nTests related to '${target}' (${res.totalTests} found):`)
      for (const t of res.tests) {
        console.log(`- ${t.testFile} [${t.evidence}]`)
      }
    }
    process.exit(0)
  }

  // 6. impact
  if (command === 'impact') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('impact', '', [], { errors: ['Missing target'] })
      else console.error('Error: Please provide a symbol ID or file path.')
      process.exit(1)
    }

    const res = engine.getImpactSummary(target, {
      depth: flags.depth ? parseInt(flags.depth, 10) : 3,
      limit: flags.limit ? parseInt(flags.limit, 10) : 50,
    })

    if (isJson) {
      printJsonContract('impact', target, [res], { truncated: res.truncated })
    } else {
      console.log(`\nStatic Impact Summary for '${res.target}':`)
      console.log(`- Direct Callers: ${res.directCallers.length}`)
      console.log(`- Direct Callees: ${res.directCallees.length}`)
      console.log(`- Direct Dependencies: ${res.directDependencies.length}`)
      console.log(`- Direct Dependents: ${res.directDependents.length}`)
      console.log(
        `- Transitive Dependents (Depth ${res.depth}): ${res.transitiveDependents.length}${res.truncated ? ' [TRUNCATED]' : ''}`,
      )
      console.log(`- Related Tests: ${res.relatedTests.length}`)
      if (res.relevantCycles.length > 0) {
        console.log(`- Cycles Participating: ${res.relevantCycles.length}`)
      }
    }
    process.exit(0)
  }

  // 7. file
  if (command === 'file') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('file', '', [], { errors: ['Missing file path'] })
      else console.error('Error: Please provide a file path.')
      process.exit(1)
    }

    const res = engine.getFile(target)
    if (isJson) {
      printJsonContract('file', target, res.found ? [res] : [], {
        errors: res.error ? [res.error] : [],
      })
    } else {
      if (!res.found) {
        console.log(res.error)
      } else {
        console.log(`\nFile: ${res.file}`)
        console.log(`Platform: ${res.platform.join(', ')} | Domain: ${res.domain.join(', ')}`)
        console.log(`Symbols (${res.totalSymbols}):`)
        for (const s of res.symbols) console.log(`  - [${s.kind}] ${s.name} (line ${s.line})`)
        console.log(`Imports (${res.imports.length}):`)
        for (const i of res.imports) console.log(`  - ${i.specifier} -> ${i.resolvedTarget}`)
        console.log(`Dependents (${res.directDependents.length}):`)
        for (const d of res.directDependents) console.log(`  - ${d}`)
      }
    }
    process.exit(0)
  }

  // 8. source
  if (command === 'source') {
    const target = positional[1]
    if (!target) {
      if (isJson) printJsonContract('source', '', [], { errors: ['Missing symbol or file path'] })
      else console.error('Error: Please provide a symbol ID or file path.')
      process.exit(1)
    }

    const res = engine.getSourceExcerpt(target, {
      contextLines: flags.context ? parseInt(flags.context, 10) : 3,
    })

    if (isJson) {
      printJsonContract('source', target, res.success ? [res] : [], {
        warnings: res.staleWarning ? [res.staleWarning] : [],
        errors: res.error ? [res.error] : [],
      })
    } else {
      if (!res.success) {
        console.error(`Error: ${res.error}`)
        process.exit(1)
      }

      if (res.isStale) {
        console.log(`[WARNING] ${res.staleWarning}\n`)
      }

      console.log(`Source for ${target} (${res.file}:${res.startLine}-${res.endLine}):`)
      console.log(res.linesWithNumbers)
    }
    process.exit(0)
  }

  // 9. status
  if (command === 'status') {
    const status = engine.getIndexStatus()
    if (isJson) {
      printJsonContract('status', 'index', [status])
    } else {
      console.log(`\nCode Intelligence Index Status: ${status.status}`)
      console.log(`Schema Version: ${status.schemaVersion}`)
      console.log(`Timestamp: ${status.timestamp}`)
      console.log(
        `Git Head: ${status.currentGitHead} (${status.gitMatch ? 'MATCHES' : 'DIFFERENT'})`,
      )
      if (status.stalenessReasons && status.stalenessReasons.length > 0) {
        console.log(`Staleness Reasons:`)
        for (const r of status.stalenessReasons) console.log(`  - ${r}`)
      }
      console.log(`Total Files: ${status.totalFiles}`)
      console.log(`Total Symbols: ${status.totalSymbols}`)
      if (status.relationshipStats) {
        console.log(`Total Relationships: ${status.relationshipStats.total}`)
        console.log(`  Resolved: ${status.relationshipStats.resolved}`)
        console.log(`  External: ${status.relationshipStats.external}`)
        console.log(`  Unresolved: ${status.relationshipStats.unresolved}`)
        console.log(`  Cycles: ${status.relationshipStats.fileCycles} file cycles`)
      }
    }
    process.exit(0)
  }

  // 10. update
  if (command === 'update') {
    const isFull = flags.full === true
    const isDryRun = flags['dry-run'] === true
    const indexer = new IncrementalIndexer()

    try {
      const res = indexer.update({ forceFull: isFull, dryRun: isDryRun })
      if (isJson) {
        printJsonContract('update', 'repository', [res])
      } else {
        console.log(`\nIndex update completed: ${res.mode} (${res.status || 'DONE'})`)
        if (res.reason) console.log(`Reason: ${res.reason}`)
        if (res.stats) {
          console.log(`Statistics:`)
          console.log(`  Added: ${res.stats.added || 0}`)
          console.log(`  Modified: ${res.stats.modified || 0}`)
          console.log(`  Deleted: ${res.stats.deleted || 0}`)
          console.log(`  Renamed: ${res.stats.renamed || 0}`)
          console.log(`  Reprocessed: ${res.stats.reprocessed || 0}`)
          console.log(`  Total Files: ${res.stats.totalFiles || 0}`)
          console.log(`  Total Symbols: ${res.stats.totalSymbols || 0}`)
        }
      }
      process.exit(0)
    } catch (err) {
      if (isJson) {
        printJsonContract('update', 'repository', [], { errors: [err.message] })
      } else {
        console.error(`Error during update: ${err.message}`)
      }
      process.exit(1)
    }
  }

  console.error(`Unknown command: ${command}. Run 'node scripts/code-intel.mjs help' for usage.`)
  process.exit(1)
}

run()
