// src/avatars/founder-rig/types.ts
// Architectural contract for the Hisabche Modular Full-Body Avatar Rig

export type Emotion =
  | 'confident'
  | 'confused'
  | 'concerned'
  | 'tired'
  | 'excited'
  | 'talking'
  | 'surprised'
  | 'neutral'
  | 'happy'
  | 'thinking'

export type GazeDirection = 'forward' | 'left' | 'right' | 'up' | 'down'

export type Gesture =
  | 'idle'
  | 'point-right'
  | 'point-left'
  | 'point-up'
  | 'shrug'
  | 'thumbs-up'
  | 'arms-crossed'
  | 'hands-on-head'
  | 'talk'
  | 'click-link'
  | 'wave'
  | 'think'
  | 'celebrate'

export type WalkState = 'standing' | 'walking' | 'stepping'

export interface TargetCoord {
  x: number
  y: number
}

export interface AvatarRigProps {
  t: number
  x?: number
  y?: number
  scale?: number
  flip?: boolean // flip horizontal (mirror)
  gender?: 'male' | 'female' // 'male' (Hisabche founder) or 'female' (Old Money lady with exposed legs & red heels)
  crop?: 'waist-up' | 'full' // Framing: waist-up or full-body
  modelMode?: 'svg' | 'vrm' // 2D Vector Rig or 3D VRM Engine via @pixiv/three-vrm
  emotion?: Emotion
  gesture?: Gesture
  gaze?: GazeDirection
  walk?: WalkState
  speaking?: boolean
  glasses?: boolean // Warm apricot tinted stylish sunglasses
  target?: TargetCoord // Target-aware pointing coordinates
  prop?: 'none' | 'phone' | 'link-pointer' | 'invoice'
  style?: React.CSSProperties
  className?: string
}

export interface JointAngles {
  // Radian properties consumed by avatar-rig (readAngles)
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

  // Aliases and legacy fields for compatibility
  headAngle?: number
  torsoAngle?: number
  leftArm?: number
  rightArm?: number
  leftLeg?: number
  rightLeg?: number
  headTilt?: number
  headTurn?: number
  mouthOpen?: number
  eyebrowY?: number
  leftShoulder?: number
  leftElbow?: number
  rightShoulder?: number
  rightElbow?: number
  torsoLean?: number
  leftHip?: number
  leftKnee?: number
  rightHip?: number
  rightKnee?: number
}
