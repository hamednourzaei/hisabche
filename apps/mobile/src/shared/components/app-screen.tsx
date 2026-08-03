import React, { type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@hisabche/mobile-ui'

/** Screen with the status-bar inset applied. Tab bar handles the bottom inset. */
export function AppScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()

  return <Screen style={{ paddingTop: insets.top }}>{children}</Screen>
}
