// ============================================
// Jest setup — native modules that have no JS implementation in tests.
// ============================================

jest.mock('expo-secure-store', () => {
  const store = new Map()
  return {
    getItemAsync: jest.fn(async (key) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => void store.set(key, value)),
    deleteItemAsync: jest.fn(async (key) => void store.delete(key)),
  }
})

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
)

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'fa-IR', languageCode: 'fa' }],
}))

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => undefined),
}))

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
}))

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [{ granted: true }, jest.fn()],
}))
