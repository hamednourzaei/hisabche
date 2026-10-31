import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { spawn } from 'node:child_process'
import path from 'node:path'
import {
  CodeIntelMcpServer,
  MCP_TOOLS,
  MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
} from '../lib/code-intel-mcp-server.mjs'

class MockDuplexClient {
  constructor(server) {
    this.server = server
    this.inStream = new PassThrough()
    this.outStream = new PassThrough()
    this.errStream = new PassThrough()
    this.responses = []
    this.errors = []

    this.server.inputStream = this.inStream
    this.server.outputStream = this.outStream
    this.server.errorStream = this.errStream
    this.server.start()

    let buffer = ''
    this.outStream.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      let newlineIdx
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim()
        buffer = buffer.slice(newlineIdx + 1)
        if (line) {
          try {
            this.responses.push(JSON.parse(line))
          } catch (e) {
            this.errors.push({ raw: line, error: e })
          }
        }
      }
    })
  }

  async send(msg) {
    const serialized = JSON.stringify(msg) + '\n'
    this.inStream.write(serialized)
    // Wait briefly for event loop processing
    await new Promise((r) => setTimeout(r, 40))
    return this.responses[this.responses.length - 1]
  }

  stop() {
    this.server.stop()
  }
}

describe('Code Intelligence MCP Server Adapter — Protocol Test Suite', () => {
  let server
  let client

  before(() => {
    server = new CodeIntelMcpServer()
    client = new MockDuplexClient(server)
  })

  // 1. Handshake & Initialization
  it('Protocol Handshake: handles initialize request and returns serverInfo & capabilities', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'claude-code', version: '1.0.0' },
      },
    })

    assert.ok(res)
    assert.strictEqual(res.jsonrpc, '2.0')
    assert.strictEqual(res.id, 1)
    assert.strictEqual(res.result.protocolVersion, MCP_PROTOCOL_VERSION)
    assert.strictEqual(res.result.serverInfo.name, MCP_SERVER_INFO.name)
    assert.strictEqual(res.result.capabilities.tools.listChanged, false)
  })

  it('Protocol Notification: handles notifications/initialized gracefully without response', async () => {
    const countBefore = client.responses.length
    await client.send({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })
    // Notifications must NOT emit a response
    assert.strictEqual(client.responses.length, countBefore)
    assert.strictEqual(server.isInitialized, true)
  })

  it('Protocol Ping: responds to ping request', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
    })

    assert.strictEqual(res.id, 2)
    assert.deepStrictEqual(res.result, {})
  })

  // 2. Tool Listing
  it('Tool Discovery: tools/list lists all 6 code intelligence tools with strict schemas', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
    })

    assert.strictEqual(res.id, 3)
    const { tools } = res.result
    assert.strictEqual(tools.length, 6)

    const toolNames = tools.map((t) => t.name).sort()
    assert.deepStrictEqual(toolNames, [
      'code_intel_find_symbols',
      'code_intel_get_relationships',
      'code_intel_get_source',
      'code_intel_get_symbol',
      'code_intel_impact',
      'code_intel_status',
    ])

    for (const tool of tools) {
      assert.ok(tool.description, `Tool ${tool.name} must have a description`)
      assert.strictEqual(tool.inputSchema.type, 'object')
      assert.strictEqual(tool.inputSchema.additionalProperties, false)
    }
  })

  // 3. Tool: code_intel_status
  it('Tool: code_intel_status returns index health and graph entity counts', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'code_intel_status',
        arguments: {},
      },
    })

    assert.strictEqual(res.id, 4)
    assert.strictEqual(res.result.isError, false)
    assert.ok(res.result.content[0].text.includes('Index Status:'))

    const envelope = res.result.structuredContent
    assert.strictEqual(envelope.operation, 'code_intel_status')
    assert.ok(envelope.results[0].totalFiles > 1000)
    assert.ok(envelope.results[0].totalSymbols > 10000)
    assert.ok(envelope.results[0].relationshipStats.total > 50000)
  })

  // 4. Tool: code_intel_find_symbols
  it('Tool: code_intel_find_symbols finds symbols with fuzzy search and filters', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'code_intel_find_symbols',
        arguments: {
          query: 'createInvoice',
          limit: 10,
        },
      },
    })

    assert.strictEqual(res.id, 5)
    assert.strictEqual(res.result.isError, false)
    const envelope = res.result.structuredContent
    assert.strictEqual(envelope.operation, 'code_intel_find_symbols')
    assert.ok(envelope.resultCount >= 1)
    assert.ok(envelope.results.some((s) => s.name.toLowerCase().includes('createinvoice')))
  })

  // 5. Tool: code_intel_get_symbol (exact & disambiguation)
  it('Tool: code_intel_get_symbol returns exact symbol card for unambiguous target', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_symbol',
        arguments: {
          symbol_id: '@hisabche/backend/backend/src/routes/accounting.routes.ts#accountingRoutes',
        },
      },
    })

    assert.strictEqual(res.id, 6)
    assert.strictEqual(res.result.isError, false)
    const envelope = res.result.structuredContent
    assert.strictEqual(envelope.ambiguous, false)
    assert.strictEqual(envelope.results[0].name, 'accountingRoutes')
    assert.strictEqual(envelope.results[0].package, '@hisabche/backend')
  })

  it('Tool: code_intel_get_symbol detects and disambiguates same-name declarations', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_symbol',
        arguments: {
          symbol_id: 'buildProfitReport',
        },
      },
    })

    assert.strictEqual(res.id, 7)
    assert.strictEqual(res.result.isError, false)
    const envelope = res.result.structuredContent
    assert.strictEqual(envelope.ambiguous, true)
    assert.ok(envelope.results.length >= 2)
    assert.ok(envelope.warnings.length > 0)
    assert.ok(envelope.warnings[0].includes('buildProfitReport'))
  })

  it('Tool: code_intel_get_symbol returns isError: true and suggestions when symbol is not found', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_symbol',
        arguments: {
          symbol_id: 'nonExistentMcpFunctionXYZ',
        },
      },
    })

    assert.strictEqual(res.id, 8)
    assert.strictEqual(res.result.isError, true)
    assert.ok(res.result.content[0].text.includes('[ERROR]'))
    const envelope = res.result.structuredContent
    assert.strictEqual(envelope.resultCount, 0)
    assert.ok(envelope.errors.length > 0)
  })

  // 6. Tool: code_intel_get_relationships
  it('Tool: code_intel_get_relationships retrieves callers, callees, and file imports', async () => {
    // Callers
    const callersRes = await client.send({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_relationships',
        arguments: {
          target: 'useActivities',
          direction: 'callers',
        },
      },
    })
    assert.strictEqual(callersRes.result.isError, false)
    assert.strictEqual(callersRes.result.structuredContent.direction, 'callers')

    // Callees
    const calleesRes = await client.send({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_relationships',
        arguments: {
          target: '@hisabche/app-bridge/packages/app-bridge/src/push-order.ts#createPushGate',
          direction: 'callees',
        },
      },
    })
    assert.strictEqual(calleesRes.result.isError, false)
    assert.ok(calleesRes.result.structuredContent.results.length >= 1)

    // Imports
    const importsRes = await client.send({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_relationships',
        arguments: {
          target: 'packages/api/src/hooks/useActivities.ts',
          direction: 'imports',
        },
      },
    })
    assert.strictEqual(importsRes.result.isError, false)
    assert.ok(importsRes.result.structuredContent.results.length >= 1)
  })

  // 7. Tool: code_intel_impact
  it('Tool: code_intel_impact performs bounded blast radius analysis', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'code_intel_impact',
        arguments: {
          target: '@hisabche/local-engine/packages/local-engine/src/db.ts#LocalDb',
          depth: 1,
          limit: 10,
        },
      },
    })

    assert.strictEqual(res.id, 12)
    assert.strictEqual(res.result.isError, false)
    const envelope = res.result.structuredContent
    assert.strictEqual(
      envelope.target,
      '@hisabche/local-engine/packages/local-engine/src/db.ts#LocalDb',
    )
    assert.strictEqual(envelope.depth, 1)
    assert.ok(Array.isArray(envelope.results[0].directCallers))
  })

  // 8. Tool: code_intel_get_source & Security
  it('Tool: code_intel_get_source retrieves line-numbered excerpts with hash verification', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_source',
        arguments: {
          target:
            '@hisabche/validation/packages/validation/src/schemas/product.schema.ts#productSchema',
          context_lines: 2,
        },
      },
    })

    assert.strictEqual(res.id, 13)
    assert.strictEqual(res.result.isError, false)
    const excerpt = res.result.structuredContent.results[0]
    assert.strictEqual(excerpt.file, 'packages/validation/src/schemas/product.schema.ts')
    assert.ok(excerpt.linesWithNumbers.includes('productSchema'))
    assert.strictEqual(excerpt.isStale, false)
  })

  it('Security: rejects path traversal outside repository root', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_source',
        arguments: {
          target: '../../outside.ts',
        },
      },
    })

    assert.strictEqual(res.id, 14)
    assert.strictEqual(res.result.isError, true)
    assert.ok(res.result.structuredContent.errors[0].includes('Path traversal'))
  })

  it('Security: rejects access to .env files', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: {
        name: 'code_intel_get_source',
        arguments: {
          target: '.env',
        },
      },
    })

    assert.strictEqual(res.id, 15)
    assert.strictEqual(res.result.isError, true)
    assert.ok(res.result.structuredContent.errors[0].includes('forbidden'))
  })

  // 9. Input Schema Validation Rejections
  it('Schema Validation: rejects unknown tool arguments (additionalProperties: false)', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: {
        name: 'code_intel_status',
        arguments: {
          unknownOption: 'invalid',
        },
      },
    })

    assert.strictEqual(res.id, 16)
    assert.strictEqual(res.result.isError, true)
    assert.ok(res.result.content[0].text.includes("Unknown argument 'unknownOption'"))
  })

  it('Schema Validation: rejects missing required arguments', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: {
        name: 'code_intel_find_symbols',
        arguments: {},
      },
    })

    assert.strictEqual(res.id, 17)
    assert.strictEqual(res.result.isError, true)
    assert.ok(res.result.content[0].text.includes("Missing required argument 'query'"))
  })

  // 10. Protocol Errors
  it('Protocol Error: returns -32601 on unknown method', async () => {
    const res = await client.send({
      jsonrpc: '2.0',
      id: 18,
      method: 'unknownProtocolMethod',
    })

    assert.strictEqual(res.id, 18)
    assert.strictEqual(res.error.code, -32601)
    assert.ok(res.error.message.includes('Method not found'))
  })

  it('Protocol Error: returns -32700 on malformed raw JSON string', async () => {
    client.inStream.write('this is not valid json\n')
    await new Promise((r) => setTimeout(r, 40))
    const lastRes = client.responses[client.responses.length - 1]
    assert.strictEqual(lastRes.id, null)
    assert.strictEqual(lastRes.error.code, -32700)
  })

  // 11. Stdio Transport Process Test (Real Subprocess Spawn)
  it('Real Subprocess: runs scripts/code-intel-mcp.mjs via child_process without stdout contamination', async () => {
    const child = spawn('node', ['scripts/code-intel-mcp.mjs'], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdoutData = ''
    let stderrData = ''

    child.stdout.on('data', (d) => {
      stdoutData += d.toString('utf8')
    })

    child.stderr.on('data', (d) => {
      stderrData += d.toString('utf8')
    })

    // Send initialize request
    const initReq =
      JSON.stringify({
        jsonrpc: '2.0',
        id: 101,
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'agent-subprocess-test', version: '1.0.0' },
        },
      }) + '\n'

    child.stdin.write(initReq)

    // Wait briefly for response
    await new Promise((r) => setTimeout(r, 300))

    // Send tools/call status request
    const statusReq =
      JSON.stringify({
        jsonrpc: '2.0',
        id: 102,
        method: 'tools/call',
        params: {
          name: 'code_intel_status',
          arguments: {},
        },
      }) + '\n'

    child.stdin.write(statusReq)

    // Wait for response with polling loop
    for (let i = 0; i < 30; i++) {
      if (stdoutData.trim().split('\n').filter(Boolean).length >= 2) break
      await new Promise((r) => setTimeout(r, 100))
    }

    child.kill('SIGTERM')

    // Stderr should contain startup banner
    assert.ok(
      stderrData.includes('Hisabche Code Intelligence MCP Server starting on stdio transport'),
    )

    // Stdout should ONLY contain valid JSON-RPC lines
    const lines = stdoutData.trim().split('\n').filter(Boolean)
    assert.ok(lines.length >= 2, `Expected at least 2 JSON-RPC lines, got ${lines.length}`)

    for (const line of lines) {
      let parsed
      assert.doesNotThrow(() => {
        parsed = JSON.parse(line)
      }, `Stdout line must be pure valid JSON: ${line}`)
      assert.strictEqual(parsed.jsonrpc, '2.0')
    }

    const initResp = lines.map((l) => JSON.parse(l)).find((p) => p.id === 101)
    assert.ok(initResp)
    assert.strictEqual(initResp.result.serverInfo.name, MCP_SERVER_INFO.name)

    const statusResp = lines.map((l) => JSON.parse(l)).find((p) => p.id === 102)
    assert.ok(statusResp)
    assert.strictEqual(statusResp.result.isError, false)
  })
})
