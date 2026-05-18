import React, { memo, useState, useRef, useCallback, useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Platform, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useThemeStore } from '@hisabche/store'

export interface FabAction {
  id: string
  label: string
  emoji: string
  onPress: () => void
}

interface Props {
  actions: FabAction[]
  primaryColor?: string
}

const FabItem = memo(function FabItem({ action, onPress, tk }: { action: FabAction; onPress: () => void; tk: any }) {
  const scale = useRef(new Animated.Value(1)).current
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.95, friction: 4, useNativeDriver: true }).start()
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start()

  return (
    <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1} accessibilityRole="button" accessibilityLabel={action.label}>
      <Animated.View style={[s.menuItem, { backgroundColor: tk.card, borderColor: tk.border }, { transform: [{ scale }] }]}>
        <Text style={s.menuEmoji}>{action.emoji}</Text>
        <Text style={[s.menuLabel, { color: tk.foreground }]}>{action.label}</Text>
      </Animated.View>
    </TouchableOpacity>
  )
})

function FAB({ actions, primaryColor = '#00b97a' }: Props) {
  const { isDark } = useThemeStore()
  const tk = isDark ? { card: '#1e293b', border: '#334155', foreground: '#f1f5f9' } : { card: '#ffffff', border: '#e2e8f0', foreground: '#1e293b' }
  const insets = useSafeAreaInsets()
  const { height: screenHeight } = useWindowDimensions()

  const [open, setOpen] = useState(false)
  const rotate = useRef(new Animated.Value(0)).current
  const menuOpacity = useRef(new Animated.Value(0)).current
  const menuTranslate = useRef(new Animated.Value(20)).current

  const toggle = useCallback(() => {
    const toValue = open ? 0 : 1
    setOpen(!open)

    Animated.parallel([
      Animated.spring(rotate, { toValue, friction: 5, useNativeDriver: true }),
      Animated.timing(menuOpacity, { toValue: open ? 0 : 1, duration: 200, useNativeDriver: true }),
      Animated.spring(menuTranslate, { toValue: open ? 20 : 0, friction: 6, useNativeDriver: true }),
    ]).start()
  }, [open, rotate, menuOpacity, menuTranslate])

  const handleAction = useCallback((onPress: () => void) => {
    onPress()
    setOpen(false)
    rotate.setValue(0)
    menuOpacity.setValue(0)
    menuTranslate.setValue(20)
  }, [rotate, menuOpacity, menuTranslate])

  const bottom = useMemo(() => insets.bottom + 80, [insets.bottom])
  const fabBg = open ? '#ef4444' : primaryColor
  const rotateInterpolate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] })

  return (
    <View style={[s.container, { bottom }]} pointerEvents="box-none">
      <Animated.View style={[s.menuWrap, { opacity: menuOpacity, transform: [{ translateY: menuTranslate }] }]} pointerEvents={open ? 'auto' : 'none'}>
        <View style={s.menu}>
          {actions.map((action) => (
            <FabItem key={action.id} action={action} onPress={() => handleAction(action.onPress)} tk={tk} />
          ))}
        </View>
      </Animated.View>

      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.85}
        style={[s.fab, { backgroundColor: fabBg }]}
        accessibilityRole="button"
        accessibilityLabel={open ? 'بستن منو' : 'باز کردن منو'}
        accessibilityState={{ expanded: open }}
      >
        <Animated.Text style={[s.fabIcon, { transform: [{ rotate: rotateInterpolate }] }]}>
          ＋
        </Animated.Text>
      </TouchableOpacity>
    </View>
  )
}

export default memo(FAB)

const s = StyleSheet.create({
  container: { position: 'absolute', right: 20, zIndex: 100, alignItems: 'flex-end' },
  menuWrap: { marginBottom: 14, alignItems: 'flex-end' },
  menu: { gap: 8, alignItems: 'flex-end' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 4 },
    }),
  },
  menuEmoji: { fontSize: 20 },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  fabIcon: { fontSize: 26, color: '#fff', fontWeight: '300' },
})