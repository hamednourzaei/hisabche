// ============================================
// Date range — the mobile rendering of the web dashboard's range picker.
//
// Web opens a popover listing every preset under group headings. A phone shows
// the same presets in a native action sheet: the control differs because a
// popover has nowhere to anchor on a phone, but the presets and the dates they
// resolve to are the shared ones (`COMPACT_PRESETS`, `presetRange`), so
// "۷ روز اخیر" covers the same seven days it covers in the browser.
// ============================================

import React, { memo, useCallback, useMemo, useState } from 'react'
import { Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COMPACT_PRESETS, presetRange, type DateRange, type PresetKey } from '@hisabche/ui-contract'
import { ActionSheet, Text, useTheme, type ActionSheetItem } from '@hisabche/mobile-ui'

import { useCommonT } from '../../../shared/i18n/use-common-t'

export interface DateRangeControlProps {
  value: PresetKey
  onChange: (preset: PresetKey, range: DateRange) => void
}

export const DateRangeControl = memo(function DateRangeControl({
  value,
  onChange,
}: DateRangeControlProps) {
  const t = useCommonT()
  const { colors, spacing, radius } = useTheme()
  const [open, setOpen] = useState(false)

  const select = useCallback(
    (preset: PresetKey) => {
      onChange(preset, presetRange(preset))
      setOpen(false)
    },
    [onChange],
  )

  const items = useMemo<ActionSheetItem[]>(
    () =>
      COMPACT_PRESETS.map((preset) => ({
        key: preset.key,
        label: t(preset.labelKey),
        onPress: () => select(preset.key),
      })),
    [select, t],
  )

  const activeLabel =
    COMPACT_PRESETS.find((preset) => preset.key === value)?.labelKey ?? 'dateRange.7days'

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('dashboard.dateRange', 'بازه زمانی')}
        testID="dashboard-date-range"
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          // Same 16px step web's filter control measures at.
          borderRadius: radius.lg,
          backgroundColor: colors.surfaceMuted,
        }}
      >
        <Ionicons name="calendar-outline" size={16} color={colors.fgSecondary} />
        <Text variant="label" tone="secondary">
          {t(activeLabel)}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.fgTertiary} />
      </Pressable>

      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={t('dashboard.dateRange', 'بازه زمانی')}
        items={items}
      />
    </>
  )
})
