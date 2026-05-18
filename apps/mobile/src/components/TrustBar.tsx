import React, { memo, useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useThemeStore } from '@hisabche/store'

const color = {
  light: { bar: '#ffffff', border: '#e2e8f0', foreground: '#1e293b', mutedFg: '#64748b', success: '#16a34a', warning: '#f59e0b' },
  dark: { bar: '#0c1628', border: '#1e2d45', foreground: '#cbd5e1', mutedFg: '#94a3b8', success: '#4ade80', warning: '#fbbf24' },
}

interface Props {
  isOnline: boolean
  pendingCount: number
  lastSyncedAgo: string
  onPress?: () => void
}

const TrustBar = memo(function TrustBar({ isOnline, pendingCount, lastSyncedAgo, onPress }: Props) {
  const { isDark } = useThemeStore()
  const tk = isDark ? color.dark : color.light
  const pulse = useRef(new Animated.Value(1)).current
  const scale = useRef(new Animated.Value(1)).current

  React.useEffect(() => {
    if (!isOnline || pendingCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start()
    } else {
      pulse.setValue(1)
    }
  }, [isOnline, pendingCount, pulse])

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.98, friction: 5, useNativeDriver: true }).start()
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start()

  const canPress = !!onPress
  const statusColor = isOnline ? tk.success : tk.warning

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={!canPress}
      style={[s.bar, { backgroundColor: tk.bar, borderBottomColor: tk.border }]}
      accessibilityRole={canPress ? 'button' : 'text'}
      accessibilityLabel={`وضعیت: ${isOnline ? 'آنلاین' : 'آفلاین'}، آخرین همگام‌سازی: ${lastSyncedAgo || 'نامشخص'}${pendingCount > 0 ? `، ${pendingCount} عملیات در انتظار` : ''}`}
      accessibilityState={{ busy: !isOnline || pendingCount > 0 }}
    >
      <Animated.View style={{ transform: [{ scale }], flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={s.item}>
          <Animated.View style={[s.dot, { backgroundColor: statusColor, opacity: isOnline && pendingCount === 0 ? 1 : pulse }]} />
          <Text style={[s.text, { color: statusColor, fontSize: 12 }]} numberOfLines={1}>
            {isOnline ? 'آنلاین' : 'آفلاین'}
          </Text>
        </View>
        <Text style={[s.text, { color: tk.mutedFg, fontSize: 12 }]}>·</Text>
        <Text style={[s.text, { color: tk.mutedFg, fontSize: 12 }]} numberOfLines={1}>
          {lastSyncedAgo || 'همگام‌سازی نشده'}
        </Text>
        {pendingCount > 0 && (
          <>
            <Text style={[s.text, { color: tk.mutedFg, fontSize: 12 }]}>·</Text>
            <Text style={[s.text, { color: tk.warning, fontSize: 12 }]} numberOfLines={1}>
              {pendingCount} در انتظار
            </Text>
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  )
})

export default TrustBar

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontWeight: '500' },
})