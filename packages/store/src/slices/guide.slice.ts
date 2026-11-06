// ============================================
// packages/store/src/slices/guide.slice.ts
// Interactive In-App Product Guide — Progress Store
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const GUIDE_VERSION = '1.0.0'

export interface GuideStepState {
  stepId: string
  routeId: string
  seen: boolean
  completedAt: string
}

export interface GuideStoreState {
  version: string
  /** Set of completed step IDs (stored as record for JSON serialization) */
  completedSteps: Record<string, GuideStepState>
  /** Current active step ID on the current page if visible */
  activeStepId: string | null
  /** Dismissed for this session */
  dismissedForSession: boolean

  markStepSeen: (stepId: string, routeId: string) => void
  isStepSeen: (stepId: string) => boolean
  setActiveStep: (stepId: string | null) => void
  dismissSession: () => void
  mergeRemoteProgress: (remoteSteps: Record<string, GuideStepState>) => void
  /** Forget one page's steps, so its guide can be read again. Other pages keep theirs. */
  resetRouteProgress: (routeId: string) => void
  resetProgress: () => void
}

export const useGuideStore = create<GuideStoreState>()(
  persist(
    (set, get) => ({
      version: GUIDE_VERSION,
      completedSteps: {},
      activeStepId: null,
      dismissedForSession: false,

      markStepSeen: (stepId: string, routeId: string) => {
        const current = get().completedSteps
        if (current[stepId]?.seen) return

        const now = new Date().toISOString()
        set({
          completedSteps: {
            ...current,
            [stepId]: {
              stepId,
              routeId,
              seen: true,
              completedAt: now,
            },
          },
        })
      },

      isStepSeen: (stepId: string) => {
        return !!get().completedSteps[stepId]?.seen
      },

      setActiveStep: (activeStepId: string | null) => {
        set({ activeStepId })
      },

      dismissSession: () => {
        set({ dismissedForSession: true, activeStepId: null })
      },

      // ⚠️ Set union merge: an offline or cross-device progress merge NEVER drops previously seen steps
      mergeRemoteProgress: (remoteSteps: Record<string, GuideStepState>) => {
        const local = get().completedSteps
        const merged: Record<string, GuideStepState> = { ...local }

        for (const [key, remoteVal] of Object.entries(remoteSteps || {})) {
          if (!merged[key] || (remoteVal.seen && !merged[key]!.seen)) {
            merged[key] = remoteVal
          }
        }
        set({ completedSteps: merged })
      },

      resetRouteProgress: (routeId: string) => {
        const remaining = Object.fromEntries(
          Object.entries(get().completedSteps).filter(([, value]) => value.routeId !== routeId),
        )
        set({ completedSteps: remaining })
      },

      resetProgress: () => {
        set({ completedSteps: {}, activeStepId: null, dismissedForSession: false })
      },
    }),
    {
      name: 'hisabche-guide-progress',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          return localStorage
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      }),
      // ⚠️ ONLY THE PROGRESS IS PERSISTED. `dismissedForSession` says «not now»
      // for THIS visit; storing it would hide the guide for good after the first
      // close, and the next login would never be taught anything.
      partialize: (state) => ({
        version: state.version,
        completedSteps: state.completedSteps,
      }),
      // Read the same two fields back, and ignore anything else an older
      // stored copy may carry (such as a forgotten `dismissedForSession: true`).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as {
          version?: string
          completedSteps?: Record<string, GuideStepState>
        }
        return {
          ...current,
          version: saved.version ?? current.version,
          completedSteps: saved.completedSteps ?? {},
        }
      },
    },
  ),
)
