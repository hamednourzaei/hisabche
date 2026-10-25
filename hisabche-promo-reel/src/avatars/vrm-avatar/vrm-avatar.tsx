// src/avatars/vrm-avatar/vrm-avatar.tsx
// The 3D presenter (Three.js + @pixiv/three-vrm), shared across scenes.
//
// This component only POSES the one model held by `vrm-shared.ts` and copies
// the picture into its own canvas — it never loads the file itself, so mounting
// it in every scene costs nothing after the first. The pose is a pure function
// of `t` (see `acts.ts`), which is what makes an exported frame repeatable.

import { useEffect, useMemo, useRef } from 'react'
import type { VRM } from '@pixiv/three-vrm'
import { computeJointAngles } from '../founder-rig/kinematics'
import type { AvatarRigProps, JointAngles } from '../founder-rig/types'
import { actAt, liftAt, type ActBeat, type ActState } from './acts'
import { frameAvatarStage, loadAvatarStage, loadedAvatarStage, settleSprings } from './vrm-shared'

export interface VrmAvatarProps extends AvatarRigProps {
  vrmUrl?: string
  width?: number
  height?: number
  cameraFov?: number
  /**
   * What the avatar does during this scene, as beats on the scene clock. When
   * given it decides gesture, emotion and speaking; `gesture`, `emotion` and
   * `speaking` are then only the fallback for a scene that has no beats.
   */
  acts?: readonly ActBeat[]
}

/** Every angle of `a` eased toward `b`. */
function blendAngles(a: JointAngles, b: JointAngles, weight: number): JointAngles {
  const from = a as Record<string, number | undefined>
  const to = b as Record<string, number | undefined>
  const out: Record<string, number> = {}
  for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
    const x = from[key] ?? 0
    const y = to[key] ?? 0
    out[key] = x + (y - x) * weight
  }
  return out as JointAngles
}

