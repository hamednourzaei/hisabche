/**
 * Hisabche Code Intelligence — MCP Server Adapter
 * Standards-compliant Model Context Protocol (MCP) adapter over CodeIntelQueryEngine
 * Zero-dependency JSON-RPC 2.0 stdio implementation
 */

import readline from 'node:readline'
import { CodeIntelQueryEngine } from './code-intel-query.mjs'

export const MCP_SERVER_INFO = {
  name: 'hisabche-code-intelligence',
  version: '1.0.0',
}

export const MCP_PROTOCOL_VERSION = '2024-11-05'

export const MCP_TOOLS = [
  {
    name: 'code_intel_status',
    description:
      'Retrieves current Code Intelligence index status, schema version, git head match, and graph entity counts.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'code_intel_find_symbols',
    description:
      'Finds symbols in Hisabche codebase by exact or fuzzy name with optional package, domain, kind, and export status filters.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol name or search query' },
        exact: {
          type: 'boolean',
          description: 'Whether to require exact name match (default: false)',
        },
        package: {
          type: 'string',
          description: 'Filter by package name (e.g. @hisabche/backend, @hisabche/ui)',
        },
        file: { type: 'string', description: 'Filter by file substring' },
        kind: {
          type: 'string',
          description:
            'Filter by symbol kind (function, class, interface, type_alias, react_component, etc.)',
        },
        domain: {
          type: 'string',
          description:
            'Filter by business domain (Invoices, Payments, Inventory, Accounting, Sync, etc.)',
        },
        exported: { type: 'boolean', description: 'Filter by exported status' },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 50, max: 100)',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'code_intel_get_symbol',
    description:
      'Retrieves exact symbol metadata, signature, source location, docstring, and hashes. Detects and disambiguates same-name declarations.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol_id: { type: 'string', description: 'Exact symbol ID or symbol name' },
      },
      required: ['symbol_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'code_intel_get_relationships',
    description:
      'Retrieves callers, callees, imports, or test relationships for a symbol or file using AST-verified evidence.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target symbol ID or file path' },
        direction: {
          type: 'string',
          enum: ['callers', 'callees', 'imports', 'tests', 'all'],
          description: 'Relationship direction to query (default: callers)',
        },
        verified_only: {
          type: 'boolean',
          description:
            'Whether to restrict results to RESOLVED relationships only (default: false)',
        },
        limit: { type: 'number', description: 'Maximum results to return (default: 50, max: 100)' },
      },
      required: ['target'],
      additionalProperties: false,
    },
  },
  {
    name: 'code_intel_impact',
    description:
      'Performs bounded blast radius and dependency impact analysis for a symbol or file, preventing circular loops.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target symbol ID or file path' },
        depth: { type: 'number', description: 'Maximum traversal depth (default: 1, max: 3)' },
        limit: {
          type: 'number',
          description: 'Maximum impact nodes to return (default: 20, max: 50)',
        },
      },
      required: ['target'],
      additionalProperties: false,
    },
  },
  {
    name: 'code_intel_get_source',
    description:
      'Retrieves line-numbered source excerpts for a symbol or file with hash verification and staleness detection. Path-traversal and secrets protected.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Target symbol ID or file path' },
        context_lines: {
          type: 'number',
          description: 'Surrounding context lines to include (default: 3, max: 20)',
        },
        start_line: { type: 'number', description: 'Optional explicit start line override' },
        end_line: { type: 'number', description: 'Optional explicit end line override' },
      },
      required: ['target'],
      additionalProperties: false,
    },
  },
]

export class CodeIntelMcpServer {
  constructor(options = {}) {
    this.engine = options.engine || new CodeIntelQueryEngine(options.queryOptions || {})
    this.inputStream = options.input || process.stdin
    this.outputStream = options.output || process.stdout
    this.errorStream = options.error || process.stderr
    this.rl = null
    this.isInitialized = false
  }

  /**
   * Initializes server and binds stdio listeners
   */
  start() {
    this.engine.load()

    this.rl = readline.createInterface({
      input: this.inputStream,
      terminal: false,
    })

    this.rl.on('line', (line) => {
      this.handleRawMessage(line)
    })

    this.rl.on('close', () => {
      this.stop()
    })
  }

  /**
   * Stops the server cleanly
   */
  stop() {
    if (this.rl) {
      this.rl.close()
      this.rl = null
    }
  }

