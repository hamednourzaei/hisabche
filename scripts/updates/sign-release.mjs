#!/usr/bin/env node
/**
 * Release-signing CLI for Hisabche Core, Module, Data-Pack, and Halt manifests.
 *
 * SECURITY:
 * - Private signing keys NEVER live in the repository.
 * - Reads Ed25519 PKCS#8 PEM private key strictly from --key-file or
 *   HISABCHE_SIGNING_PRIVATE_KEY_FILE.
 * - Uses RFC 8785 canonical JSON matching @hisabche/updater-core.
 */

import { createHash, sign as cryptoSign } from 'node:crypto'
import fs from 'node:fs'

function canonicalize(value) {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('NON_FINITE_NUMBER')
    return Object.is(value, -0) ? '0' : JSON.stringify(value)
  }
  if (typeof value === 'string') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : canonicalize(v))).join(',')}]`
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value)
      .filter((k) => value[k] !== undefined)
      .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`
  }
  throw new Error(`UNSUPPORTED_TYPE:${typeof value}`)
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const cur = argv[i]
    if (!cur?.startsWith('--')) continue
    const key = cur.slice(2)
    const val = argv[i + 1]
    if (val && !val.startsWith('--')) {
      args[key] = val
      i += 1
    } else {
      args[key] = 'true'
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const manifestPath = args.manifest
const keyFile = args['key-file'] ?? process.env.HISABCHE_SIGNING_PRIVATE_KEY_FILE
const keyId = args['key-id'] ?? 'root-2026-01'
const sequence = Number(args.sequence ?? '1')
const ttlHours = Number(args['ttl-hours'] ?? '720')

if (!manifestPath || !keyFile) {
  console.error(
    'Usage: node scripts/updates/sign-release.mjs --manifest <in.json> --key-file <ed25519-pkcs8.pem> [--artifact <file.bin>] [--key-id <id>] [--sequence <n>] [--out <signed.json>]',
  )
  process.exit(1)
}

const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
if (args.artifact) {
  const artBytes = fs.readFileSync(args.artifact)
  rawManifest.artifact = {
    ...(rawManifest.artifact ?? {}),
    sha256: createHash('sha256').update(artBytes).digest('hex').toLowerCase(),
    sizeBytes: artBytes.length,
  }
}

const { signature: _ignored, ...payloadWithoutSignature } = rawManifest
const now = new Date()
const expires = new Date(now.getTime() + ttlHours * 3600 * 1000)
const signatureMeta = {
  role: args.role ?? 'targets',
  keyId,
  algorithm: 'ed25519',
  sequence,
  signedAt: now.toISOString(),
  expiresAt: expires.toISOString(),
}

const canonicalBytes = Buffer.from(
  canonicalize({ ...payloadWithoutSignature, signatureMeta }),
  'utf8',
)
const privateKeyPem = fs.readFileSync(keyFile, 'utf8')
const sigBase64 = cryptoSign(null, canonicalBytes, privateKeyPem).toString('base64')

const signed = {
  ...payloadWithoutSignature,
  signature: { ...signatureMeta, sigBase64 },
}

const outJson = JSON.stringify(signed, null, 2)
if (args.out) {
  fs.writeFileSync(args.out, `${outJson}\n`, 'utf8')
} else {
  process.stdout.write(`${outJson}\n`)
}
