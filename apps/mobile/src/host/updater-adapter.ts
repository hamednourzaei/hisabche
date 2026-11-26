/**
 * Android Adapter (Slice S5):
 * - Computes deterministic native-dependency + permission fingerprint for Expo SDK 51 / RN 0.74.
 * - Refuses OTA when native runtime compatibility diverges, routing to binary distribution (OD-03).
 * - Never enables RN New Architecture or upgrades Expo/RN.
 */

export interface AndroidNativeRuntimeSpec {
  expoSdk: string
  reactNative: string
  permissions: readonly string[]
  nativeModules: Readonly<Record<string, string>>
  runtimeVersion: string
}

export const HISABCHE_ANDROID_NATIVE_SPEC: AndroidNativeRuntimeSpec = {
  expoSdk: '~51.0.0',
  reactNative: '0.74.2',
  permissions: [
    'CAMERA',
    'INTERNET',
    'USE_BIOMETRIC',
    'USE_FINGERPRINT',
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.USE_BIOMETRIC',
    'android.permission.USE_FINGERPRINT',
  ],
  nativeModules: {
    'expo-camera': '~15.0.16',
    'expo-file-system': '~17.0.1',
    'expo-local-authentication': '~14.0.1',
    'expo-notifications': '~0.28.19',
    'expo-print': '~13.0.1',
    'expo-secure-store': '~13.0.2',
    'expo-sqlite': '~14.0.6',
    'react-native-webview': '13.8.6',
  },
  runtimeVersion: '51.0.0-rn074-v1',
}

export function computeNativeRuntimeFingerprint(spec: AndroidNativeRuntimeSpec): string {
  const normalized = {
    expoSdk: spec.expoSdk,
    reactNative: spec.reactNative,
    runtimeVersion: spec.runtimeVersion,
    permissions: [...spec.permissions].sort(),
    nativeModules: Object.keys(spec.nativeModules)
      .sort()
      .map((k) => `${k}@${spec.nativeModules[k]}`),
  }
  const str = JSON.stringify(normalized)
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `android-fp-${(h >>> 0).toString(16).padStart(8, '0')}`
}

export type AndroidOtaEligibility =
  | { eligible: true; mode: 'SELF_HOSTED_SHELL_OTA'; fingerprint: string }
  | {
      eligible: false
      reason: 'NATIVE_FINGERPRINT_MISMATCH' | 'RUNTIME_VERSION_MISMATCH'
      action: 'ROUTE_TO_BINARY_DISTRIBUTION'
    }

export function evaluateAndroidOtaEligibility(input: {
  installedSpec: AndroidNativeRuntimeSpec
  targetRuntimeVersion: string
  targetNativeFingerprint: string
}): AndroidOtaEligibility {
  if (input.targetRuntimeVersion !== input.installedSpec.runtimeVersion) {
    return {
      eligible: false,
      reason: 'RUNTIME_VERSION_MISMATCH',
      action: 'ROUTE_TO_BINARY_DISTRIBUTION',
    }
  }
  const installedFp = computeNativeRuntimeFingerprint(input.installedSpec)
  if (input.targetNativeFingerprint !== installedFp) {
    return {
      eligible: false,
      reason: 'NATIVE_FINGERPRINT_MISMATCH',
      action: 'ROUTE_TO_BINARY_DISTRIBUTION',
    }
  }
  return {
    eligible: true,
    mode: 'SELF_HOSTED_SHELL_OTA',
    fingerprint: installedFp,
  }
}
