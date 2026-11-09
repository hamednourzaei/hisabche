// ============================================
// The licence signing keys this app trusts — in the code, not learned.
//
// ⚠️ A KEY THE DEVICE LEARNS IS A KEY THE DEVICE'S OWNER CAN REPLACE (audit
// F-01, 8 Nov 2026). The app used to fetch the public key once and keep it in
// the device's store; whoever controls that store (or the first fetch) could
// put their own key there and sign their own licence. A public key is not a
// secret, so it lives here, shipped with the build.
//
// Rotation (scripts/generate-offline-licence-keys.mjs): add the new key here,
// ship the apps, THEN make it the active row of offline_license_signing_keys —
// the private key lives only in the database (owner decision, 9 Nov 2026).
// Never remove a key while licences signed with it are still in use.
// ============================================

export type TrustedLicenceKey = { readonly keyId: string; readonly publicKey: string }

export const TRUSTED_LICENCE_KEYS: readonly TrustedLicenceKey[] = [
  // Read from GET https://api.hisabche.com/api/public/offline/licence-key on 8 Nov 2026.
  {
    keyId: 'k-2026-10-22-d3445e54',
    publicKey: 'b58f41e0a08a0443197091fa8c45f256002c98ac57427b3163970ec364ef3209',
  },
]

/**
 * The trusted key for a licence's `key_id`. A build key (VITE_OFFLINE_LICENSE_PUBLIC_KEY)
 * is trusted too — it is also part of the build. Unknown key id ⇒ null ⇒ refused.
 */
export function trustedLicenceKey(
  keyId: string | undefined,
  buildKey: string | undefined,
): string | null {
  const built = buildKey?.trim()
  if (built && /^[0-9a-f]{64}$/i.test(built)) return built.toLowerCase()
  if (!keyId) return null
  return TRUSTED_LICENCE_KEYS.find((k) => k.keyId === keyId)?.publicKey ?? null
}
