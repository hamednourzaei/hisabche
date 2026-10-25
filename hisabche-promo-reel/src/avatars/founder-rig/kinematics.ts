// src/avatars/founder-rig/kinematics.ts
//
// Hisabche Founder Avatar — Procedural Kinematics (Final Production Version)
//
// Features:
// - Deterministic (same `t` → same pose)
// - Hierarchical local rotations (radians)
// - Two-bone IK for both arms
// - Natural breathing + micro-sway
// - Walk cycle with body bob + arm counter-swing
// - Gesture presets with human joint limits
// - Emotion-aware posture
// - Target-aware head + gaze
// - Procedural speech mouth openness
// - Full legacy field compatibility
//
// IMPORTANT:
// All joint rotations returned here are LOCAL rotations in radians.
// The SVG AvatarRig must apply them hierarchically:
// Shoulder → UpperArm → Elbow → Forearm → Wrist → Hand

import type { Emotion, Gesture, JointAngles, TargetCoord, WalkState } from './types'

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const TAU = Math.PI * 2
const DEG = Math.PI / 180

const SHOULDER_RIGHT = { x: 160, y: 188 }
const SHOULDER_LEFT = { x: 80, y: 188 }

const UPPER_ARM = 82
const FOREARM = 82

const MAX_REACH = UPPER_ARM + FOREARM - 2
const MIN_REACH = Math.abs(UPPER_ARM - FOREARM) + 4

/* -------------------------------------------------------------------------- */
/* Math helpers                                                               */
/* -------------------------------------------------------------------------- */

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t, 0, 1)
}

function normalizeAngle(angle: number) {
  let a = angle
  while (a > Math.PI) a -= TAU
  while (a < -Math.PI) a += TAU
  return a
}

function dampAngle(current: number, target: number, amount: number) {
  const delta = normalizeAngle(target - current)
  return normalizeAngle(current + delta * clamp(amount, 0, 1))
}

/** Deterministic organic noise (no Math.random) */
function noise(t: number, frequency: number, phase = 0) {
  return (
    Math.sin(t * frequency + phase) * 0.65 + Math.sin(t * frequency * 1.71 + phase * 1.7) * 0.35
  )
}

/* -------------------------------------------------------------------------- */
/* Target helpers                                                             */
/* -------------------------------------------------------------------------- */

function clampTargetToReach(target: TargetCoord, shoulder: { x: number; y: number }): TargetCoord {
  const dx = target.x - shoulder.x
  const dy = target.y - shoulder.y
  const dist = Math.hypot(dx, dy)

  if (dist === 0) {
    return { x: shoulder.x, y: shoulder.y + MIN_REACH }
  }

  const safe = clamp(dist, MIN_REACH, MAX_REACH)
  const ratio = safe / dist

  return {
    x: shoulder.x + dx * ratio,
    y: shoulder.y + dy * ratio,
  }
}

/**
 * Two-bone Inverse Kinematics
 * Returns LOCAL upper-arm and forearm rotations
 */
function solveTwoBoneIK(
  shoulder: { x: number; y: number },
  target: TargetCoord,
  upperLength: number,
  lowerLength: number,
  side: 'left' | 'right',
) {
  const safeTarget = clampTargetToReach(target, shoulder)

  const dx = safeTarget.x - shoulder.x
  const dy = safeTarget.y - shoulder.y
  const dist = clamp(Math.hypot(dx, dy), 0.001, upperLength + lowerLength)

  const targetAngle = Math.atan2(dy, dx)

  const cosUpper =
    (upperLength * upperLength + dist * dist - lowerLength * lowerLength) / (2 * upperLength * dist)

  const upperOffset = Math.acos(clamp(cosUpper, -1, 1))

  const cosLower =
    (upperLength * upperLength + lowerLength * lowerLength - dist * dist) /
    (2 * upperLength * lowerLength)

  const elbowAngle = Math.acos(clamp(cosLower, -1, 1))

  // Opposite bend direction so left arm doesn't fold through body
  const bend = side === 'right' ? -1 : 1

  const worldUpper = targetAngle + bend * upperOffset
  const localForearm = bend * (Math.PI - elbowAngle)

  return {
    upper: normalizeAngle(worldUpper),
    forearm: normalizeAngle(localForearm),
  }
}

