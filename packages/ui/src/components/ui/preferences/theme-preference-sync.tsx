// ============================================
// The theme follows the PERSON, not the device (QA-THEME-001, 9 Nov 2026).
//
// Dark / light was kept only in this browser's storage: a new device, or a
// sign-out that cleared storage, came back in the default. The choice now
// lives in the database (user-state-01, `user_preferences.theme`):
//
//   • when the server's answer arrives, it is applied once — the server is
//     the truth for a person who chose before on another device;
//   • every later change on this device is written back.
//
// The device copy still paints the first frame (no flash) and answers
// offline. Renders nothing; mounted once in each shell.
// ============================================
'use client'

import { useEffect, useRef } from 'react'
import { useSaveUserPreferences, useUserPreferences } from '@hisabche/api'
import { useThemeStore } from '@hisabche/store'

export function ThemePreferenceSync(): null {
  const { data } = useUserPreferences()
  const { mutate: save } = useSaveUserPreferences()
  const setMode = useThemeStore((state) => state.setMode)
  const applied = useRef(false)

  // The server's choice, once per load.
  useEffect(() => {
    if (!data?.configured || applied.current) return
    applied.current = true
    if (data.theme && data.theme !== useThemeStore.getState().mode) setMode(data.theme)
  }, [data, setMode])

  // Every change after that goes back to the server.
  useEffect(() => {
    if (!data?.configured) return undefined
    return useThemeStore.subscribe((state, previous) => {
      if (applied.current && state.mode !== previous.mode) save(state.mode)
    })
  }, [data?.configured, save])

  return null
}
