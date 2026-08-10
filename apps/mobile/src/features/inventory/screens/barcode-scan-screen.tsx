// ============================================
// Barcode scanner — resolves a scanned code against the products API
// and jumps straight to the matching product.
// ============================================

import React, { useCallback, useRef, useState } from 'react'
import { View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { productKeys } from '@hisabche/api'
import { Button, EmptyState, Screen, Text, useTheme } from '@hisabche/mobile-ui'

import { apiClient } from '../../../shared/lib/api'

const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] as const

export function BarcodeScanScreen() {
  const { t } = useTranslation('mobile')
  const { spacing, colors } = useTheme()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [permission, requestPermission] = useCameraPermissions()
  const [error, setError] = useState<string | null>(null)
  const handled = useRef(false)

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (handled.current) return
      handled.current = true

      try {
        const response = await apiClient.get<{ products: Array<{ id: string }> }>('/products', {
          params: { barcode: data, limit: 1 },
        })
        const product = response.data.products?.[0]

        if (!product) {
          setError(t('common.empty'))
          handled.current = false
          return
        }

        await queryClient.invalidateQueries({ queryKey: productKeys.lists() })
        router.replace(`/warehouse/${product.id}`)
      } catch {
        setError(t('common.error'))
        handled.current = false
      }
    },
    [queryClient, router, t],
  )

  if (!permission) return <Screen />

  if (!permission.granted) {
    return (
      <Screen>
        <EmptyState
          title={t('inventory.cameraDenied')}
          description={t('inventory.scanPrompt')}
          actionLabel={t('common.retry')}
          onAction={() => void requestPermission()}
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={(result) => void onScanned(result)}
      />

      <View style={{ padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceBase }}>
        <Text variant="body" style={{ textAlign: 'center' }}>
          {t('inventory.scanPrompt')}
        </Text>
        {error ? (
          <Text variant="caption" tone="danger" style={{ textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
        <Button
          label={t('common.cancel')}
          variant="ghost"
          fullWidth
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  )
}
