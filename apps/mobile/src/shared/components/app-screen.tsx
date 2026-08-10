import React, { type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Screen } from '@hisabche/mobile-ui'

import { AdaptiveContent } from './adaptive-content'

/**
 * Screen with the status-bar inset applied. Tab bar handles the bottom inset.
 *
 * Every screen goes through here, which is why the tablet measure is applied at
 * this level: one change adapts the whole app rather than each screen growing
 * its own width logic and drifting. On a phone `AdaptiveContent` is a
 * pass-through, so phone layout is byte-for-byte what it was.
 */
export function AppScreen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()

  return (
    <Screen style={{ paddingTop: insets.top }}>
      <AdaptiveContent>{children}</AdaptiveContent>
    </Screen>
  )
}
