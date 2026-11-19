// ============================================
// Reel 112 — actor-side visual events for the flashback film.
//
// The AV sync law (owner, 17 Oct 2026) says a sounded word must name an action
// the actor actually draws. Every action named in reel-112's word plans is
// listed here, read from the sentence plan with cueAt(), and drawn as a small
// spark at exactly that second. The spark is an intentional part of the
// foundry language: each sound leaves a visible mark on the press bed.
// ============================================

import type { Scene } from '../engine/types'
import type { SentencePlan } from '../engine/speech-model'
import { clamp, progress } from '../engine/anim'

/** The local second at which an action fires, straight from the word cue. */
export function cueAt(plan: SentencePlan | undefined, action: string, fallback: number): number {
  const word = plan?.words.find((w) => w.sound && w.action === action)
  return word ? word.start : fallback
}

type FlashEvent = { action: string; x: number; y: number; color: string }

// One small event strip on the right margin — never competing with the stage.
// Keys are the scene starts on the 42s master timeline: 0, 6, 15, 26, 37.
const SCENE_EVENTS: Record<number, readonly FlashEvent[]> = {
  0: [
    { action: 'rewind-start', x: 494, y: 736, color: '#b9a68a' },
    { action: 'paper-flashback', x: 494, y: 758, color: '#b9a68a' },
    { action: 'paper-ledger', x: 494, y: 780, color: '#b9a68a' },
    { action: 'question-stamp', x: 494, y: 802, color: '#f0b45a' },
  ],
  6: [
    { action: 'clock-tick', x: 494, y: 736, color: '#b9a68a' },
    { action: 'handwrite', x: 494, y: 758, color: '#b9a68a' },
    { action: 'page-tear', x: 494, y: 780, color: '#b9a68a' },
  ],
  15: [
    { action: 'copy-one', x: 494, y: 736, color: '#b9a68a' },
    { action: 'copy-four', x: 494, y: 758, color: '#b9a68a' },
    { action: 'doubt-flash', x: 494, y: 780, color: '#f0b45a' },
    { action: 'four-way-split', x: 494, y: 802, color: '#f0b45a' },
  ],
  26: [
    { action: 'invoice-enter', x: 494, y: 714, color: '#22d3ee' },
    { action: 'brand-reveal', x: 494, y: 736, color: '#22d3ee' },
    { action: 'five-count', x: 494, y: 758, color: '#22d3ee' },
    { action: 'five-post', x: 494, y: 780, color: '#4fe0a6' },
    { action: 'past-cut', x: 494, y: 802, color: '#b9a68a' },
    { action: 'no-return-lock', x: 494, y: 824, color: '#4fe0a6' },
  ],
  37: [
    { action: 'cta-brand', x: 494, y: 758, color: '#22d3ee' },
    { action: 'past-dissolve', x: 494, y: 780, color: '#4fe0a6' },
  ],
}

/** Draws one short, smooth spark for every sounded action in this scene. */
export function FlashbackEventSparks({ t, scene }: { t: number; scene: Scene }) {
  const events = SCENE_EVENTS[Math.round(scene.start)] ?? []
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {events.map((event) => {
        const at = cueAt(scene.sentence, event.action, 0.3)
        const p = clamp(progress(t, at, 0.3))
        const glow = Math.sin(Math.PI * p)
        return (
          <div
            key={event.action}
            style={{
              position: 'absolute',
              left: event.x,
              top: event.y,
              width: 7,
              height: 7,
              borderRadius: '50%',
              border: `1px solid ${event.color}`,
              backgroundColor: event.color,
              opacity: glow,
              boxShadow: `0 0 12px ${event.color}`,
            }}
          />
        )
      })}
    </div>
  )
}