function poseBones(vrm: VRM, angles: JointAngles, t: number): void {
  const humanoid = vrm.humanoid
  if (!humanoid) return
  const bone = (name: Parameters<typeof humanoid.getNormalizedBoneNode>[0]) =>
    humanoid.getNormalizedBoneNode(name)

  // ─── Contrapposto & Feminine Allure Dynamics («عشوه» و انتقال وزن) ────────
  // Graceful, continuous weight shifting between left and right foot (~4.8s full cycle)
  const swayTime = t * 1.3
  const weightShift = Math.sin(swayTime) // -1 (weight on left) to +1 (weight on right)
  const weightShiftAbs = Math.abs(weightShift)

  // Natural organic 3/4 turn angle with smooth subtle rotation (avoid rigid 0° cardboard look)
  const turnAngle = 0.16 + Math.sin(t * 0.75) * 0.12

  // 1. Hips (Pelvis) — Root of the S-curve
  const hips = bone('hips')
  if (hips) {
    // Horizontal hip displacement toward the load-bearing leg:
    hips.position.x = weightShift * 0.042
    // Micro-bobbing on breath & high heels:
    hips.position.y = Math.sin(t * 2.4) * 0.005 - (1 - weightShiftAbs) * 0.01
    // Pelvic tilt on Z (engaged hip rises):
    hips.rotation.z = -weightShift * 0.075
    // Smooth body turn on Y:
    hips.rotation.y = turnAngle
    // Slight pelvic arch on X:
    hips.rotation.x = 0.04 + Math.sin(t * 1.6) * 0.015
  }

  // 2. Spine & Chest — Anatomical Counter-Poise (S-Curve)
  const spine = bone('spine')
  if (spine) {
    // Counter-tilt to balance head over feet:
    spine.rotation.z = (angles.torso ?? 0) + weightShift * 0.055
    // Counter-twist on Y:
    spine.rotation.y = -turnAngle * 0.32
    // Torso breathing:
    spine.rotation.x = Math.sin(t * 2.2) * 0.02
  }

  const chest = bone('chest')
  if (chest) {
    chest.rotation.z = weightShift * 0.035
    chest.rotation.y = -turnAngle * 0.28 + Math.sin(t * 1.1) * 0.035
    chest.rotation.x = 0.025 + Math.sin(t * 2.2) * 0.025
  }

  // 3. Neck & Head — Alluring Tilt & Camera Eye-Contact
  const neck = bone('neck')
  if (neck) {
    neck.rotation.y = -turnAngle * 0.35 + Math.sin(t * 0.9) * 0.04
    neck.rotation.z = -weightShift * 0.03
  }

  const head = bone('head')
  if (head) {
    // Expressive feminine head tilt (listening, charming engagement)
    const feminineTilt = -weightShift * 0.055 + 0.04 * Math.sin(t * 1.1)
    head.rotation.z = feminineTilt
    // Head turns to face the audience smoothly despite body 3/4 turn:
    head.rotation.y = (angles.head ?? 0) * 0.5 - turnAngle * 0.45 + Math.sin(t * 0.8) * 0.05
    head.rotation.x = (angles.head ?? 0) * 0.8 + 0.03 + Math.sin(t * 1.8) * 0.025
  }

  // 4. Arms & Hands
  const rightArm = bone('rightUpperArm')
  if (rightArm) {
    rightArm.rotation.z = -(angles.rightUpperArm ?? -0.06) - 1.2 + weightShift * 0.03
    rightArm.rotation.x = (angles.rightForearm ?? 0) * 0.5 + Math.sin(t * 1.4) * 0.03
  }
  const rightForearm = bone('rightLowerArm')
  if (rightForearm) rightForearm.rotation.y = (angles.rightForearm ?? 0) * 0.9
  const rightHand = bone('rightHand')
  if (rightHand) rightHand.rotation.z = (angles.rightHand ?? 0) * 0.8

  const leftArm = bone('leftUpperArm')
  if (leftArm) {
    leftArm.rotation.z = -(angles.leftUpperArm ?? 0.06) + 1.2 - weightShift * 0.03
    leftArm.rotation.x = (angles.leftForearm ?? 0) * 0.5 + Math.sin(t * 1.4) * 0.03
  }
  const leftForearm = bone('leftLowerArm')
  if (leftForearm) leftForearm.rotation.y = -(angles.leftForearm ?? 0) * 0.9
  const leftHand = bone('leftHand')
  if (leftHand) leftHand.rotation.z = -(angles.leftHand ?? 0) * 0.8

  // 5. Legs — Weight-Bearing Leg vs Relaxed Free Leg
  // When weightShift > 0: right leg is straight supporting body weight; left leg bends softly.
  // When weightShift < 0: left leg is straight supporting body weight; right leg bends softly.
  const leftLegRelax = Math.max(0, weightShift) // 0 to 1
  const rightLegRelax = Math.max(0, -weightShift) // 0 to 1

  const leftUpperLeg = bone('leftUpperLeg')
  if (leftUpperLeg) {
    leftUpperLeg.rotation.x = (angles.leftThigh ?? 0) + leftLegRelax * 0.09 - rightLegRelax * 0.02
    leftUpperLeg.rotation.y = turnAngle * 0.2 - leftLegRelax * 0.05
    leftUpperLeg.rotation.z = -0.04 + leftLegRelax * 0.04 - rightLegRelax * 0.03
  }
  const rightUpperLeg = bone('rightUpperLeg')
  if (rightUpperLeg) {
    rightUpperLeg.rotation.x = (angles.rightThigh ?? 0) + rightLegRelax * 0.09 - leftLegRelax * 0.02
    rightUpperLeg.rotation.y = turnAngle * 0.2 + rightLegRelax * 0.05
    rightUpperLeg.rotation.z = 0.04 - rightLegRelax * 0.04 + leftLegRelax * 0.03
  }

  const leftLowerLeg = bone('leftLowerLeg')
  if (leftLowerLeg) {
    leftLowerLeg.rotation.x = (angles.leftShin ?? 0) + leftLegRelax * 0.15
  }
  const rightLowerLeg = bone('rightLowerLeg')
  if (rightLowerLeg) {
    rightLowerLeg.rotation.x = (angles.rightShin ?? 0) + rightLegRelax * 0.15
  }

  // High heel foot inclination with stylish toe alignment:
  const leftFoot = bone('leftFoot')
  if (leftFoot) {
    leftFoot.rotation.x = -0.38 + (angles.leftFoot ?? 0) - leftLegRelax * 0.05
    leftFoot.rotation.y = leftLegRelax * 0.06
  }
  const rightFoot = bone('rightFoot')
  if (rightFoot) {
    rightFoot.rotation.x = -0.38 + (angles.rightFoot ?? 0) - rightLegRelax * 0.05
    rightFoot.rotation.y = -rightLegRelax * 0.06
  }
}

