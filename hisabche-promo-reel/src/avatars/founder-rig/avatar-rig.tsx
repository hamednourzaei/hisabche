// src/avatars/founder-rig/avatar-rig.tsx
//
// Hisabche Character Rig Engine (Dual Avatar System):
// 1. Male Founder Rig: Tailored dark suit, green emblem, apricot sunglasses.
// 2. Female Old Money Rig: Tailored ivory/cream blazer, silk scarf, exposed toned legs, and crimson red high heels.
// 3. 3D VRM Mode: Powered by Three.js & @pixiv/three-vrm for girl.vrm.

import { computeJointAngles } from './kinematics'
import type { AvatarRigProps } from './types'
import { VrmAvatar } from '../vrm-avatar'

type Point = {
  x: number
  y: number
}

type Angles = {
  head?: number
  torso?: number

  leftUpperArm?: number
  leftForearm?: number
  leftHand?: number

  rightUpperArm?: number
  rightForearm?: number
  rightHand?: number

  leftThigh?: number
  leftShin?: number
  leftFoot?: number

  rightThigh?: number
  rightShin?: number
  rightFoot?: number
}

const W = 240
const H = 520

const COLORS = {
  skin: '#C98F68',
  skinLight: '#DDA57F',
  skinDark: '#A96F4E',
  skinShadow: '#935B3C',

  hair: '#242A2F',
  hairDark: '#171C20',
  hairLight: '#363F47',

  shirt: '#17232B',
  shirtLight: '#223440',
  shirtDark: '#101920',

  pants: '#25333B',
  pantsDark: '#1A252B',

  shoes: '#11181D',
  shoesLight: '#26343B',

  outline: '#0C1216',

  accent: '#18C878',
  accentDark: '#0E9D5C',

  eye: '#11181D',
  mouth: '#5C221E',
  tongue: '#C85A52',

  white: '#F4F7F5',

  // Apricot Glasses Tokens (عینک زردآلویی شیک)
  apricotLens: 'rgba(251, 146, 60, 0.76)',
  apricotLensBorder: '#EA580C',
  apricotHighlight: 'rgba(255, 237, 213, 0.65)',
  glassesFrame: '#131920',

  // Female Old Money Aesthetic Tokens (استایل اولد مانی زنانه)
  femaleBlazer: '#FAF7F2',
  femaleBlazerShadow: '#E5DFD5',
  femaleBlazerLapel: '#F0ECE4',
  femaleSkirt: '#18222A',
  femaleSilkScarf: '#991B1B',
  goldButton: '#D4AF37',
  goldPearl: '#FBF8F3',
  femaleLipstick: '#C53030',

  // Crimson Red Stiletto Heels (پاشنه بلند قرمز)
  redHeel: '#DC2626',
  redHeelDark: '#991B1B',
  redHeelSole: '#7F1D1D',
  redHeelHighlight: '#F87171',
}

