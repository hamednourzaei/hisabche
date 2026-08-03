// ============================================
// Biometric unlock — guards an already-persisted session.
// It never replaces the password: the session must exist first,
// biometrics only re-authorises the local device.
// ============================================

import { useCallback, useEffect, useState } from 'react'
import * as LocalAuthentication from 'expo-local-authentication'

export interface Biometrics {
  isAvailable: boolean
  authenticate: (promptMessage: string) => Promise<boolean>
}

export function useBiometrics(): Biometrics {
  const [isAvailable, setIsAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check(): Promise<void> {
      const hasHardware = await LocalAuthentication.hasHardwareAsync()
      const enrolled = await LocalAuthentication.isEnrolledAsync()
      if (!cancelled) setIsAvailable(hasHardware && enrolled)
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [])

  const authenticate = useCallback(async (promptMessage: string): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    })
    return result.success
  }, [])

  return { isAvailable, authenticate }
}