function setFace(
  vrm: VRM,
  t: number,
  emotion: string,
  blendFrom: string,
  blend: number,
  speaking: boolean,
): void {
  const expressions = vrm.expressionManager
  if (!expressions) return

  const setExpr = (name: string, val: number) => {
    try {
      expressions.setValue(name, Math.max(0, Math.min(1, val)))
    } catch {
      // Ignore unsupported expression names on specific VRM versions
    }
  }

  // 1. Natural Blinking with human micro-cadence
  const blinkCycle = ((t % 3.9) + 3.9) % 3.9
  const isBlink = blinkCycle < 0.12
  const blinkVal = isBlink ? Math.sin((blinkCycle / 0.12) * Math.PI) : 0
  setExpr('Blink', blinkVal)
  setExpr('blink', blinkVal)

  // 2. Active Lip Sync & Mouth Shapes during speech («تکان خوردن لب‌ها هنگام صحبت»)
  if (speaking) {
    // Multi-frequency syllable rhythms creating animated phonemes:
    const speechCadence =
      Math.sin(t * 18) * 0.55 + Math.sin(t * 11) * 0.35 + Math.cos(t * 24) * 0.15
    const mouthA = Math.max(0, speechCadence * 1.15)
    const mouthI = Math.max(0, Math.cos(t * 15) * 0.6)
    const mouthO = Math.max(0, Math.sin(t * 13) * 0.5)
    const mouthE = Math.max(0, Math.sin(t * 20) * 0.45)

    // Set both VRM 0.X uppercase names and VRM 1.0 lowercase presets:
    setExpr('A', mouthA)
    setExpr('aa', mouthA)
    setExpr('I', mouthI)
    setExpr('ih', mouthI)
    setExpr('O', mouthO)
    setExpr('oh', mouthO)
    setExpr('E', mouthE)
    setExpr('ee', mouthE)
  } else {
    setExpr('A', 0)
    setExpr('aa', 0)
    setExpr('I', 0)
    setExpr('ih', 0)
    setExpr('O', 0)
    setExpr('oh', 0)
    setExpr('E', 0)
    setExpr('ee', 0)
  }

  // 3. Charming Facial Expression & Allure («عشوه و لبخند گرم کاریزماتیک»)
  const joyOf = (e: string) =>
    ['excited', 'confident', 'happy'].includes(e)
      ? 0.75
      : ['concerned', 'tired'].includes(e)
        ? 0.05
        : 0.45
  const sorrowOf = (e: string) => (['concerned', 'tired'].includes(e) ? 0.7 : 0)
  const funOf = (e: string) => (['excited', 'confident', 'happy'].includes(e) ? 0.5 : 0.25)

  const curJoy = joyOf(blendFrom) + (joyOf(emotion) - joyOf(blendFrom)) * blend
  const curSorrow = sorrowOf(blendFrom) + (sorrowOf(emotion) - sorrowOf(blendFrom)) * blend
  const curFun = funOf(blendFrom) + (funOf(emotion) - funOf(blendFrom)) * blend

  setExpr('Joy', curJoy)
  setExpr('joy', curJoy)
  setExpr('happy', curJoy)
  setExpr('Fun', curFun)
  setExpr('fun', curFun)
  setExpr('relaxed', curFun)
  setExpr('Sorrow', curSorrow)
  setExpr('sorrow', curSorrow)
  setExpr('sad', curSorrow)

  expressions.update()
}

