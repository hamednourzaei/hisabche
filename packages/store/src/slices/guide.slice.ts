// ============================================
// packages/store/src/slices/guide.slice.ts
// Interactive In-App Product Guide — Progress Store
//
// ⚠️ THE SERVER IS THE RECORD; THIS IS THE DEVICE COPY (8 Nov 2026).
// A guide read once must never come back — not after a hard refresh, not on
// another browser or device. The person's seen steps live on the server
// (`/api/me/guide-progress`); this store mirrors them so the page can decide
// at once, and is the only record offline.
//
// ⚠️ ONE PERSON PER COPY. localStorage is shared by everyone who signs in on
// this browser; without `ownerId` the second person inherited the first
// person's «already seen» and was never taught anything.
//
// Replaying a page's guide («راهنما») is a session view, not forgetting:
// nothing seen is ever removed from the record.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const GUIDE_VERSION = '2.0.0'

export interface GuideStepState {
  stepId: string
  routeId: string
  seen: boolean
  completedAt: string
}

export interface GuideStoreState {
  version: string
  /** Whose progress this copy is. `null` until a person is bound. */
  ownerId: string | null
  /** Set of completed step IDs (stored as record for JSON serialization) */
  completedSteps: Record<string, GuideStepState>
  /** Current active step ID on the current page if visible */
  activeStepId: string | null
  /** The page whose guide is being read again in this visit (not persisted). */
  replayRoute: string | null
  /** Steps of `replayRoute` already stepped through in this replay. */
  replaySeen: string[]

  /** Bind the copy to a person; another person starts with an empty copy. */
  bindOwner: (ownerId: string) => void
  markStepSeen: (stepId: string, routeId: string) => void
  markStepsSeen: (steps: readonly { stepId: string; routeId: string }[]) => void
  isStepSeen: (stepId: string) => boolean
  setActiveStep: (stepId: string | null) => void
  mergeRemoteProgress: (remoteSteps: Record<string, GuideStepState>) => void
  /** Read one page's guide again, from its first step, without forgetting anything. */
  startReplay: (routeId: string) => void
  advanceReplay: (stepId: string) => void
  endReplay: () => void
  resetProgress: () => void
}

const seenEntry = (stepId: string, routeId: string, at: string): GuideStepState => ({
  stepId,
  routeId,
  seen: true,
  completedAt: at,
})

export const useGuideStore = create<GuideStoreState>()(
  persist(
    (set, get) => ({
      version: GUIDE_VERSION,
      ownerId: null,
      completedSteps: {},
      activeStepId: null,
      replayRoute: null,
      replaySeen: [],

      bindOwner: (ownerId: string) => {
        const current = get().ownerId
        if (current === ownerId) return
        // A copy without an owner (written before 2.0.0) cannot be attributed
        // to anyone, so it is not inherited either.
        set({ ownerId, completedSteps: {}, activeStepId: null, replayRoute: null, replaySeen: [] })
      },

      markStepSeen: (stepId: string, routeId: string) => {
        get().markStepsSeen([{ stepId, routeId }])
      },

      markStepsSeen: (steps) => {
        const current = get().completedSteps
        const fresh = steps.filter((step) => !current[step.stepId]?.seen)
        if (fresh.length === 0) return
        const now = new Date().toISOString()
        const next = { ...current }
        for (const step of fresh) next[step.stepId] = seenEntry(step.stepId, step.routeId, now)
        set({ completedSteps: next })
      },

      isStepSeen: (stepId: string) => {
        return !!get().completedSteps[stepId]?.seen
      },

      setActiveStep: (activeStepId: string | null) => {
        set({ activeStepId })
      },

      // ⚠️ Set union merge: an offline or cross-device progress merge NEVER drops previously seen steps
      mergeRemoteProgress: (remoteSteps: Record<string, GuideStepState>) => {
        const local = get().completedSteps
        const merged: Record<string, GuideStepState> = { ...local }
        let changed = false

        for (const [key, remoteVal] of Object.entries(remoteSteps || {})) {
          if (!merged[key] || (remoteVal.seen && !merged[key]!.seen)) {
            merged[key] = remoteVal
            changed = true
          }
        }
        // Nothing new: no new object, so nothing re-renders.
        if (changed) set({ completedSteps: merged })
      },

      startReplay: (routeId: string) => {
        set({ replayRoute: routeId, replaySeen: [] })
      },

      advanceReplay: (stepId: string) => {
        const seen = get().replaySeen
        if (seen.includes(stepId)) return
        set({ replaySeen: [...seen, stepId] })
      },

      endReplay: () => {
        set({ replayRoute: null, replaySeen: [] })
      },

      resetProgress: () => {
        set({ completedSteps: {}, activeStepId: null, replayRoute: null, replaySeen: [] })
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
      // ⚠️ ONLY THE PROGRESS AND ITS OWNER ARE PERSISTED. A replay is a view
      // of this visit; storing it would reopen a guide on the next launch.
      partialize: (state) => ({
        version: state.version,
        ownerId: state.ownerId,
        completedSteps: state.completedSteps,
      }),
      // Read the same fields back and ignore anything else an older stored
      // copy may carry (such as a forgotten `dismissedForSession: true`).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as {
          version?: string
          ownerId?: string | null
          completedSteps?: Record<string, GuideStepState>
        }
        return {
          ...current,
          version: GUIDE_VERSION,
          ownerId: saved.ownerId ?? null,
          completedSteps: saved.completedSteps ?? {},
        }
      },
    },
  ),
)
