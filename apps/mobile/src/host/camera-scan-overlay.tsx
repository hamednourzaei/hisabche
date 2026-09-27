// ============================================
// The camera over the WebView while a barcode scan is open (27 Sep 2026).
//
// The first code read answers the scan and closes the camera — a shelf of
// products must not add ten rows because the phone held still for a second.
// Back button and «بستن» answer «cancelled». The texts are Persian because
// this native layer renders before, and outside, the shared UI's translations
// (the same rule as the shell's failure screen).
// ============================================

import React, { useEffect, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native'
import { CameraView } from 'expo-camera'

import { finishScan, isScanning, onScanRequest } from './camera-scan'
import { hostText } from './host-strings'

// The symbologies a shop's goods carry: retail EAN/UPC, warehouse Code 128/39,
// and QR for the shop's own labels.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] as const

export function CameraScanOverlay(): React.JSX.Element | null {
  const [active, setActive] = useState(isScanning)

  useEffect(() => onScanRequest(setActive), [])

  useEffect(() => {
    if (!active) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      finishScan({ status: 'cancelled' })
      return true
    })
    return () => subscription.remove()
  }, [active])

  if (!active) return null

  return (
    <View style={styles.overlay}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={({ data }) => {
          const code = String(data ?? '').trim()
          if (code) finishScan({ status: 'scanned', code })
        }}
      />
      <View style={styles.frame} pointerEvents="none" />
      <Text style={styles.title}>{hostText('scanTitle')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => finishScan({ status: 'cancelled' })}
        style={styles.close}
      >
        <Text style={styles.closeText}>{hostText('close')}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#000', zIndex: 10 },
  frame: {
    position: 'absolute',
    top: '30%',
    left: '12%',
    right: '12%',
    height: '22%',
    borderWidth: 2,
    borderColor: '#E6EDF3',
    borderRadius: 12,
  },
  title: {
    position: 'absolute',
    top: '18%',
    width: '100%',
    textAlign: 'center',
    color: '#E6EDF3',
    fontSize: 16,
    writingDirection: 'rtl',
  },
  close: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(11,15,20,0.8)',
  },
  closeText: { color: '#E6EDF3', fontSize: 16 },
})
