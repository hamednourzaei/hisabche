// src/ui/tech-avatar.tsx
// High-craft SaaS presenter avatar component inspired by top-tier product films (Vercel / Firecracker reference).
// Replaces amateur halftone comic characters with modern 2.5D tech persona.

import type { CSSProperties } from 'react'
import { AVATAR_NEUTRAL, AVATAR_POINTING, AVATAR_SHRUG } from './avatar-assets'

export type AvatarPose = 'neutral' | 'pointing' | 'shrug'

export interface TechPresenterAvatarProps {
  pose?: AvatarPose
  t: number
  scale?: number
  style?: CSSProperties
  className?: string
}

export function TechPresenterAvatar({
  pose = 'neutral',
  t,
  scale = 1,
  style,
}: TechPresenterAvatarProps) {
  // Natural subtle breathing motion
  const breatheY = Math.sin(t * 2.8) * 3.5
  const breatheScale = 1 + Math.sin(t * 2.8) * 0.008

  let src = AVATAR_NEUTRAL
  let width = 230

  if (pose === 'pointing') {
    src = AVATAR_POINTING
    width = 240
  } else if (pose === 'shrug') {
    src = AVATAR_SHRUG
    width = 270
  }

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-block',
        transform: `translateY(${breatheY.toFixed(2)}px) scale(${(scale * breatheScale).toFixed(3)})`,
        transformOrigin: 'bottom center',
        filter: 'drop-shadow(0 14px 28px rgba(0,0,0,0.45)) drop-shadow(0 2px 6px rgba(0,0,0,0.3))',
        pointerEvents: 'none',
        ...style,
      }}
    >
      <img
        src={src}
        alt="Presenter Avatar"
        style={{
          width,
          height: 'auto',
          display: 'block',
          objectFit: 'contain',
        }}
      />
    </div>
  )
}
