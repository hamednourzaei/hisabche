import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

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
    (set, get) => ({
      performanceMode: 'auto',
      dataSaver: false,
      reducedMotion: false,
      lowBattery: false,
      batteryLevel: null,

      setPerformanceMode: (mode) => set({ performanceMode: mode }),
      setDataSaver: (enabled) => set({ dataSaver: enabled }),
      setReducedMotion: (enabled) => set({ reducedMotion: enabled }),
      setBatteryInfo: (level, charging) => set({
        batteryLevel: level,
        lowBattery: level < 0.2 && !charging,
      }),

      detectDevice: () => {
        if (typeof navigator === 'undefined') return

        const memory = (navigator as any).deviceMemory
        const cores = navigator.hardwareConcurrency || 4
        const connection = (navigator as any).connection

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
          (navigator as any).getBattery().then((battery: any) => {
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
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') return localStorage
        return { getItem: () => null, setItem: () => {}, removeItem: () => {} }
      }),
    },
  ),
)