/* -------------------------------------------------------------------------- */
/* Gaze                                                                       */
/* -------------------------------------------------------------------------- */

function solveHeadTarget(target?: TargetCoord) {
  if (!target) {
    return { head: 0, gazeX: 0, gazeY: 0 }
  }

  const dx = target.x - 120
  const dy = target.y - 95

  return {
    head: clamp(Math.atan2(dy, dx) * 0.13, -0.22, 0.22),
    gazeX: clamp(dx * 0.035, -4.5, 4.5),
    gazeY: clamp(dy * 0.025, -3.2, 3.2),
  }
}

/* -------------------------------------------------------------------------- */
/* Idle base pose                                                             */
/* -------------------------------------------------------------------------- */

function idlePose(t: number) {
  const breathing = Math.sin(t * 2.05) * 0.018
  const sway = noise(t, 0.65, 0.7) * 0.012

  return {
    leftUpperArm: 0.06 + breathing,
    leftForearm: 0.05,
    leftHand: 0,
    rightUpperArm: -0.06 - breathing,
    rightForearm: -0.05,
    rightHand: 0,
    head: Math.sin(t * 0.85) * 0.012,
    torso: sway,
    leftThigh: 0,
    leftShin: 0,
    leftFoot: 0,
    rightThigh: 0,
    rightShin: 0,
    rightFoot: 0,
    bodyBob: Math.sin(t * 2.05) * 1.15,
  }
}

/* -------------------------------------------------------------------------- */
/* Gesture presets                                                            */
/* -------------------------------------------------------------------------- */

function applyGesture(pose: ReturnType<typeof idlePose>, gesture: Gesture, t: number) {
  const pulse = Math.sin(t * 3.2) * 0.025

  switch (gesture) {
    case 'point-right':
      pose.rightUpperArm = -1.25 + pulse
      pose.rightForearm = -0.3
      pose.rightHand = -0.12
      pose.head = -0.06
      break

    case 'point-left':
      pose.leftUpperArm = 1.25 - pulse
      pose.leftForearm = 0.3
      pose.leftHand = 0.12
      pose.head = 0.06
      break

    case 'point-up':
      pose.rightUpperArm = -2.3 + pulse
      pose.rightForearm = -0.2
      pose.rightHand = -0.08
      pose.head = -0.1
      break

    case 'shrug': {
      const s = Math.sin(t * 2.4) * 0.025
      pose.leftUpperArm = 0.72 + s
      pose.leftForearm = 1.35
      pose.leftHand = 0.28
      pose.rightUpperArm = -0.72 - s
      pose.rightForearm = -1.35
      pose.rightHand = -0.28
      pose.head = Math.sin(t * 2.8) * 0.06
      pose.torso = 0.018
      break
    }

    case 'thumbs-up':
      pose.rightUpperArm = -0.72
      pose.rightForearm = -1.35
      pose.rightHand = -0.25
      pose.leftUpperArm = 0.12
      pose.leftForearm = 0.24
      pose.leftHand = 0.08
      pose.head = -0.035
      break

    case 'arms-crossed':
      pose.leftUpperArm = 0.7
      pose.leftForearm = 1.55
      pose.leftHand = 0.05
      pose.rightUpperArm = -0.7
      pose.rightForearm = -1.55
      pose.rightHand = -0.05
      pose.head = 0.015
      break

    case 'hands-on-head':
      pose.leftUpperArm = 2.18
      pose.leftForearm = 2.05
      pose.leftHand = 0.45
      pose.rightUpperArm = -2.18
      pose.rightForearm = -2.05
      pose.rightHand = -0.45
      pose.head = Math.sin(t * 4.2) * 0.055
      break

    case 'talk':
      pose.rightUpperArm = -0.62 + Math.sin(t * 4.1) * 0.11
      pose.rightForearm = -0.78 + Math.cos(t * 4.1) * 0.13
      pose.rightHand = -0.12 + Math.sin(t * 5.5) * 0.04
      pose.leftUpperArm = 0.12 + Math.sin(t * 2.1) * 0.045
      pose.leftForearm = 0.18
      pose.head = Math.sin(t * 2.5) * 0.035
      break

    case 'click-link':
      pose.rightUpperArm = -1.02
      pose.rightForearm = -0.52
      pose.rightHand = -0.28
      pose.head = -0.05
      break

    case 'wave':
      pose.rightUpperArm = -0.85
      pose.rightForearm = -1.05
      pose.rightHand = Math.sin(t * 8) * 0.28
      pose.head = Math.sin(t * 1.8) * 0.025
      break

    case 'think':
      pose.rightUpperArm = -0.75
      pose.rightForearm = -1.45
      pose.rightHand = 0.2
      pose.head = 0.07
      break

    case 'celebrate':
      pose.leftUpperArm = 2.0
      pose.leftForearm = 1.9
      pose.rightUpperArm = -2.0
      pose.rightForearm = -1.9
      pose.leftHand = Math.sin(t * 4) * 0.08
      pose.rightHand = Math.sin(t * 4 + 1) * 0.08
      pose.head = Math.sin(t * 3) * 0.045
      pose.bodyBob = Math.abs(Math.sin(t * 3.5)) * 3
      break

    case 'idle':
    default:
      break
  }
}

