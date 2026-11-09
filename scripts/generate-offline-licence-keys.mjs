// ============================================
// One Ed25519 key pair for offline-edition licences — for ROTATION only.
//
//   node scripts/generate-offline-licence-keys.mjs
//
// Owner decision, 9 Nov 2026: «در دیتابیس بماند». The private key lives ONLY
// in `offline_license_signing_keys` (offline-licence-keys-01/02); the backend
// stores nothing of its own and reads no environment key. So this prints:
//   · the entry to ADD to TRUSTED_LICENCE_KEYS
//     (packages/app-shell/src/shared/lib/licence-keys.ts);
//   · the SQL that makes it the active row.
//
// Order (licences signed with the new key must be accepted before any are made):
//   1. add the entry to TRUSTED_LICENCE_KEYS and ship Windows + Android;
//   2. in the SQL editor: retire the old row, insert the new one (one transaction).
// Keep the old public key in TRUSTED_LICENCE_KEYS while its licences are in use.
// The 32-byte values are the ones @noble/curves uses: the seed of the PKCS#8
// key and the raw key of the SPKI one. Never commit the printed private value.
// ============================================

import { generateKeyPairSync, randomUUID } from 'node:crypto'

const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('hex')
const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
const keyId = `k-${new Date().toISOString().slice(0, 10)}-${randomUUID().slice(0, 8)}`

console.log('1) packages/app-shell/src/shared/lib/licence-keys.ts — add to TRUSTED_LICENCE_KEYS:')
console.log(`  { keyId: '${keyId}', publicKey: '${raw}' },`)
console.log('')
console.log('2) SQL editor, AFTER the apps with that entry are released:')
console.log('BEGIN;')
console.log(
  'UPDATE public.offline_license_signing_keys SET retired_at = now() WHERE retired_at IS NULL;',
)
console.log(
  `INSERT INTO public.offline_license_signing_keys (key_id, private_key_hex, public_key_hex) VALUES ('${keyId}', '${seed}', '${raw}');`,
)
console.log('COMMIT;')
