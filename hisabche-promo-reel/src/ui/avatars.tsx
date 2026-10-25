// Two characters the dialogue scene can animate:
//   م customer — the person at the counter
//   م owner    — the shopkeeper behind it
//
// Every part is a vector drawn from the theme tokens (no images, no emoji),
// and the face is alive: it breathes, blinks, and moves its mouth while the
// character is the one speaking. `t` is scene-local seconds.
import type { CSSProperties } from 'react'

export type AvatarRole = 'customer' | 'owner'

export type AvatarProps = {
  role: AvatarRole
  size?: number
  /** Scene-local seconds. When omitted the face is drawn in a neutral pose. */
  t?: number | undefined
  /** True while this character holds the turn — mouth moves, ring glows. */
  speaking?: boolean | undefined
}

const ROLE = {
  customer: {
    accent: 'var(--cyan)',
    label: 'مشتری',
    hair: 'cap',
  },
  owner: {
    accent: 'var(--purple)',
    label: 'مالک',
    hair: 'part',
  },
} as const

/** 0…1, 1 = eye fully open. A short blink every ~3.2 s, offset per role. */
function blinkAt(t: number | undefined, offset: number): number {
  if (t === undefined) return 1
  const phase = (t + offset) % 3.2
  if (phase > 3.05) {
    const p = (phase - 3.05) / 0.15
    return Math.abs(1 - 2 * p) * 0.9 + 0.1
  }
  return 1
}

/** 0…1 mouth opening. Idle is a closed smile; speaking opens and closes. */
function mouthAt(t: number | undefined, speaking: boolean): number {
  if (!speaking) return 0.18
  if (t === undefined) return 0.55
  return 0.25 + 0.6 * Math.abs(Math.sin(t * 11))
}

export function CharacterAvatar({ role, size = 120, t, speaking = false }: AvatarProps) {
  const { accent, hair } = ROLE[role]
  const breathe = t === undefined ? 1 : 1 + 0.012 * Math.sin(t * 2.1)
  const blink = blinkAt(t, role === 'owner' ? 1.1 : 0)
  const mouth = mouthAt(t, speaking)
  const glow = speaking ? 0.55 + 0.25 * Math.sin((t ?? 0) * 5) : 0.18

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={ROLE[role].label}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* halo — the speaker is lit, the listener rests */}
      <circle cx="60" cy="58" r="52" fill={accent} opacity={glow * 0.16} />
      <circle
        cx="60"
        cy="58"
        r="52"
        fill="none"
        stroke={accent}
        strokeWidth={speaking ? 2.5 : 1.5}
        opacity={0.25 + glow * 0.55}
      />

      <g transform={`translate(0 ${((1 - breathe) * 40).toFixed(2)})`}>
        {/* shoulders */}
        <path
          d="M24 104 C24 84, 40 74, 60 74 C80 74, 96 84, 96 104 Z"
          fill={accent}
          opacity="0.22"
        />
        <path
          d="M32 104 C32 88, 45 80, 60 80 C75 80, 88 88, 88 104"
          fill="none"
          stroke={accent}
          strokeWidth="2"
          opacity="0.65"
        />

        {/* neck */}
        <rect x="54" y="64" width="12" height="14" rx="5" fill={accent} opacity="0.35" />

        {/* head */}
        <circle cx="60" cy="48" r="21" fill={accent} opacity="0.9" />
        {/* light rim so the head reads as a sphere, not a sticker */}
        <path
          d="M45 32 A21 21 0 0 1 74 34"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          opacity="0.35"
        />

        {/* hair: a flat cap for the customer, a side part for the owner */}
        {hair === 'cap' ? (
          <path d="M40 36 C40 22, 80 22, 80 36 L80 40 L40 40 Z" fill={accent} opacity="0.55" />
        ) : (
          <path
            d="M41 34 C44 24, 62 20, 78 30 L74 34 C64 28, 52 29, 45 37 Z"
            fill={accent}
            opacity="0.55"
          />
        )}

        {/* eyes */}
        <g transform={`translate(0 ${(48 - 0).toFixed(2)})`}>
          {[52, 68].map((cx) => (
            <g key={cx} transform={`translate(${cx} 0) scale(1 ${blink.toFixed(3)})`}>
              <ellipse cx="0" cy="0" rx="3.6" ry="3.6" fill="var(--bg)" opacity="0.85" />
              <circle cx="0" cy="0" r="1.7" fill={accent} />
            </g>
          ))}
        </g>

        {/* brows */}
        <path
          d="M47 41 L56 41"
          stroke="var(--bg)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />
        <path
          d="M64 41 L73 41"
          stroke="var(--bg)"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* mouth */}
        <rect
          x={60 - 5}
          y={55}
          width={10}
          height={2.4 + 4.2 * mouth}
          rx={(2.4 + 4.2 * mouth) / 2}
          fill="var(--bg)"
          opacity="0.85"
        />

        {/* role badge */}
        <g transform="translate(92 94)">
          <circle
            cx="0"
            cy="0"
            r="14"
            fill="var(--bg)"
            stroke={accent}
            strokeWidth="1.8"
            opacity="0.95"
          />
          {role === 'customer' ? (
            <>
              <path
                d="M-5 -2 L5 -2 L6.5 8 L-6.5 8 Z"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M-2.5 -2 C-2.5 -6, 2.5 -6, 2.5 -2"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M-7 8 L-7 0 L7 0 L7 8"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M-8 0 L8 0 L6 -5 L-6 -5 Z"
                fill="none"
                stroke={accent}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </>
          )}
        </g>
      </g>
    </svg>
  )
}

export function Avatar({ role, size, t, speaking }: AvatarProps) {
  return <CharacterAvatar role={role} size={size} t={t} speaking={speaking} />
}

/** Shared label style so the name under an avatar matches the bubble colour. */
export function avatarLabelStyle(role: AvatarRole): CSSProperties {
  return {
    fontSize: 17,
    fontWeight: 800,
    color: ROLE[role].accent,
    letterSpacing: '0.01em',
  }
}