function n(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readAngles(raw: unknown): Angles {
  const a = (raw ?? {}) as Record<string, unknown>

  return {
    head: n(a.head, n(a.headAngle)),
    torso: n(a.torso, n(a.torsoAngle)),

    leftUpperArm: n(a.leftUpperArm, n(a.leftArm)),
    leftForearm: n(a.leftForearm),
    leftHand: n(a.leftHand),

    rightUpperArm: n(a.rightUpperArm, n(a.rightArm)),
    rightForearm: n(a.rightForearm),
    rightHand: n(a.rightHand),

    leftThigh: n(a.leftThigh, n(a.leftLeg)),
    leftShin: n(a.leftShin),
    leftFoot: n(a.leftFoot),

    rightThigh: n(a.rightThigh, n(a.rightLeg)),
    rightShin: n(a.rightShin),
    rightFoot: n(a.rightFoot),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function deg(rad: number) {
  return (rad * 180) / Math.PI
}

function rotateAround(origin: Point, angleRad: number): string {
  const angleDeg = deg(angleRad)
  if (Math.abs(angleDeg) < 0.001) return ''
  return `rotate(${angleDeg.toFixed(3)} ${origin.x} ${origin.y})`
}

function mirrorTransform(flip: boolean) {
  return flip ? `translate(${W} 0) scale(-1 1)` : undefined
}

function expressionValues(emotion: AvatarRigProps['emotion'], t: number) {
  const pulse = Math.sin(t * 2.2)

  switch (emotion) {
    case 'tired':
      return {
        browLeftAngle: -0.22,
        browRightAngle: 0.22,
        browY: 1.5,
        mouth: 'concerned' as const,
        eyeScaleY: 0.78,
        upperLid: 2.4,
      }

    case 'concerned':
      return {
        browLeftAngle: -0.18,
        browRightAngle: 0.18,
        browY: -1.5,
        mouth: 'concerned' as const,
        eyeScaleY: 0.92,
        upperLid: 1.5,
      }

    case 'surprised':
      return {
        browLeftAngle: -0.12,
        browRightAngle: 0.12,
        browY: -4.5,
        mouth: 'open' as const,
        eyeScaleY: 1.12,
        upperLid: 0,
      }

    case 'excited':
      return {
        browLeftAngle: -0.05,
        browRightAngle: 0.05,
        browY: -1.5,
        mouth: 'smile' as const,
        eyeScaleY: 0.96,
        upperLid: 0.5,
      }

    case 'confused':
      return {
        browLeftAngle: 0.12,
        browRightAngle: -0.22,
        browY: -1,
        mouth: 'thinking' as const,
        eyeScaleY: 0.94,
        upperLid: 1.2,
      }

    case 'confident':
    default:
      return {
        browLeftAngle: 0.04 + pulse * 0.01,
        browRightAngle: -0.04 - pulse * 0.01,
        browY: 0,
        mouth: 'confident' as const,
        eyeScaleY: 1,
        upperLid: 0.6,
      }
  }
}

function blinkAmount(t: number) {
  const cycle1 = ((t % 4.3) + 4.3) % 4.3
  const cycle2 = (((t + 1.9) % 6.7) + 6.7) % 6.7

  const evaluateWindow = (c: number) => {
    if (c < 0.06) return c / 0.06
    if (c < 0.13) return 1 - (c - 0.06) / 0.07
    return 0
  }

  return Math.max(evaluateWindow(cycle1), evaluateWindow(cycle2))
}

function Mouth({
  mode,
  speaking,
  t,
  isFemale = false,
}: {
  mode: 'confident' | 'smile' | 'open' | 'concerned' | 'thinking'
  speaking: boolean
  t: number
  isFemale?: boolean
}) {
  const lipFill = isFemale ? COLORS.femaleLipstick : COLORS.mouth

  if (speaking || mode === 'open') {
    const wave = Math.sin(t * 15) * 0.55 + Math.sin(t * 23 + 0.8) * 0.3 + Math.cos(t * 9) * 0.15
    const openness = speaking ? clamp(1.8 + Math.abs(wave) * 6.2, 1.5, 7.5) : 5.2
    const halfWidth = speaking ? 7.5 + Math.sin(t * 11) * 1.2 : 6.5

    const leftX = 120 - halfWidth
    const rightX = 120 + halfWidth
    const topY = 125 - openness * 0.25
    const bottomY = 126 + openness * 1.15

    return (
      <g>
        <path
          d={`M ${leftX} ${topY} Q 120 ${topY + 1.5} ${rightX} ${topY} Q 120 ${bottomY + 3} ${leftX} ${topY} Z`}
          fill={lipFill}
          stroke={COLORS.outline}
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        {openness > 2.4 && (
          <path
            d={`M ${leftX + 1.8} ${topY + 0.6} Q 120 ${topY + 2} ${rightX - 1.8} ${topY + 0.6} L ${rightX - 2.4} ${topY + 2.8} Q 120 ${topY + 3.6} ${leftX + 2.4} ${topY + 2.8} Z`}
            fill={COLORS.white}
          />
        )}
        {openness > 3.8 && (
          <path
            d={`M ${120 - halfWidth * 0.45} ${bottomY - 1.2} Q 120 ${bottomY - 3.2} ${120 + halfWidth * 0.45} ${bottomY - 1.2} Q 120 ${bottomY + 1.2} ${120 - halfWidth * 0.45} ${bottomY - 1.2} Z`}
            fill={COLORS.tongue}
          />
        )}
      </g>
    )
  }

  if (mode === 'smile') {
    return (
      <g>
        <path
          d="M 111 124 Q 120 132 129 124"
          fill="none"
          stroke={isFemale ? COLORS.femaleLipstick : COLORS.outline}
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </g>
    )
  }

  if (mode === 'concerned') {
    return (
      <path
        d="M 112 128 Q 120 123 128 128"
        fill="none"
        stroke={isFemale ? COLORS.femaleLipstick : COLORS.outline}
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    )
  }

  return (
    <path
      d="M 112 125.5 Q 120 128.5 128.5 124"
      fill="none"
      stroke={isFemale ? COLORS.femaleLipstick : COLORS.outline}
      strokeWidth="2.6"
      strokeLinecap="round"
    />
  )
}

function Arm({
  side,
  upperAngle,
  forearmAngle,
  handAngle,
  gesture,
  t,
  isFemale = false,
}: {
  side: 'left' | 'right'
  upperAngle: number
  forearmAngle: number
  handAngle: number
  gesture: AvatarRigProps['gesture']
  t: number
  isFemale?: boolean
}) {
  void t
  const left = side === 'left'

  const shoulder: Point = left ? { x: 80, y: 188 } : { x: 160, y: 188 }

  const elbow: Point = left ? { x: 64, y: 264 } : { x: 176, y: 264 }

  const wrist: Point = left ? { x: 60, y: 336 } : { x: 180, y: 336 }

  const isPointing =
    (gesture === 'point-left' && left) ||
    ((gesture === 'point-right' || gesture === 'point-up') && !left)

  const handGestureOffset = isPointing ? (left ? -0.35 : 0.35) : 0

  const sleeveColor = isFemale
    ? left
      ? COLORS.femaleBlazerShadow
      : COLORS.femaleBlazer
    : left
      ? COLORS.shirtDark
      : COLORS.shirtLight

  return (
    /* Hierarchical Upper Arm -> Forearm -> Hand */
    <g transform={rotateAround(shoulder, upperAngle)}>
      {/* Shoulder & Upper arm sleeve */}
      <path
        d={
          left
            ? 'M 80 176 C 68 178 60 198 56 260 C 55 271 62 276 70 274 C 78 272 82 252 88 214 C 91 192 89 178 80 176 Z'
            : 'M 160 176 C 172 178 180 198 184 260 C 185 271 178 276 170 274 C 162 272 158 252 152 214 C 149 192 151 178 160 176 Z'
        }
        fill={sleeveColor}
        stroke={COLORS.outline}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Gold Blazer Cuff Button for Female */}
      {isFemale && (
        <circle
          cx={left ? 64 : 176}
          cy={258}
          r={2.5}
          fill={COLORS.goldButton}
          stroke={COLORS.outline}
          strokeWidth="1.2"
        />
      )}

      {/* Nested Forearm */}
      <g transform={rotateAround(elbow, forearmAngle)}>
        {/* Forearm skin */}
        <path
          d={
            left
              ? 'M 57 260 C 53 284 52 312 54 336 C 55 344 63 346 68 340 C 73 318 75 288 73 262 C 71 254 59 253 57 260 Z'
              : 'M 183 260 C 187 284 188 312 186 336 C 185 344 177 346 172 340 C 167 318 165 288 167 262 C 169 254 181 253 183 260 Z'
          }
          fill={left ? COLORS.skinDark : COLORS.skin}
          stroke={COLORS.outline}
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Wristwatch: Cartier Gold Watch for Female, Sports Watch for Male */}
        {left && (
          <g>
            <rect
              x="53"
              y="326"
              width="16"
              height="6"
              rx="2"
              fill={isFemale ? COLORS.goldButton : COLORS.shoes}
              stroke={COLORS.outline}
              strokeWidth="2"
            />
            <circle
              cx="61"
              cy="329"
              r="3.5"
              fill={isFemale ? COLORS.white : COLORS.accent}
              stroke={COLORS.outline}
              strokeWidth="1.8"
            />
          </g>
        )}

        {/* Nested Hand */}
        <g transform={rotateAround(wrist, handAngle + handGestureOffset)}>
          {isPointing ? (
            <g>
              <path
                d={
                  left
                    ? 'M 55 334 C 49 336 45 342 46 349 L 36 362 C 34 365 37 369 41 367 L 51 356 C 55 359 63 358 66 352 C 69 346 67 337 62 334 Z'
                    : 'M 185 334 C 191 336 195 342 194 349 L 204 362 C 206 365 203 369 199 367 L 189 356 C 185 359 177 358 174 352 C 171 346 173 337 178 334 Z'
                }
                fill={COLORS.skinLight}
                stroke={COLORS.outline}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <circle
                cx={left ? 34 : 206}
                cy={366}
                r="3.5"
                fill={isFemale ? COLORS.redHeel : COLORS.accent}
              />
            </g>
          ) : gesture === 'thumbs-up' ? (
            <g>
              <path
                d={
                  left
                    ? 'M 55 334 C 50 336 48 342 50 348 L 47 348 C 43 346 41 338 46 332 L 53 325 C 56 322 61 324 60 329 L 57 336 Z'
                    : 'M 185 334 C 190 336 192 342 190 348 L 193 348 C 197 346 199 338 194 332 L 187 325 C 184 322 179 324 180 329 L 183 336 Z'
                }
                fill={COLORS.skinLight}
                stroke={COLORS.outline}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <path
                d={
                  left
                    ? 'M 52 336 C 46 340 46 350 52 355 C 58 360 67 356 68 348 C 69 341 62 334 52 336 Z'
                    : 'M 188 336 C 194 340 194 350 188 355 C 182 360 173 356 172 348 C 171 341 178 334 188 336 Z'
                }
                fill={COLORS.skin}
                stroke={COLORS.outline}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
            </g>
          ) : (
            <path
              d={
                left
                  ? 'M 55 334 C 48 338 46 348 50 355 C 54 362 62 362 67 356 C 72 350 71 340 66 334 Z'
                  : 'M 185 334 C 192 338 194 348 190 355 C 186 362 178 362 173 356 C 168 350 169 340 174 334 Z'
              }
              fill={COLORS.skinLight}
              stroke={COLORS.outline}
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          )}
        </g>
      </g>
    </g>
  )
}

function Leg({
  side,
  thighAngle,
  shinAngle,
  footAngle,
  walk,
  t,
  isFemale = false,
}: {
  side: 'left' | 'right'
  thighAngle: number
  shinAngle: number
  footAngle: number
  walk: AvatarRigProps['walk']
  t: number
  isFemale?: boolean
}) {
  const left = side === 'left'

  const hip: Point = left ? { x: 102, y: 342 } : { x: 138, y: 342 }

  const knee: Point = left ? { x: 100, y: 418 } : { x: 140, y: 418 }

  const ankle: Point = left ? { x: 98, y: 488 } : { x: 142, y: 488 }

  const walkPhase = t * 6.2 + (left ? 0 : Math.PI)
  const isWalking = walk === 'walking'

  const strideThigh = isWalking && Math.abs(thighAngle) < 0.001 ? Math.sin(walkPhase) * 0.24 : 0

  const strideShin =
    isWalking && Math.abs(shinAngle) < 0.001 ? Math.max(0, Math.sin(walkPhase - 0.7)) * 0.32 : 0

  const strideFoot = isWalking && Math.abs(footAngle) < 0.001 ? Math.cos(walkPhase) * 0.1 : 0

  // Female leg has bare sculpted skin tone (پاهاش مشخص باشه)
  const legColor = isFemale
    ? left
      ? COLORS.skinDark
      : COLORS.skinLight
    : left
      ? COLORS.pantsDark
      : COLORS.pants

  return (
    /* Hierarchical Thigh -> Shin -> Foot */
    <g transform={rotateAround(hip, thighAngle + strideThigh)}>
      {/* Thigh (Bare toned leg for female, smart pants for male) */}
      <path
        d={
          left
            ? 'M 88 336 C 86 364 87 394 90 420 C 91 428 108 428 110 420 C 114 394 115 364 114 336 Z'
            : 'M 152 336 C 154 364 153 394 150 420 C 149 428 132 428 130 420 C 126 394 125 364 126 336 Z'
        }
        fill={legColor}
        stroke={COLORS.outline}
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Nested Shin (Bare leg for female) */}
      <g transform={rotateAround(knee, shinAngle + strideShin)}>
        <path
          d={
            left
              ? 'M 90 414 C 89 438 90 464 91 488 C 92 494 105 494 106 488 C 108 464 109 438 109 414 C 107 408 92 408 90 414 Z'
              : 'M 150 414 C 151 438 150 464 149 488 C 148 494 135 494 134 488 C 132 464 131 438 131 414 C 133 408 148 408 150 414 Z'
          }
          fill={legColor}
          stroke={COLORS.outline}
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Ankle Gold Chain for Female, Trouser Hem for Male */}
        {isFemale ? (
          <path
            d={left ? 'M 90 484 Q 98 488 107 484' : 'M 133 484 Q 142 488 150 484'}
            fill="none"
            stroke={COLORS.goldButton}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        ) : (
          <path
            d={
              left
                ? 'M 89 482 L 108 482 L 107 489 L 90 489 Z'
                : 'M 132 482 L 151 482 L 150 489 L 133 489 Z'
            }
            fill={COLORS.shirt}
            stroke={COLORS.outline}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        )}

        {/* Nested Shoe: Crimson Red Stiletto High Heels for Female (پاشنه بلند قرمز) */}
        <g transform={rotateAround(ankle, footAngle + strideFoot)}>
          {isFemale ? (
            <g>
              {/* Slender Stiletto Heel Spike (پاشنه بلند باریک) */}
              <path
                d={
                  left
                    ? 'M 104 496 L 103 516 L 106 516 L 107 496 Z'
                    : 'M 133 496 L 132 516 L 135 516 L 136 496 Z'
                }
                fill={COLORS.redHeelDark}
                stroke={COLORS.outline}
                strokeWidth="1.5"
              />
              <rect
                x={left ? 102 : 131}
                y={514}
                width="5"
                height="3"
                rx="1"
                fill={COLORS.goldButton}
              />

              {/* Arched Pointed-Toe Stiletto Pump (کفش قرمز نوک‌تیز مجلسی) */}
              <path
                d={
                  left
                    ? 'M 90 486 C 82 492 72 498 66 505 C 64 510 70 513 78 513 L 108 513 C 111 513 112 506 109 498 L 106 486 Z'
                    : 'M 150 486 C 158 492 168 498 174 505 C 176 510 170 513 162 513 L 132 513 C 129 513 128 506 131 498 L 134 486 Z'
                }
                fill={COLORS.redHeel}
                stroke={COLORS.outline}
                strokeWidth="2.8"
                strokeLinejoin="round"
              />

              {/* Glossy Patent Specular Highlight Line */}
              <path
                d={
                  left ? 'M 72 505 C 78 502 92 498 104 494' : 'M 168 505 C 162 502 148 498 136 494'
                }
                fill="none"
                stroke={COLORS.redHeelHighlight}
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Red Ankle Cross-Strap & Gold Buckle */}
              <path
                d={left ? 'M 91 487 Q 99 493 107 487' : 'M 133 487 Q 141 493 149 487'}
                fill="none"
                stroke={COLORS.redHeelDark}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={left ? 105 : 135} cy={488} r="1.8" fill={COLORS.goldButton} />
            </g>
          ) : (
            <g>
              <path
                d={
                  left
                    ? 'M 90 486 C 84 492 75 497 72 504 C 70 509 75 512 82 512 L 109 512 C 112 512 113 508 112 502 L 108 486 Z'
                    : 'M 150 486 C 156 492 165 497 168 504 C 170 509 165 512 158 512 L 131 512 C 128 512 127 508 128 502 L 132 486 Z'
                }
                fill={COLORS.shoes}
                stroke={COLORS.outline}
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d={left ? 'M 72 508 L 112 508' : 'M 128 508 L 168 508'}
                stroke={COLORS.white}
                strokeWidth="2.8"
                strokeLinecap="round"
              />
              <path
                d={left ? 'M 82 499 Q 94 503 106 499' : 'M 134 499 Q 146 503 158 499'}
                fill="none"
                stroke={COLORS.accent}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          )}
        </g>
      </g>
    </g>
  )
}