  /**
   * Parses and routes an incoming raw string message
   */
  async handleRawMessage(rawText) {
    const trimmed = (rawText || '').trim()
    if (!trimmed) return

    let request
    try {
      request = JSON.parse(trimmed)
    } catch (err) {
      this.sendError(null, -32700, `Parse error: Invalid JSON (${err.message})`)
      return
    }

    await this.handleMessage(request)
  }

  /**
   * Processes a parsed JSON-RPC 2.0 request
   */
  async handleMessage(req) {
    if (!req || typeof req !== 'object') {
      this.sendError(null, -32600, 'Invalid Request: payload must be an object')
      return
    }

    const { id, method, params } = req

    // Handle JSON-RPC notifications (no id)
    if (id === undefined || id === null) {
      if (method === 'notifications/initialized') {
        this.isInitialized = true
      }
      return
    }

    try {
      switch (method) {
        case 'initialize':
          this.handleInitialize(id, params)
          break

        case 'ping':
          this.sendResult(id, {})
          break

        case 'tools/list':
          this.handleToolsList(id)
          break

        case 'tools/call':
          await this.handleToolsCall(id, params)
          break

        default:
          this.sendError(id, -32601, `Method not found: '${method}'`)
          break
      }
    } catch (err) {
      this.logError(`Internal error handling method '${method}': ${err.message}`)
      this.sendError(id, -32603, `Internal error: ${err.message}`)
    }
  }

