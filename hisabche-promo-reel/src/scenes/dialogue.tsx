import { ease, progress } from '../engine/anim'
import type { SceneSpec } from '../engine/types'
import { Avatar, avatarLabelStyle } from '../ui/avatars'

type DialogueSpec = Extract<SceneSpec, { kind: 'dialogue' }>

const MIN_TURN = 1.1
const PER_CHAR = 0.072

/**
 * Turns are timed by how much they have to say, not by an equal split: a
 * three-word question must not hold the frame as long as a full answer.
 * Deterministic — same spec always yields the same clock.
 */
export function dialogueTurnStarts(turns: DialogueSpec['turns'], dur: number): number[] {
  if (turns.length === 0) return []
  const weights = turns.map((turn) => MIN_TURN + turn.text.length * PER_CHAR)
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let at = 0
  return weights.map((w) => {
    const start = at
    at += (w / totalWeight) * dur
    return start
  })
}

export function DialogueScene({ spec, t, dur }: { spec: DialogueSpec; t: number; dur: number }) {
  const turns = spec.turns ?? []
  const starts = dialogueTurnStarts(turns, dur)
  const activeIndex = turns.reduce(
    (found, _turn, i) => (t >= (starts[i] ?? Infinity) ? i : found),
    -1,
  )

  const side = (role: 'customer' | 'owner') => {
    const active = turns[activeIndex]?.speaker === role
    const spoke = turns.some((turn, i) => turn.speaker === role && i <= activeIndex)
    const appear = ease(progress(t, 0.05 + (role === 'owner' ? 0.12 : 0), 0.5))
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          flex: 1,
          opacity: (spoke || active ? 1 : 0.55) * appear,
          transform: `translateY(${(1 - appear) * 14}px) scale(${active ? 1.05 : 0.96})`,
          transition: 'none',
        }}
      >
        <Avatar role={role} size={122} t={t} speaking={active} />
        <div style={avatarLabelStyle(role)}>{role === 'customer' ? 'مشتری' : 'مالک'}</div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 18,
        padding: '0 22px',
      }}
    >
      {spec.title ? (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--muted)',
            textAlign: 'center',
            ...enterStyle(ease(progress(t, 0, 0.4))),
          }}
        >
          {spec.title}
        </div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 14 }}>
        {side('customer')}
        {side('owner')}
      </div>

      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          minHeight: 250,
          justifyContent: 'flex-end',
        }}
      >
        {turns.map((turn, i) => {
          const start = starts[i] ?? 0
          const local = t - start
          if (local < 0) return null
          const pop = ease(progress(local, 0, 0.38))
          const isCustomer = turn.speaker === 'customer'
          const isActive = i === activeIndex
          return (
            <div
              key={`${turn.speaker}-${i}`}
              style={{
                alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                maxWidth: '84%',
                opacity: (isActive ? 1 : 0.68) * pop,
                transform: `translateY(${(1 - pop) * 14}px) scale(${0.94 + 0.06 * pop})`,
                transformOrigin: isCustomer ? 'bottom left' : 'bottom right',
                background: isCustomer ? 'rgba(34,211,238,0.14)' : 'rgba(192,132,252,0.14)',
                border: `1px solid ${isCustomer ? 'rgba(34,211,238,0.45)' : 'rgba(192,132,252,0.45)'}`,
                borderRadius: isCustomer ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
                padding: '10px 16px',
                fontSize: 21,
                fontWeight: 600,
                color: 'var(--ink)',
                lineHeight: 1.45,
                boxShadow: isActive ? '0 10px 26px rgba(0,0,0,0.35)' : 'none',
              }}
            >
              {turn.text}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function enterStyle(p: number): { opacity: number; transform: string } {
  return { opacity: p, transform: `translateY(${(1 - p) * 8}px)` }
}

/** One chat pop per turn, on the turn's own clock, so the sound meets the bubble. */
export function dialogueCues(spec: DialogueSpec, dur: number) {
  return dialogueTurnStarts(spec.turns, dur).map((at) => ({ at, kind: 'chatPop' as const }))
}