export function VrmAvatar({
  t,
  x,
  y,
  scale = 1.0,
  flip = false,
  gesture = 'idle',
  emotion = 'confident',
  speaking = false,
  walk = 'standing',
  target,
  crop = 'full',
  vrmUrl = '/avatars/girl.vrm',
  width,
  height,
  cameraFov = 30,
  acts,
  style,
  className,
}: VrmAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const isFull = crop === 'full'
  const resolvedWidth = width ?? (isFull ? 180 : 350)
  const resolvedHeight = height ?? (isFull ? 380 : 520)
  const resolvedX = x ?? (isFull ? 180 : 170)
  const resolvedY = y ?? (isFull ? 560 : 440)

  // What she is doing this second — decides the pose AND where she hangs on the page.
  const act: ActState = useMemo(
    () =>
      acts
        ? actAt(acts, t)
        : {
            gesture,
            emotion,
            speaking,
            presence: 'stand',
            since: t,
            previousGesture: gesture,
            previousEmotion: emotion,
            previousPresence: 'stand',
            previousSince: t,
            blend: 1,
          },
    [acts, t, gesture, emotion, speaking],
  )
  const lift = liftAt(act)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let alive = true

    const draw = () => {
      const stage = loadedAvatarStage(vrmUrl)
      const context = canvas.getContext('2d')
      if (!stage || !context) return

      const now = computeJointAngles(t, act.gesture, act.emotion, act.speaking, walk, target)
      const angles =
        act.blend < 1
          ? blendAngles(
              computeJointAngles(
                t,
                act.previousGesture,
                act.previousEmotion,
                act.speaking,
                walk,
                target,
              ),
              now,
              act.blend,
            )
          : now

      // Knees drawn up in the air: the hop and the float read as a body, not a sticker.
      const tucked: JointAngles = {
        ...angles,
        leftThigh: (angles.leftThigh ?? 0) + lift.tuck * 0.55,
        rightThigh: (angles.rightThigh ?? 0) + lift.tuck * 0.55,
        leftShin: (angles.leftShin ?? 0) + lift.tuck * 0.9,
        rightShin: (angles.rightShin ?? 0) + lift.tuck * 0.9,
      }

      poseBones(stage.vrm, tucked, t)
      setFace(stage.vrm, t, act.emotion, act.previousEmotion, act.blend, act.speaking)
      settleSprings(stage.vrm)

      frameAvatarStage(stage, {
        width: resolvedWidth,
        height: resolvedHeight,
        full: isFull,
        fov: cameraFov,
      })
      stage.renderer.render(stage.scene, stage.camera)

      // Copy the picture into this scene's own canvas, at the renderer's density.
      const ratio = stage.renderer.getPixelRatio()
      const pixelsWide = Math.round(resolvedWidth * ratio)
      const pixelsHigh = Math.round(resolvedHeight * ratio)
      if (canvas.width !== pixelsWide || canvas.height !== pixelsHigh) {
        canvas.width = pixelsWide
        canvas.height = pixelsHigh
      }
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(stage.renderer.domElement, 0, 0, canvas.width, canvas.height)
    }

    if (loadedAvatarStage(vrmUrl)) {
      draw()
    } else {
      // First scene to ask pays for the file; the others find it loaded.
      loadAvatarStage(vrmUrl).then(
        () => {
          if (alive) draw()
        },
        () => undefined,
      )
    }

    return () => {
      alive = false
    }
  }, [t, act, lift.tuck, walk, target, vrmUrl, isFull, cameraFov, resolvedWidth, resolvedHeight])

  return (
    <div
      className={className}
      style={{
        position: 'absolute',
        left: resolvedX,
        top: resolvedY,
        width: resolvedWidth,
        height: resolvedHeight,
        pointerEvents: 'none',
        // Lifted off the page, leaning, squashed on landing — squash is about her feet.
        transform: `translateY(${(-lift.up + (1 - lift.squash) * resolvedHeight).toFixed(2)}px) rotate(${lift.tilt.toFixed(4)}rad) scale(${scale}) scaleY(${lift.squash.toFixed(3)}) ${flip ? 'scaleX(-1)' : ''}`,
        transformOrigin: '50% 0%',
        overflow: 'hidden',
        zIndex: 25,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        width={resolvedWidth}
        height={resolvedHeight}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default VrmAvatar
