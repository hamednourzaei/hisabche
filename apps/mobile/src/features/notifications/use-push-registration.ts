// ============================================
// Push registration — obtains an Expo push token and hands it to the
// existing notifications API. No-op on simulators.
// ============================================

import { useEffect } from 'react'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

import { apiClient } from '../../shared/lib/api'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
})

async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync()
  if (existing.granted) return true

  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

async function registerToken(): Promise<void> {
  if (!Device.isDevice) return
  if (!(await ensurePermission())) return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  )

  await apiClient.post('/notifications/devices', { token, platform: Platform.OS })
}

/** Registers this device for push once the user is authenticated. */
export function usePushRegistration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    void registerToken().catch(() => undefined)
  }, [enabled])
}