  /**
   * Handles initialize handshake
   */
  handleInitialize(id, params) {
    this.isInitialized = true
    this.sendResult(id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: MCP_SERVER_INFO,
    })
  }

  /**
   * Handles tools/list
   */
  handleToolsList(id) {
    this.sendResult(id, {
      tools: MCP_TOOLS,
    })
  }

  /**
   * Validates tool input arguments against inputSchema
   */
  validateArguments(schema, args = {}) {
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      return { valid: false, error: 'Arguments must be a key-value object' }
    }

    // Required fields check
    for (const req of schema.required || []) {
      if (args[req] === undefined || args[req] === null || args[req] === '') {
        return { valid: false, error: `Missing required argument '${req}'` }
      }
    }

    // Disallowed additional properties
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties || {}))
      for (const key of Object.keys(args)) {
        if (!allowed.has(key)) {
          return { valid: false, error: `Unknown argument '${key}'` }
        }
      }
    }

    // Type checks
    for (const [key, val] of Object.entries(args)) {
      const propSchema = schema.properties?.[key]
      if (!propSchema) continue

      if (propSchema.type === 'string' && typeof val !== 'string') {
        return { valid: false, error: `Argument '${key}' must be a string` }
      }
      if (propSchema.type === 'boolean' && typeof val !== 'boolean') {
        return { valid: false, error: `Argument '${key}' must be a boolean` }
      }
      if (propSchema.type === 'number' && (typeof val !== 'number' || isNaN(val))) {
        return { valid: false, error: `Argument '${key}' must be a valid number` }
      }
      if (propSchema.enum && !propSchema.enum.includes(val)) {
        return {
          valid: false,
          error: `Argument '${key}' must be one of: ${propSchema.enum.join(', ')}`,
        }
      }
      if (propSchema.minimum !== undefined && val < propSchema.minimum) {
        return { valid: false, error: `Argument '${key}' must be >= ${propSchema.minimum}` }
      }
      if (propSchema.maximum !== undefined && val > propSchema.maximum) {
        return { valid: false, error: `Argument '${key}' must be <= ${propSchema.maximum}` }
      }
    }

    return { valid: true }
  }

  /**
   * Handles tools/call
   */
  async handleToolsCall(id, params) {
    if (!params || !params.name) {
      this.sendError(id, -32602, 'Invalid params: missing tool name')
      return
    }

    const { name, arguments: args = {} } = params
    const toolDef = MCP_TOOLS.find((t) => t.name === name)

    if (!toolDef) {
      this.sendError(id, -32601, `Unknown tool: '${name}'`)
      return
    }

    // Validate inputs against tool schema
    const validation = this.validateArguments(toolDef.inputSchema, args)
    if (!validation.valid) {
      this.sendToolResult(id, {
        operation: name,
        error: validation.error,
        isError: true,
      })
      return
    }

    let status = this.engine.loaded ? 'FRESH' : 'UNKNOWN'

    switch (name) {
      case 'code_intel_status': {
        const indexStatus = this.engine.getIndexStatus()
        status = indexStatus.status
        this.sendToolResult(id, {
          operation: 'code_intel_status',
          indexStatus: indexStatus.status,
          resultCount: 1,
          results: [indexStatus],
          warnings:
            indexStatus.status === 'STALE'
              ? [
                  'Index is stale relative to git HEAD or disk files. Rebuild with: node scripts/build-ai-index.mjs',
                ]
              : [],
          errors: [],
          isError: false,
        })
        break
      }

      case 'code_intel_find_symbols': {
        const query = args.query
        const searchFilters = {
          exact: args.exact === true,
          package: args.package,
          file: args.file,
          kind: args.kind,
          domain: args.domain,
          exported: args.exported,
          limit: Math.min(args.limit || 50, 100),
        }

        const res = this.engine.findSymbols(query, searchFilters)
        this.sendToolResult(id, {
          operation: 'code_intel_find_symbols',
          indexStatus: status,
          target: query,
          resultCount: res.totalFound,
          truncated: res.totalFound >= (searchFilters.limit || 50),
          results: res.results,
          warnings: res.totalFound === 0 ? [`No symbols matching '${query}' found in index.`] : [],
          errors: [],
          isError: false,
        })
        break
      }

      case 'code_intel_get_symbol': {
        const symbolId = args.symbol_id
        const res = this.engine.getSymbol(symbolId)

        if (!res.found) {
          this.sendToolResult(id, {
            operation: 'code_intel_get_symbol',
            indexStatus: status,
            target: symbolId,
            resultCount: 0,
            results: [],
            warnings:
              res.candidates?.length > 0
                ? [
                    `Symbol '${symbolId}' not found. Did you mean one of: ${res.candidates.map((c) => c.name).join(', ')}?`,
                  ]
                : [`Symbol '${symbolId}' not found in index.`],
            errors: [res.error || `Symbol '${symbolId}' not found`],
            isError: true,
          })
          return
        }

        const warnings = []
        if (res.ambiguous) {
          warnings.push(
            res.warning ||
              `Multiple declarations share the name '${symbolId}'. Showing first candidate. Specify full symbol ID for exact target.`,
          )
        }

        this.sendToolResult(id, {
          operation: 'code_intel_get_symbol',
          indexStatus: status,
          target: symbolId,
          ambiguous: res.ambiguous,
          resultCount: res.ambiguous ? res.allMatches.length : 1,
          results: res.ambiguous ? res.allMatches : [res.symbol],
          warnings,
          errors: [],
          isError: false,
        })
        break
      }

      case 'code_intel_get_relationships': {
        const target = args.target
        const direction = args.direction || 'callers'
        const verifiedOnly = args.verified_only === true
        const limit = Math.min(args.limit || 50, 100)

        let results = []
        let warnings = []
        let errors = []

        if (direction === 'callers') {
          const callersRes = this.engine.getCallers(target, { verifiedOnly, limit })
          results = callersRes.callers || []
          if (callersRes.error) errors.push(callersRes.error)
        } else if (direction === 'callees') {
          const calleesRes = this.engine.getCallees(target, { verifiedOnly, limit })
          results = calleesRes.callees || []
          if (calleesRes.error) errors.push(calleesRes.error)
        } else if (direction === 'imports') {
          const importsRes = this.engine.getImports(target)
          results = [...(importsRes.imports || []), ...(importsRes.reExports || [])]
        } else if (direction === 'tests') {
          const testsRes = this.engine.getRelatedTests(target)
          results = testsRes.tests || []
          if (testsRes.error) errors.push(testsRes.error)
        } else if (direction === 'all') {
          const callers = this.engine.getCallers(target, { verifiedOnly, limit }).callers || []
          const callees = this.engine.getCallees(target, { verifiedOnly, limit }).callees || []
          const tests = this.engine.getRelatedTests(target).tests || []
          results = [
            {
              target,
              callers,
              callees,
              tests,
              totalRelationships: callers.length + callees.length + tests.length,
            },
          ]
        }

        const isError = errors.length > 0 && results.length === 0
        this.sendToolResult(id, {
          operation: `code_intel_get_relationships:${direction}`,
          indexStatus: status,
          target,
          direction,
          verifiedOnly,
          resultCount: results.length,
          truncated: results.length >= limit,
          results,
          warnings,
          errors,
          isError,
        })
        break
      }

      case 'code_intel_impact': {
        const target = args.target
        const depth = args.depth || 1
        const limit = args.limit || 20

        const impact = this.engine.getImpactSummary(target, { depth, limit })
        this.sendToolResult(id, {
          operation: 'code_intel_impact',
          indexStatus: status,
          target,
          depth,
          resultCount: 1,
          truncated: impact.truncated,
          results: [impact],
          warnings:
            impact.relevantCycles?.length > 0
              ? [
                  `Target participates in ${impact.relevantCycles.length} circular dependency cycle(s).`,
                ]
              : [],
          errors: [],
          isError: false,
        })
        break
      }

      case 'code_intel_get_source': {
        const target = args.target
        const contextLines = args.context_lines !== undefined ? args.context_lines : 3
        const excerptRes = this.engine.getSourceExcerpt(target, {
          contextLines,
          startLine: args.start_line,
          endLine: args.end_line,
        })

        if (!excerptRes.success) {
          this.sendToolResult(id, {
            operation: 'code_intel_get_source',
            indexStatus: status,
            target,
            resultCount: 0,
            results: [],
            warnings: [],
            errors: [excerptRes.error],
            isError: true,
          })
          return
        }

        const warnings = []
        if (excerptRes.isStale && excerptRes.staleWarning) {
          warnings.push(excerptRes.staleWarning)
        }

        this.sendToolResult(id, {
          operation: 'code_intel_get_source',
          indexStatus: status,
          target,
          resultCount: 1,
          results: [excerptRes],
          warnings,
          errors: [],
          isError: false,
        })
        break
      }

      default:
        this.sendError(id, -32601, `Unhandled tool: '${name}'`)
        break
    }
  }

  /**
   * Helper to format and send standard MCP tool response
   */
  sendToolResult(id, payload) {
    const isError = payload.isError === true
    const textSummary = this.formatPayloadSummary(payload)

    const response = {
      jsonrpc: '2.0',
      id,
      result: {
        content: [
          {
            type: 'text',
            text: textSummary,
          },
        ],
        structuredContent: payload,
        isError,
      },
    }

    this.sendRaw(response)
  }

  /**
   * Formats human-readable summary text for content[0].text
   */
  formatPayloadSummary(p) {
    if (p.isError) {
      return `[ERROR] ${p.errors?.join('; ') || p.error || 'Operation failed'}`
    }

    if (p.operation === 'code_intel_status') {
      const s = p.results?.[0] || {}
      return `Index Status: ${s.status} (Schema v${s.schemaVersion})\nFiles: ${s.totalFiles}, Symbols: ${s.totalSymbols}, Relationships: ${s.relationshipStats?.total || 0}`
    }

    if (p.operation === 'code_intel_get_source') {
      const ex = p.results?.[0] || {}
      return `File: ${ex.file} (Lines ${ex.contextFromLine}-${ex.contextToLine})\n${ex.linesWithNumbers}`
    }

    if (p.operation === 'code_intel_impact') {
      const imp = p.results?.[0] || {}
      return `Impact for ${imp.target} (depth ${imp.depth}):\nCallers: ${imp.directCallers?.length || 0}, Callees: ${imp.directCallees?.length || 0}, Tests: ${imp.relatedTests?.length || 0}`
    }

    return `Operation: ${p.operation}\nResults: ${p.resultCount} items returned (Index: ${p.indexStatus})`
  }

  /**
   * Sends a successful JSON-RPC result
   */
  sendResult(id, result) {
    this.sendRaw({
      jsonrpc: '2.0',
      id,
      result,
    })
  }

  /**
   * Sends a JSON-RPC error
   */
  sendError(id, code, message, data = null) {
    const response = {
      jsonrpc: '2.0',
      id: id !== undefined ? id : null,
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
    }
    this.sendRaw(response)
  }

  /**
   * Writes a newline-delimited JSON payload strictly to output stream (stdout)
   */
  sendRaw(obj) {
    const serialized = JSON.stringify(obj) + '\n'
    this.outputStream.write(serialized)
  }

  /**
   * Writes debug logs strictly to error stream (stderr) to never pollute stdout
   */
  logError(msg) {
    this.errorStream.write(`[mcp-server] ${msg}\n`)
  }
}
