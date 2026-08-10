// ============================================
// Adaptive content column.
//
// A phone screen is edge-to-edge. On a tablet the same screen at 1024pt would
// stretch every card and every form line to the full width, which is the exact
// failure mode "tablet support" usually means: the phone UI, wider. Web solves
// this with a sidebar plus page gutters; a tablet has no sidebar, so the
// content is centred inside a readable measure instead.
//
// Widths come from `useLayout`, which reads the web app's own breakpoints, so a
// tablet in landscape makes the same two-column decision the browser makes at
// the same pixel width.
// ============================================

import React, { type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'
import { useLayout } from '@hisabche/mobile-ui'

export interface AdaptiveContentProps {
  children: ReactNode
  /** Set for scroll containers, where the cap belongs on the content, not the viewport. */
  style?: ViewStyle | undefined
}

/**
 * Centres content and caps its width once the screen is wider than a phone.
 * On a phone this renders a plain full-width `View`, so nothing changes.
 */
export function AdaptiveContent({ children, style }: AdaptiveContentProps) {
  const { contentMaxWidth, gutter, isPhone } = useLayout()

  if (isPhone) return <View style={[{ flex: 1 }, style]}>{children}</View>

  return (
    <View style={[{ flex: 1, alignItems: 'center' }, style]}>
      <View
        style={{ flex: 1, width: '100%', maxWidth: contentMaxWidth, paddingHorizontal: gutter }}
      >
        {children}
      </View>
    </View>
  )
}
