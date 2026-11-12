#!/usr/bin/env node

/**
 * sign-manifest.mjs
 *
 * Developer tool for generating Ed25519 keypairs and signing a pack manifest.
 *
 * Usage:
 *   # Generate a new Ed25519 keypair for local testing:
 *   node scripts/packs/sign-manifest.mjs generate-keys
 *
 *   # Sign an existing pack-manifest.json (writes <manifest>.sig base64 detached signature):
 *   node scripts/packs/sign-manifest.mjs sign <path-to-manifest.json> <path-to-private-key.pem>
 *
 * OWNER NOTE:
 * In production, signing happens in CI/CD using the owner's private key stored
 * in GitHub Secrets or HSM. Never commit private keys to the repository.
 */

import { generateKeyPairSync, sign } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [, , cmd, arg1, arg2] = process.argv

if (cmd === 'generate-keys') {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })

  console.log('--- Generated Ed25519 Keypair ---')
  console.log('\n--- PUBLIC KEY (SPKI PEM - Place in config / client bundle) ---\n')
  console.log(publicKey)
  console.log('\n--- PRIVATE KEY (PKCS8 PEM Secret - never commit!) ---\n')
  console.log(privateKey)
  process.exit(0)
}

if (cmd === 'sign') {
  if (!arg1 || !arg2) {
    console.error(
      'Usage: node scripts/packs/sign-manifest.mjs sign <manifest.json> <private-key.pem>',
    )
    process.exit(1)
  }

  const manifestPath = resolve(process.cwd(), arg1)
  const keyPath = resolve(process.cwd(), arg2)

  // Match verifyManifestEd25519(): detached base64 Ed25519 signature over exact manifest bytes
  const manifestBytes = readFileSync(manifestPath)
  const privateKey = readFileSync(keyPath, 'utf8')
  const sigBuffer = sign(null, manifestBytes, privateKey)
  const base64Signature = sigBuffer.toString('base64')
  const sigPath = `${manifestPath}.sig`

  writeFileSync(sigPath, `${base64Signature}\n`, 'utf8')

  console.log(`Successfully signed ${manifestPath} -> ${sigPath}`)
  console.log(`Signature (base64): ${base64Signature}`)
  process.exit(0)
}

console.error('Unknown command. Available commands: generate-keys, sign')
process.exit(1)
