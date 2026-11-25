#!/usr/bin/env node
/**
 * Hisabche Code Intelligence V3.0 — Zero-Dependency MCP Auto-Configuration Utility
 *
 * Detects supported coding agent harnesses and merges `hisabche-intel` MCP server
 * configuration safely (always creating timestamped backups before modifying files).
 *
 * Usage:
 *   node scripts/setup-mcp.mjs              # Configure workspace configs (.mcp.json, .cursor/mcp.json, .vscode/mcp.json)
 *   node scripts/setup-mcp.mjs --global     # Also configure detected user-home harnesses (~/.claude.json, ~/.cursor/mcp.json, ~/.config/opencode/opencode.json, ~/.gemini/antigravity/mcp_config.json)
 *   node scripts/setup-mcp.mjs --dry-run    # Preview changes without writing files
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { homedir } from 'node:os'

const ROOT = process.cwd()
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const includeGlobal = args.includes('--global')

const MCP_SCRIPT = resolve(ROOT, 'scripts', 'code-intel-mcp.mjs').replace(/\\/g, '/')

function backupAndWriteJson(filePath, updater) {
  let current = {}
  if (existsSync(filePath)) {
    try {
      current = JSON.parse(readFileSync(filePath, 'utf8'))
    } catch {
      return { path: filePath, status: 'SKIPPED_INVALID_JSON' }
    }
  }

  const next = updater(structuredClone(current))
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return { path: filePath, status: 'ALREADY_CONFIGURED' }
  }

  if (isDryRun) {
    return { path: filePath, status: 'DRY_RUN_WOULD_UPDATE' }
  }

  mkdirSync(dirname(filePath), { recursive: true })
  if (existsSync(filePath)) {
    const bak = `${filePath}.bak.${Date.now()}`
    copyFileSync(filePath, bak)
  }
  writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n', 'utf8')
  return { path: filePath, status: 'UPDATED' }
}

const serverEntry = {
  command: 'node',
  args: [MCP_SCRIPT],
  env: {
    HISABCHE_CODE_INTEL_READONLY: '1',
  },
}

const targets = [
  {
    name: 'Claude Code / Workspace MCP (.mcp.json)',
    path: join(ROOT, '.mcp.json'),
    alwaysCreate: true,
    update: (cfg) => {
      cfg.mcpServers = cfg.mcpServers || {}
      cfg.mcpServers['hisabche-intel'] = serverEntry
      return cfg
    },
  },
  {
    name: 'Cursor Workspace (.cursor/mcp.json)',
    path: join(ROOT, '.cursor', 'mcp.json'),
    alwaysCreate: true,
    update: (cfg) => {
      cfg.mcpServers = cfg.mcpServers || {}
      cfg.mcpServers['hisabche-intel'] = serverEntry
      return cfg
    },
  },
  {
    name: 'VS Code / Copilot Workspace (.vscode/mcp.json)',
    path: join(ROOT, '.vscode', 'mcp.json'),
    alwaysCreate: existsSync(join(ROOT, '.vscode')),
    update: (cfg) => {
      cfg.servers = cfg.servers || {}
      cfg.servers['hisabche-intel'] = {
        type: 'stdio',
        command: 'node',
        args: ['scripts/code-intel-mcp.mjs'],
      }
      return cfg
    },
  },
]

if (includeGlobal) {
  const home = homedir()
  targets.push(
    {
      name: 'Claude Code Global (~/.claude.json)',
      path: join(home, '.claude.json'),
      alwaysCreate: false,
      update: (cfg) => {
        cfg.mcpServers = cfg.mcpServers || {}
        cfg.mcpServers['hisabche-intel'] = serverEntry
        return cfg
      },
    },
    {
      name: 'Cursor Global (~/.cursor/mcp.json)',
      path: join(home, '.cursor', 'mcp.json'),
      alwaysCreate: false,
      update: (cfg) => {
        cfg.mcpServers = cfg.mcpServers || {}
        cfg.mcpServers['hisabche-intel'] = serverEntry
        return cfg
      },
    },
    {
      name: 'OpenCode Global (~/.config/opencode/opencode.json)',
      path: join(home, '.config', 'opencode', 'opencode.json'),
      alwaysCreate: false,
      update: (cfg) => {
        cfg.mcp = cfg.mcp || {}
        cfg.mcp['hisabche-intel'] = {
          type: 'local',
          command: ['node', MCP_SCRIPT],
          enabled: true,
        }
        return cfg
      },
    },
    {
      name: 'Antigravity Global (~/.gemini/antigravity/mcp_config.json)',
      path: join(home, '.gemini', 'antigravity', 'mcp_config.json'),
      alwaysCreate: false,
      update: (cfg) => {
        cfg.mcpServers = cfg.mcpServers || {}
        cfg.mcpServers['hisabche-intel'] = serverEntry
        return cfg
      },
    },
  )
}

const results = []
for (const target of targets) {
  if (!target.alwaysCreate && !existsSync(target.path)) {
    results.push({ harness: target.name, path: target.path, status: 'NOT_DETECTED' })
    continue
  }
  const outcome = backupAndWriteJson(target.path, target.update)
  results.push({ harness: target.name, ...outcome })
}

console.log(
  JSON.stringify({ mode: isDryRun ? 'dry-run' : 'apply', includeGlobal, results }, null, 2),
)
