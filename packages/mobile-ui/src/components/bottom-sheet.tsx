// ============================================
// BottomSheet — RN Modal + Animated. No gesture-handler dependency.
// Sheets replace pushed pages for pickers and filters.
// ============================================

import React, { memo, useCallback, useEffect, useRef, type ReactNode } from 'react'
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  View,
} from 'react-native'

import { useTheme } from '../theme/theme-provider'
import { Text } from './text'

export interface BottomSheetProps {
  visible: boolean
  onClose: () => void
  title?: string | undefined
  /** Fraction of screen height, 0–1. */
  height?: number | undefined
  children: ReactNode
}

const SCREEN_HEIGHT = Dimensions.get('window').height

export const BottomSheet = memo(function BottomSheet({
  visible,
  onClose,
  title,
  height = 0.7,
  children,
}: BottomSheetProps) {
  const { colors, radius, spacing, duration, elevation } = useTheme()
  const progress = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? duration.normal : duration.fast,
      useNativeDriver: true,
    }).start()
  }, [duration, progress, visible])

  const sheetHeight = SCREEN_HEIGHT * Math.min(0.95, Math.max(0.3, height))

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetHeight, 0],
  })

  const handleClose = useCallback(() => onClose(), [onClose])

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View style={{ flex: 1, opacity: progress, backgroundColor: colors.scrim }}>
        <Pressable style={{ flex: 1 }} accessibilityLabel={title} onPress={handleClose} />
      </Animated.View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: sheetHeight,
              backgroundColor: colors.surfaceElevated,
              borderTopLeftRadius: radius['2xl'],
              borderTopRightRadius: radius['2xl'],
              transform: [{ translateY }],
            },
            elevation.lg,
          ]}
        >
          <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: colors.borderStrong,
              }}
            />
          </View>

          {title ? (
            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg }}>
              <Text variant="heading">{title}</Text>
            </View>
          ) : null}

          <View style={{ flex: 1 }}>{children}</View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  )
})
