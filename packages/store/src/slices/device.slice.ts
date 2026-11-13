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

  setPerformanceMode: (mode: PerformanceMode) => void
  setDataSaver: (enabled: boolean) => void
  setReducedMotion: (enabled: boolean) => void
  setBatteryInfo: (level: number, charging: boolean) => void
  detectDevice: () => void
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, _get) => ({
      performanceMode: 'auto',
      dataSaver: false,
      reducedMotion: false,
      lowBattery: false,
      batteryLevel: null,

      setPerformanceMode: (mode) => set({ performanceMode: mode }),
      setDataSaver: (enabled) => set({ dataSaver: enabled }),
      setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
      setBatteryInfo: (level, charging) =>
        set({
          batteryLevel: level,
          lowBattery: level < 0.2 && !charging,
        }),

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
