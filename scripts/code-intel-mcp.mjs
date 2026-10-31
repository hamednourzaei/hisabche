#!/usr/bin/env node
/**
 * Hisabche Code Intelligence — Standalone MCP Server (stdio transport)
 * Entry point for Claude Code, OpenCode, Codex, Cursor, and other MCP clients.
 *
 * Usage:
 *   node scripts/code-intel-mcp.mjs
 */

import { CodeIntelMcpServer } from './lib/code-intel-mcp-server.mjs'

// Clean stderr banner; stdout is strictly reserved for JSON-RPC 2.0 messages
process.stderr.write('Hisabche Code Intelligence MCP Server starting on stdio transport...\n')

const server = new CodeIntelMcpServer({
  input: process.stdin,
  output: process.stdout,
  error: process.stderr,
})

server.start()

process.on('SIGINT', () => {
  server.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  server.stop()
  process.exit(0)
})
