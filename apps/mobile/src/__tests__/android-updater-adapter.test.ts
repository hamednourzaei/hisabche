import {
  computeNativeRuntimeFingerprint,
  evaluateAndroidOtaEligibility,
  HISABCHE_ANDROID_NATIVE_SPEC,
} from '../host/updater-adapter'

describe('Slice S5 — Android native fingerprint & OTA compatibility gate', () => {
  it('allows self-hosted shell OTA only when runtimeVersion and native fingerprint match', () => {
    const fp = computeNativeRuntimeFingerprint(HISABCHE_ANDROID_NATIVE_SPEC)
    const ok = evaluateAndroidOtaEligibility({
      installedSpec: HISABCHE_ANDROID_NATIVE_SPEC,
      targetRuntimeVersion: HISABCHE_ANDROID_NATIVE_SPEC.runtimeVersion,
      targetNativeFingerprint: fp,
    })
    expect(ok).toEqual({
      eligible: true,
      mode: 'SELF_HOSTED_SHELL_OTA',
      fingerprint: fp,
    })
  })

  it('refuses OTA and routes to binary distribution when a native module or permission changes (#19, #20)', () => {
    const modifiedFp = computeNativeRuntimeFingerprint({
      ...HISABCHE_ANDROID_NATIVE_SPEC,
      permissions: [...HISABCHE_ANDROID_NATIVE_SPEC.permissions, 'REQUEST_INSTALL_PACKAGES'],
    })
    const mismatch = evaluateAndroidOtaEligibility({
      installedSpec: HISABCHE_ANDROID_NATIVE_SPEC,
      targetRuntimeVersion: HISABCHE_ANDROID_NATIVE_SPEC.runtimeVersion,
      targetNativeFingerprint: modifiedFp,
    })
    expect(mismatch).toEqual({
      eligible: false,
      reason: 'NATIVE_FINGERPRINT_MISMATCH',
      action: 'ROUTE_TO_BINARY_DISTRIBUTION',
    })

    const rtMismatch = evaluateAndroidOtaEligibility({
      installedSpec: HISABCHE_ANDROID_NATIVE_SPEC,
      targetRuntimeVersion: '52.0.0-rn075-v1',
      targetNativeFingerprint: computeNativeRuntimeFingerprint(HISABCHE_ANDROID_NATIVE_SPEC),
    })
    expect(rtMismatch).toEqual({
      eligible: false,
      reason: 'RUNTIME_VERSION_MISMATCH',
      action: 'ROUTE_TO_BINARY_DISTRIBUTION',
    })
  })
})