export function AvatarRig({
  t,
  x = 0,
  y = 0,
  scale = 1,
  flip = false,
  gender = 'male',
  crop = 'waist-up',
  modelMode = 'svg',
  emotion = 'confident',
  gesture = 'idle',
  gaze = 'forward',
  walk = 'standing',
  speaking = false,
  glasses = true,
  target,
  style,
  className,
}: AvatarRigProps) {
  // If user requests 3D VRM Model Engine via @pixiv/three-vrm:
  if (modelMode === 'vrm') {
    return (
      <VrmAvatar
        t={t}
        x={x}
        y={y}
        scale={scale}
        flip={flip}
        crop={crop}
        emotion={emotion}
        gesture={gesture}
        gaze={gaze}
        walk={walk}
        speaking={speaking}
        target={target}
        style={style}
        className={className}
      />
    )
  }

  const safeT = n(t, 0)
  const isFemale = gender === 'female'

  const rawAngles = computeJointAngles(safeT, gesture, emotion, speaking, walk, target)

  const angles = readAngles(rawAngles)
  const expression = expressionValues(emotion, safeT)
  const blink = blinkAmount(safeT)

  const breathe = Math.sin(safeT * 2.1) * 1.6
  const subtleSway = Math.sin(safeT * 1.1) * 0.018
  const walkBob = walk === 'walking' ? -Math.abs(Math.sin(safeT * 6.2)) * 3.5 : 0

  let gazeX = gaze === 'left' ? -2.6 : gaze === 'right' ? 2.6 : 0
  let gazeY = gaze === 'up' ? -1.8 : gaze === 'down' ? 1.8 : 0

  if (target && gaze === 'forward') {
    const dx = n(target.x, x + 120) - (x + 120)
    const dy = n(target.y, y + 92) - (y + 92)
    gazeX = clamp(dx * 0.015, -3, 3) * (flip ? -1 : 1)
    gazeY = clamp(dy * 0.012, -2, 2)
  }

  const headAngle = (angles.head ?? 0) + Math.sin(safeT * 1.4) * 0.015
  const torsoAngle = (angles.torso ?? 0) + subtleSway

  const torsoTransform = [
    `translate(0 ${breathe.toFixed(2)})`,
    rotateAround({ x: 120, y: 336 }, torsoAngle),
  ]
    .filter(Boolean)
    .join(' ')

  const openEyeScaleY = Math.max(0.08, expression.eyeScaleY * (1 - blink * 0.92))

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: W,
        height: H,
        pointerEvents: 'none',
        transform: `translate(${x}px, ${y}px) scale(${scale})`,
        transformOrigin: '50% 0%',
        ...style,
      }}
    >
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={isFemale ? 'Hisabche Old Money Female Avatar' : 'Hisabche Founder Avatar'}
        style={{
          overflow: 'visible',
          display: 'block',
        }}
      >
        <g transform={mirrorTransform(flip)}>
          {/* Ground shadow */}
          <ellipse
            cx="120"
            cy="516"
            rx={46 + walkBob * 0.8}
            ry="6.5"
            fill="#071015"
            opacity="0.18"
          />

          {/* Full-body vertical walk bounce group */}
          <g transform={`translate(0 ${walkBob.toFixed(2)})`}>
            {/* =========================
                BACK ARMS (Attached to Torso, Rendered Behind Body)
               ========================= */}
            <g transform={torsoTransform}>
              <Arm
                side="left"
                upperAngle={angles.leftUpperArm ?? 0}
                forearmAngle={angles.leftForearm ?? 0}
                handAngle={angles.leftHand ?? 0}
                gesture={gesture}
                t={safeT}
                isFemale={isFemale}
              />
              {/* When hands are behind head, BOTH arms are placed behind the head */}
              {gesture === 'hands-on-head' && (
                <Arm
                  side="right"
                  upperAngle={angles.rightUpperArm ?? 0}
                  forearmAngle={angles.rightForearm ?? 0}
                  handAngle={angles.rightHand ?? 0}
                  gesture={gesture}
                  t={safeT}
                  isFemale={isFemale}
                />
              )}
            </g>

            {/* =========================
                BACK LEG
               ========================= */}
            <Leg
              side="left"
              thighAngle={angles.leftThigh ?? 0}
              shinAngle={angles.leftShin ?? 0}
              footAngle={angles.leftFoot ?? 0}
              walk={walk}
              t={safeT}
              isFemale={isFemale}
            />

            {/* =========================
                PELVIS BRIDGE / TAILORED SKIRT
               ========================= */}
            {isFemale ? (
              /* Old Money Tailored Pencil Skirt */
              <g>
                <path
                  d="M 85 324 L 155 324 L 151 366 C 141 372 99 372 89 366 Z"
                  fill={COLORS.femaleSkirt}
                  stroke={COLORS.outline}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {/* Gold belt accent */}
                <path
                  d="M 86 328 Q 120 334 154 328"
                  fill="none"
                  stroke={COLORS.goldButton}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </g>
            ) : (
              <path
                d="M 86 324 L 154 324 L 152 348 C 142 356 98 356 88 348 Z"
                fill={COLORS.pantsDark}
                stroke={COLORS.outline}
                strokeWidth="3"
                strokeLinejoin="round"
              />
            )}

            {/* =========================
                FRONT LEG
               ========================= */}
            <Leg
              side="right"
              thighAngle={angles.rightThigh ?? 0}
              shinAngle={angles.rightShin ?? 0}
              footAngle={angles.rightFoot ?? 0}
              walk={walk}
              t={safeT}
              isFemale={isFemale}
            />

            {/* =========================
                TORSO + NECK/HEAD + FRONT ARM
               ========================= */}
            <g transform={torsoTransform}>
              {/* Torso Jacket: Old Money Cream Blazer vs Male Tech Suit */}
              {isFemale ? (
                /* Tailored Cream Double-Breasted Blazer */
                <g>
                  <path
                    d="M 81 184 C 88 168 101 163 120 163 C 139 163 152 168 159 184 L 156 332 C 144 340 96 340 84 332 Z"
                    fill={COLORS.femaleBlazer}
                    stroke={COLORS.outline}
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  {/* Blazer lapels */}
                  <path
                    d="M 98 166 L 114 232 L 86 218 Z"
                    fill={COLORS.femaleBlazerLapel}
                    stroke={COLORS.outline}
                    strokeWidth="2"
                  />
                  <path
                    d="M 142 166 L 126 232 L 154 218 Z"
                    fill={COLORS.femaleBlazerLapel}
                    stroke={COLORS.outline}
                    strokeWidth="2"
                  />
                  {/* Silk burgundy ascot scarf */}
                  <path
                    d="M 112 166 Q 120 192 128 166 L 124 208 Q 120 216 116 208 Z"
                    fill={COLORS.femaleSilkScarf}
                    stroke={COLORS.outline}
                    strokeWidth="2"
                  />
                  {/* Two rows of gold crest buttons */}
                  <circle
                    cx="112"
                    cy="246"
                    r="3"
                    fill={COLORS.goldButton}
                    stroke={COLORS.outline}
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="128"
                    cy="246"
                    r="3"
                    fill={COLORS.goldButton}
                    stroke={COLORS.outline}
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="112"
                    cy="272"
                    r="3"
                    fill={COLORS.goldButton}
                    stroke={COLORS.outline}
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="128"
                    cy="272"
                    r="3"
                    fill={COLORS.goldButton}
                    stroke={COLORS.outline}
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="112"
                    cy="298"
                    r="3"
                    fill={COLORS.goldButton}
                    stroke={COLORS.outline}
                    strokeWidth="1.2"
                  />
                  <circle
                    cx="128"
                    cy="298"
                    r="3"
                    fill={COLORS.goldButton}
                    stroke={COLORS.outline}
                    strokeWidth="1.2"
                  />
                </g>
              ) : (
                /* Male Tech Suit */
                <g>
                  <path
                    d="M 80 184 C 88 168 101 163 120 163 C 139 163 152 168 160 184 L 156 336 C 144 345 96 345 84 336 Z"
                    fill={COLORS.shirt}
                    stroke={COLORS.outline}
                    strokeWidth="3.5"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M 84 188 L 96 188 L 94 334 L 86 334 Z"
                    fill={COLORS.shirtDark}
                    opacity="0.55"
                  />
                  <path
                    d="M 120 192 L 120 336"
                    stroke={COLORS.shirtLight}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 103 166 L 120 192 L 137 166"
                    fill={COLORS.shirtDark}
                    stroke={COLORS.accent}
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <g transform="translate(136 212)">
                    <path d="M -5 0 L 0 -5 L 5 0 L 0 5 Z" fill={COLORS.accent} />
                    <circle cx="0" cy="0" r="1.5" fill={COLORS.white} />
                  </g>
                  <path
                    d="M 85 332 Q 120 339 155 332"
                    fill="none"
                    stroke={COLORS.outline}
                    strokeWidth="4"
                    strokeLinecap="round"
                  />
                  <rect
                    x="114"
                    y="331"
                    width="12"
                    height="6"
                    rx="2"
                    fill={COLORS.accentDark}
                    stroke={COLORS.outline}
                    strokeWidth="2"
                  />
                </g>
              )}

              {/* =========================
                  NECK & HEAD (Attached to Torso)
                 ========================= */}
              <g transform={rotateAround({ x: 120, y: 164 }, headAngle)}>
                {/* Neck */}
                <path
                  d="M 107 142 L 133 142 L 135 170 C 128 178 112 178 105 170 Z"
                  fill={COLORS.skinDark}
                  stroke={COLORS.outline}
                  strokeWidth="3"
                  strokeLinejoin="round"
                />

                {/* Back hair layer */}
                <path
                  d={
                    isFemale
                      ? 'M 72 88 C 65 50 78 18 120 16 C 162 18 175 50 168 88 C 176 130 178 175 168 210 C 160 195 152 175 148 152 L 92 152 C 88 175 80 195 72 210 C 62 175 64 130 72 88 Z'
                      : 'M 78 88 C 73 54 84 22 120 20 C 156 22 167 54 162 88 Z'
                  }
                  fill={COLORS.hairDark}
                  stroke={COLORS.outline}
                  strokeWidth="3.5"
                />

                {/* Ears with Pearl Earrings for Female */}
                <g>
                  <ellipse
                    cx="79"
                    cy="96"
                    rx="7"
                    ry="11.5"
                    fill={COLORS.skin}
                    stroke={COLORS.outline}
                    strokeWidth="3"
                  />
                  <ellipse
                    cx="161"
                    cy="96"
                    rx="7"
                    ry="11.5"
                    fill={COLORS.skin}
                    stroke={COLORS.outline}
                    strokeWidth="3"
                  />
                  {isFemale && (
                    <g>
                      <circle
                        cx="78"
                        cy="106"
                        r="3.2"
                        fill={COLORS.goldPearl}
                        stroke={COLORS.goldButton}
                        strokeWidth="1.2"
                      />
                      <circle
                        cx="162"
                        cy="106"
                        r="3.2"
                        fill={COLORS.goldPearl}
                        stroke={COLORS.goldButton}
                        strokeWidth="1.2"
                      />
                    </g>
                  )}
                </g>

                {/* Head / Face Silhouette */}
                <path
                  d={
                    isFemale
                      ? 'M 83 80 C 83 46 98 28 120 28 C 142 28 157 46 157 80 L 153 124 C 149 146 136 157 120 157 C 104 157 91 146 87 124 Z'
                      : 'M 81 78 C 81 44 97 26 120 26 C 143 26 159 44 159 78 L 155 124 C 151 144 137 156 120 156 C 103 156 89 144 85 124 Z'
                  }
                  fill={COLORS.skin}
                  stroke={COLORS.outline}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />

                {/* Hair Volume */}
                <path
                  d={
                    isFemale
                      ? 'M 76 86 C 70 52 82 20 114 16 C 136 13 158 20 164 42 C 170 56 168 76 164 92 C 156 70 144 52 128 47 C 110 42 90 48 82 68 Z'
                      : 'M 80 84 C 76 56 85 26 112 19 C 132 14 152 22 160 40 C 165 52 164 69 159 84 C 154 68 145 54 131 49 C 114 43 95 49 85 65 C 82 70 81 77 80 84 Z'
                  }
                  fill={COLORS.hair}
                  stroke={COLORS.outline}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />

                {/* Eyebrows */}
                <g
                  transform={`translate(0 ${expression.browY}) ${rotateAround({ x: 101, y: 78 }, expression.browLeftAngle)}`}
                >
                  <path
                    d="M 90 79 Q 101 73 111 78"
                    fill="none"
                    stroke={COLORS.hairDark}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                </g>
                <g
                  transform={`translate(0 ${expression.browY}) ${rotateAround({ x: 139, y: 78 }, expression.browRightAngle)}`}
                >
                  <path
                    d="M 129 78 Q 139 73 150 79"
                    fill="none"
                    stroke={COLORS.hairDark}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                  />
                </g>

                {/* Eyes */}
                <g
                  transform={`translate(0 92) scale(1 ${openEyeScaleY.toFixed(3)}) translate(0 -92)`}
                >
                  <ellipse
                    cx="101"
                    cy="92"
                    rx="6.2"
                    ry="6.5"
                    fill={COLORS.white}
                    stroke={COLORS.outline}
                    strokeWidth="2.2"
                  />
                  <ellipse
                    cx="139"
                    cy="92"
                    rx="6.2"
                    ry="6.5"
                    fill={COLORS.white}
                    stroke={COLORS.outline}
                    strokeWidth="2.2"
                  />

                  {/* Pupils */}
                  <g transform={`translate(${gazeX.toFixed(2)} ${gazeY.toFixed(2)})`}>
                    <circle cx="101" cy="92" r="3.1" fill={COLORS.eye} />
                    <circle cx="99.8" cy="90.5" r="1.1" fill={COLORS.white} />
                    <circle cx="139" cy="92" r="3.1" fill={COLORS.eye} />
                    <circle cx="137.8" cy="90.5" r="1.1" fill={COLORS.white} />
                  </g>

                  {/* Winged Eyelashes for Female */}
                  {isFemale && (
                    <g>
                      <path
                        d="M 93 88 L 88 85"
                        stroke={COLORS.outline}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 97 86 L 94 82"
                        stroke={COLORS.outline}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 147 88 L 152 85"
                        stroke={COLORS.outline}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M 143 86 L 146 82"
                        stroke={COLORS.outline}
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  )}
                </g>

                {/* Nose */}
                <path
                  d="M 120 89 L 117 107 Q 120 111 124 108"
                  fill="none"
                  stroke={COLORS.skinShadow}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Apricot Tinted Glasses / Sunglasses (عینک زردآلویی شیک) */}
                {glasses && (
                  <g id="apricot-sunglasses" style={{ pointerEvents: 'none' }}>
                    <path
                      d="M 88 91 L 78 93"
                      stroke={COLORS.glassesFrame}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 152 91 L 162 93"
                      stroke={COLORS.glassesFrame}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 112 90 Q 120 86 128 90"
                      fill="none"
                      stroke={COLORS.glassesFrame}
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 115 89 Q 120 87.5 125 89"
                      fill="none"
                      stroke={COLORS.apricotLensBorder}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />

                    {/* Left Frame Rim */}
                    <rect
                      x="87"
                      y="81"
                      width="26"
                      height="22"
                      rx={isFemale ? 9 : 6.5}
                      fill={COLORS.glassesFrame}
                      stroke={COLORS.outline}
                      strokeWidth="2.2"
                    />
                    <rect
                      x="89.5"
                      y="83.5"
                      width="21"
                      height="17"
                      rx={isFemale ? 7 : 4.5}
                      fill={COLORS.apricotLens}
                      stroke={COLORS.apricotLensBorder}
                      strokeWidth="1.2"
                    />
                    <path
                      d="M 92 85 L 102 85 L 94 98 L 92 98 Z"
                      fill={COLORS.apricotHighlight}
                      opacity="0.8"
                    />
                    <circle cx="89" cy="85" r="1" fill={COLORS.goldButton} />

                    {/* Right Frame Rim */}
                    <rect
                      x="127"
                      y="81"
                      width="26"
                      height="22"
                      rx={isFemale ? 9 : 6.5}
                      fill={COLORS.glassesFrame}
                      stroke={COLORS.outline}
                      strokeWidth="2.2"
                    />
                    <rect
                      x="129.5"
                      y="83.5"
                      width="21"
                      height="17"
                      rx={isFemale ? 7 : 4.5}
                      fill={COLORS.apricotLens}
                      stroke={COLORS.apricotLensBorder}
                      strokeWidth="1.2"
                    />
                    <path
                      d="M 132 85 L 142 85 L 134 98 L 132 98 Z"
                      fill={COLORS.apricotHighlight}
                      opacity="0.8"
                    />
                    <circle cx="151" cy="85" r="1" fill={COLORS.goldButton} />
                  </g>
                )}

                {/* Mouth */}
                <Mouth mode={expression.mouth} speaking={speaking} t={safeT} isFemale={isFemale} />
              </g>

              {/* =========================
                  FRONT ARM (Rendered in Front when NOT behind head)
                 ========================= */}
              {gesture !== 'hands-on-head' && (
                <Arm
                  side="right"
                  upperAngle={angles.rightUpperArm ?? 0}
                  forearmAngle={angles.rightForearm ?? 0}
                  handAngle={angles.rightHand ?? 0}
                  gesture={gesture}
                  t={safeT}
                  isFemale={isFemale}
                />
              )}
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

export default AvatarRig
