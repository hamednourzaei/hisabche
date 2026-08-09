// ============================================
// Nested components of an invoice line, mobile edition.
//
// Not a squeezed desktop table: each component is a stacked row with full-width
// touch targets, and the whole block is collapsed until the user asks for it.
// Colours come from the theme tokens only — no hardcoded values.
// ============================================

import React, { memo, useState } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Text, useTheme } from '@hisabche/mobile-ui'

import { detailsSum, type DraftDetail, type DraftItem } from '../hooks/use-invoice-draft'
import { formatAmount } from '../../../shared/lib/format'

export interface LineItemDetailEditorProps {
  item: DraftItem
  onChange: (key: string, patch: Partial<DraftItem>) => void
}

/** Minimum comfortable touch target on both platforms. */
const TOUCH = 44

export const LineItemDetailEditor = memo(function LineItemDetailEditor({
  item,
  onChange,
}: LineItemDetailEditorProps) {
  const { t } = useTranslation('mobile')
  const { colors, spacing, radius } = useTheme()
  const details = item.details ?? []
  const [expanded, setExpanded] = useState(details.length > 0)

  const patch = (next: DraftDetail[]) => onChange(item.key, { details: next })

  const addDetail = () =>
    patch([...details, { key: `${item.key}-d${Date.now()}`, title: '', quantity: 1, amount: 0 }])

  const toggle = () => {
    if (!expanded && details.length === 0) addDetail()
    setExpanded((prev) => !prev)
  }

  const inputStyle = {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.borderDefault,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.fgPrimary,
    paddingHorizontal: spacing.sm,
    minHeight: TOUCH,
  }

  return (
    <View style={{ marginTop: spacing.sm }}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${t('sales.details', 'جزئیات')}: ${item.productName}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          minHeight: TOUCH,
        }}
      >
        <Ionicons
          name={expanded ? 'chevron-down' : 'add-circle-outline'}
          size={18}
          color={colors.primary}
        />
        <Text variant="caption" tone="brand">
          {expanded
            ? t('sales.hideDetails', 'بستن جزئیات')
            : t('sales.addDetails', 'افزودن جزئیات')}
        </Text>
        {details.length > 0 && (
          <Text variant="caption" tone="tertiary">
            ({details.length})
          </Text>
        )}
      </Pressable>

      {expanded && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.borderDefault,
            paddingTop: spacing.sm,
            gap: spacing.sm,
          }}
        >
          {details.map((detail, index) => (
            <View key={detail.key} style={{ gap: spacing.xs }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <TextInput
                  value={detail.title}
                  onChangeText={(title) =>
                    patch(details.map((d, i) => (i === index ? { ...d, title } : d)))
                  }
                  placeholder={t('sales.detailTitle', 'عنوان')}
                  placeholderTextColor={colors.fgTertiary}
                  accessibilityLabel={t('sales.detailTitle', 'عنوان')}
                  style={[inputStyle, { flex: 1 }]}
                />
                <Pressable
                  onPress={() => patch(details.filter((_, i) => i !== index))}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('sales.removeDetail', 'حذف جزئیات')}: ${detail.title}`}
                  style={{
                    width: TOUCH,
                    height: TOUCH,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                </Pressable>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <TextInput
                  value={String(detail.quantity)}
                  onChangeText={(raw) =>
                    patch(
                      details.map((d, i) =>
                        i === index ? { ...d, quantity: Math.max(0, Number(raw) || 0) } : d,
                      ),
                    )
                  }
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('sales.quantity', 'تعداد')}
                  style={[inputStyle, { width: 88, textAlign: 'center' }]}
                />
                <TextInput
                  value={String(detail.amount)}
                  onChangeText={(raw) =>
                    patch(
                      details.map((d, i) =>
                        i === index ? { ...d, amount: Math.max(0, Number(raw) || 0) } : d,
                      ),
                    )
                  }
                  keyboardType="decimal-pad"
                  accessibilityLabel={t('sales.amount', 'مبلغ')}
                  placeholder={t('sales.amount', 'مبلغ')}
                  placeholderTextColor={colors.fgTertiary}
                  style={[inputStyle, { flex: 1, textAlign: 'right' }]}
                />
              </View>
            </View>
          ))}

          {/* No cap — as many components as the item actually has. */}
          <Pressable
            onPress={addDetail}
            accessibilityRole="button"
            accessibilityLabel={t('sales.addDetail', 'افزودن جزئیات')}
            style={{
              minHeight: TOUCH,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.sm,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.borderDefault,
            }}
          >
            <Text variant="caption" tone="brand">
              + {t('sales.addDetail', 'افزودن جزئیات')}
            </Text>
          </Pressable>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" tone="tertiary">
              {t('sales.componentsSum', 'جمع اجزا')}
            </Text>
            <Text variant="caption" tone="secondary">
              {formatAmount(detailsSum(details))}
            </Text>
          </View>
        </View>
      )}
    </View>
  )
})
LineItemDetailEditor.displayName = 'LineItemDetailEditor'