/* -------------------------------------------------------------------------- */
/* Emotion                                                                    */
/* -------------------------------------------------------------------------- */

function applyEmotion(pose: ReturnType<typeof idlePose>, emotion: Emotion, t: number) {
  switch (emotion) {
    case 'concerned':
      pose.head += 0.025
      pose.torso -= 0.008
      break
    case 'surprised':
      pose.head -= 0.035
      pose.torso += 0.012
      pose.bodyBob += Math.sin(t * 2.2) * 0.4
      break
    case 'happy':
      pose.head -= 0.012
      pose.torso += 0.006
      break
    case 'thinking':
      pose.head += 0.055
      pose.torso -= 0.004
      break
    case 'confident':
    default:
      pose.head -= 0.005
      break
  }
}

/* -------------------------------------------------------------------------- */
/* Walk cycle                                                                 */
/* -------------------------------------------------------------------------- */

function applyWalk(
  pose: ReturnType<typeof idlePose>,
  walk: WalkState,
  gesture: Gesture,
  t: number,
) {
  if (walk !== 'walking') return

  const phase = t * 6.1
  const leftPhase = phase
  const rightPhase = phase + Math.PI

  pose.leftThigh = Math.sin(leftPhase) * 0.34
  pose.rightThigh = Math.sin(rightPhase) * 0.34

  pose.leftShin = Math.max(0, Math.sin(leftPhase - 0.65)) * 0.48
  pose.rightShin = Math.max(0, Math.sin(rightPhase - 0.65)) * 0.48

  pose.leftFoot = Math.cos(leftPhase) * 0.1
  pose.rightFoot = Math.cos(rightPhase) * 0.1

  pose.bodyBob = Math.abs(Math.sin(phase)) * 2.4

  // Natural arm counter-swing only when gesture allows it
  if (gesture === 'idle' || gesture === 'talk') {
    const swing = Math.sin(phase) * 0.3
    pose.leftUpperArm = 0.06 - swing
    pose.rightUpperArm = -0.06 + swing

    if (gesture === 'talk') {
      pose.leftForearm += Math.sin(phase * 0.5) * 0.04
      pose.rightForearm += Math.cos(phase * 0.5) * 0.04
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Target-aware IK (both arms supported)                                      */
/* -------------------------------------------------------------------------- */

function applyTarget(pose: ReturnType<typeof idlePose>, target: TargetCoord, gesture: Gesture) {
  // Decide which arm to use based on target position or gesture
  const useLeft = gesture === 'point-left' || target.x < 120

  const shoulder = useLeft ? SHOULDER_LEFT : SHOULDER_RIGHT
  const side = useLeft ? 'left' : 'right'

  const solution = solveTwoBoneIK(shoulder, target, UPPER_ARM, FOREARM, side)

  const weight =
    gesture === 'point-right' || gesture === 'point-left' || gesture === 'click-link' ? 1 : 0.88

  if (useLeft) {
    pose.leftUpperArm = lerp(pose.leftUpperArm, solution.upper, weight)
    pose.leftForearm = lerp(pose.leftForearm, solution.forearm, weight)
    if (gesture === 'point-left') {
      pose.leftHand = lerp(pose.leftHand, 0.1, 0.85)
    }
  } else {
    pose.rightUpperArm = lerp(pose.rightUpperArm, solution.upper, weight)
    pose.rightForearm = lerp(pose.rightForearm, solution.forearm, weight)
    if (gesture === 'point-right' || gesture === 'click-link') {
      pose.rightHand = lerp(pose.rightHand, -0.1, 0.85)
    }
  }

  // Subtle body follow
  const dx = target.x - (useLeft ? SHOULDER_LEFT.x : SHOULDER_RIGHT.x)
  pose.torso = clamp(dx * 0.00045, -0.035, 0.035)
}

/* -------------------------------------------------------------------------- */
/* Lip-sync                                                                   */
/* -------------------------------------------------------------------------- */

function computeMouthOpen(t: number, speaking: boolean, emotion: Emotion) {
  if (emotion === 'surprised') return 0.62
  if (!speaking) return 0

  // Three frequencies → less mechanical rhythm
  const a = Math.abs(Math.sin(t * 10.7))
  const b = Math.abs(Math.sin(t * 16.3 + 0.7))
  const c = Math.abs(Math.sin(t * 7.4 + 1.4))

  return clamp(0.12 + a * 0.28 + b * 0.2 + c * 0.14, 0.08, 0.78)
}

/* -------------------------------------------------------------------------- */
/* Main solver                                                                */
/* -------------------------------------------------------------------------- */

export function computeJointAngles(
  t: number,
  gesture: Gesture = 'idle',
  emotion: Emotion = 'confident',
  speaking = false,
  walk: WalkState = 'standing',
  target?: TargetCoord,
): JointAngles {
  const time = Number.isFinite(t) ? Math.max(0, t) : 0

  // 1. Start from neutral
  const pose = idlePose(time)

  // 2. Apply gesture
  applyGesture(pose, gesture, time)

  // 3. Apply emotion
  applyEmotion(pose, emotion, time)

  // 4. Apply walk
  applyWalk(pose, walk, gesture, time)

  // 5. Apply target IK (highest priority)
  if (target) {
    applyTarget(pose, target, gesture)
  }

  // 6. Head follows target
  const headTarget = solveHeadTarget(target)
  pose.head = dampAngle(pose.head, headTarget.head, target ? 0.72 : 0.15)

  // 7. Clamp all joints to human ranges
  const leftUpperArm = clamp(pose.leftUpperArm, -2.65, 2.65)
  const rightUpperArm = clamp(pose.rightUpperArm, -2.65, 2.65)
  const leftForearm = clamp(pose.leftForearm, -2.7, 2.7)
  const rightForearm = clamp(pose.rightForearm, -2.7, 2.7)
  const leftHand = clamp(pose.leftHand, -0.9, 0.9)
  const rightHand = clamp(pose.rightHand, -0.9, 0.9)
  const leftThigh = clamp(pose.leftThigh, -0.65, 0.65)
  const rightThigh = clamp(pose.rightThigh, -0.65, 0.65)
  const leftShin = clamp(pose.leftShin, 0, 0.75)
  const rightShin = clamp(pose.rightShin, 0, 0.75)
  const leftFoot = clamp(pose.leftFoot, -0.3, 0.3)
  const rightFoot = clamp(pose.rightFoot, -0.3, 0.3)
  const head = clamp(pose.head, -0.25, 0.25)
  const torso = clamp(pose.torso, -0.08, 0.08)

  const mouthOpen = computeMouthOpen(time, speaking, emotion)

  return {
    // Core joints
    head,
    torso,
    leftUpperArm,
    leftForearm,
    leftHand,
    rightUpperArm,
    rightForearm,
    rightHand,
    leftThigh,
    leftShin,
    leftFoot,
    rightThigh,
    rightShin,
    rightFoot,
    mouthOpen,

    // Emotion helpers
    eyebrowY: emotion === 'surprised' ? -5 : emotion === 'concerned' ? 2 : 0,

    // Legacy aliases (do not remove)
    headAngle: head,
    torsoAngle: torso,
    leftArm: leftUpperArm,
    rightArm: rightUpperArm,
    leftLeg: leftThigh,
    rightLeg: rightThigh,
    headTilt: head / DEG,

    // Optional metadata
    gazeX: headTarget.gazeX,
    gazeY: headTarget.gazeY,
    bodyBob: pose.bodyBob,
  } as JointAngles
}
