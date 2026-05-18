import React, { useEffect, useRef, useCallback } from 'react'
import { View, Text, StyleSheet, Animated, Platform } from 'react-native'
import { useThemeStore } from '@hisabche/store'

const color = {
  light: { card: '#ffffff', foreground: '#1e293b', overlay: 'rgba(0,0,0,0.3)' },
  dark: { card: '#1e293b', foreground: '#f1f5f9', overlay: 'rgba(0,0,0,0.6)' },
}

interface Props {
  show: boolean
  message: string
  emoji?: string
  onComplete?: () => void
}

export default function Celebration({ show, message, emoji = '🎉', onComplete }: Props) {
  const { isDark } = useThemeStore()
  const tk = isDark ? color.dark : color.light

  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(0.85)).current
  const translateY = useRef(new Animated.Value(24)).current
  const animating = useRef(false)

  const runAnimation = useCallback(() => {
    if (animating.current) return
    animating.current = true

    opacity.setValue(0)
    scale.setValue(0.85)
    translateY.setValue(24)

    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start()

    const dismiss = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
    ])

    const timer = setTimeout(() => {
      dismiss.start(() => {
        animating.current = false
        onComplete?.()
      })
    }, 2000)

    return () => {
      clearTimeout(timer)
      dismiss.stop()
      animating.current = false
    }
  }, [opacity, scale, translateY, onComplete])

  useEffect(() => {
    if (show) {
      const cleanup = runAnimation()
      return cleanup
    }
  }, [show, runAnimation])

  if (!show) return null

  return (
    <Animated.View
      style={[s.overlay, { backgroundColor: tk.overlay, opacity }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Animated.View
        style={[
          s.card,
          {
            backgroundColor: tk.card,
            transform: [{ scale }, { translateY }],
          },
        ]}
      >
        <Text style={s.emoji}>{emoji}</Text>
        <Text style={[s.message, { color: tk.foreground }]}>{message}</Text>
      </Animated.View>
    </Animated.View>
  )
}

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 36,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 12,
      },
    }),
  },
  emoji: { fontSize: 56 },
  message: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
})