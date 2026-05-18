import React, { useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useThemeStore } from '@hisabche/store'

const color = {
  light: { foreground: '#1e293b', mutedFg: '#64748b', primary: '#00b97a', primaryFg: '#ffffff' },
  dark: { foreground: '#cbd5e1', mutedFg: '#94a3b8', primary: '#2dd4a0', primaryFg: '#060d1f' },
}

interface Props {
  emoji: string
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({ emoji, title, description, actionLabel, onAction }: Props) {
  const { isDark } = useThemeStore()
  const tk = isDark ? color.dark : color.light
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, friction: 4, useNativeDriver: true }).start()
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()

  return (
    <View style={s.container} accessibilityRole="text" accessibilityLabel={`${title}${description ? '. ' + description : ''}`}>
      <Text style={s.emoji}>{emoji}</Text>
      <Text style={[s.title, { color: tk.foreground }]}>{title}</Text>
      {description ? (
        <Text style={[s.desc, { color: tk.mutedFg }]}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          style={[s.btn, { backgroundColor: tk.primary }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <Text style={[s.btnText, { color: tk.primaryFg }]}>{actionLabel}</Text>
          </Animated.View>
        </TouchableOpacity>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, maxWidth: 420, alignSelf: 'center', width: '100%' },
  emoji: { fontSize: 56, marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  desc: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20, lineHeight: 22 },
  btn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, marginTop: 8 },
  btnText: { fontSize: 15, fontWeight: '600' },
})