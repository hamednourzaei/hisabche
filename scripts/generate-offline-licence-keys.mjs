// ============================================
// One Ed25519 key pair for offline-edition licences.
//
//   node scripts/generate-offline-licence-keys.mjs
//
// · OFFLINE_LICENSE_PRIVATE_KEY → the BACKEND's environment (Render), never in
//   git, never in an app build. It signs licences (offline-license.service).
// · VITE_OFFLINE_LICENSE_PUBLIC_KEY → the Windows and Android BUILD
//   environment. The app checks every licence with it (offline-license.ts);
//   a build without it refuses every licence.
//
// Run once. A new pair invalidates every licence already issued.
// The 32-byte values are the same ones @noble/curves uses: the seed of the
// PKCS#8 key and the raw key of the SPKI one.
// ============================================

import { generateKeyPairSync } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32)
const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)

console.log('Backend (secret):')
console.log(`OFFLINE_LICENSE_PRIVATE_KEY=${seed.toString('hex')}`)
console.log('OFFLINE_LICENSE_KEY_ID=v1')
console.log('')
console.log('App builds (public):')
console.log(`VITE_OFFLINE_LICENSE_PUBLIC_KEY=${raw.toString('hex')}`)
