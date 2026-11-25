import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** Battery Status API — what this slice reads. */
interface BatteryInfo extends EventTarget {
  level: number
  charging: boolean
}

/** Optional navigator members (Device Memory, Network Information, Battery Status). */
interface DeviceNavigator {
  deviceMemory?: number
  connection?: { saveData?: boolean }
  getBattery?: () => Promise<BatteryInfo>
}

export type PerformanceMode = 'auto' | 'lite' | 'normal'

interface DeviceState {
  performanceMode: PerformanceMode
  dataSaver: boolean
  reducedMotion: boolean
  lowBattery: boolean
  batteryLevel: number | null
  pinLocked: boolean
  pinHash: string | null

  setPerformanceMode: (mode: PerformanceMode) => void
  setDataSaver: (enabled: boolean) => void
  setReducedMotion: (enabled: boolean) => void
  setBatteryInfo: (level: number, charging: boolean) => void
  configurePin: (pin: string) => void
  lockDevice: () => void
  unlockWithPin: (pin: string) => boolean
  clearPin: () => void
  detectDevice: () => void
}

function hashPin(pin: string): string {
  // Deterministic non-reversible digest for local shared-device lock (never stored as plaintext).
  let h = 2166136261
  for (let i = 0; i < pin.length; i += 1) {
    h ^= pin.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `pin:${(h >>> 0).toString(16)}`
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, _get) => ({
      performanceMode: 'auto',
      dataSaver: false,
      reducedMotion: false,
      lowBattery: false,
      batteryLevel: null,
      pinLocked: false,
      pinHash: null,

      setPerformanceMode: (mode) => set({ performanceMode: mode }),
      setDataSaver: (enabled) => set({ dataSaver: enabled }),
      setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
      setBatteryInfo: (level, charging) =>
        set({
          batteryLevel: level,
          lowBattery: level < 0.2 && !charging,
        }),
      configurePin: (pin) => {
        const trimmed = pin.trim()
        if (trimmed.length < 4) return
        set({ pinHash: hashPin(trimmed), pinLocked: false })
      },
      lockDevice: () => set((s) => (s.pinHash ? { pinLocked: true } : s)),
      unlockWithPin: (pin) => {
        let unlocked = false
        set((s) => {
          if (!s.pinHash || s.pinHash === hashPin(pin.trim())) {
            unlocked = true
            return { pinLocked: false }
          }
          return s
        })
        return unlocked
      },
      clearPin: () => set({ pinHash: null, pinLocked: false }),

      detectDevice: () => {
        if (typeof navigator === 'undefined') return

        // Not in every browser's DOM typings: read through a declared optional shape.
        const nav = navigator as Navigator & DeviceNavigator
        const memory = nav.deviceMemory
        const cores = navigator.hardwareConcurrency || 4
        const connection = nav.connection

        if (memory && memory < 4) {
          set({ performanceMode: 'lite', reducedMotion: true })
        }
        if (cores < 4) {
          set({ performanceMode: 'lite' })
        }
        if (connection?.saveData) {
          set({ dataSaver: true })
        }

        if ('getBattery' in navigator) {
          void nav.getBattery?.().then((battery: BatteryInfo) => {
            set({
              batteryLevel: battery.level,
              lowBattery: battery.level < 0.2 && !battery.charging,
            })
            battery.addEventListener('levelchange', () => {
              set({
                batteryLevel: battery.level,
                lowBattery: battery.level < 0.2 && !battery.charging,
              })
            })
          })
        }
      },
    }),
    {
      name: 'hisabche-device',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined')
          return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
    },
  ),
)
