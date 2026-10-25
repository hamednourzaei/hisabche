// src/engine/motion-config.ts
// Central motion configuration for the Global Motion System.
// Every scene inherits a default motion from this config unless explicitly overridden.

export type MotionIntensity = 'subtle' | 'dynamic' | 'high'

export interface MotionPreset {
  duration: number
  delay: number
  easing: string
  direction: 'up' | 'down' | 'left' | 'right' | 'center' | 'none'
  distance: number
  scale: number
  staggerInterval: number
  intensity: number
  reducedMotionFallback: 'none' | 'fade' | 'static'
}

export const MOTION_PRESETS: Record<string, MotionPreset> = {
  snap: {
    duration: 0.15,
    delay: 0,
    easing: 'easeOutExpo',
    direction: 'center',
    distance: 0,
    scale: 1.02,
    staggerInterval: 0,
    intensity: 0.3,
    reducedMotionFallback: 'fade',
  },
  spring: {
    duration: 0.6,
    delay: 0,
    easing: 'studioSpring',
    direction: 'up',
    distance: 24,
    scale: 0.94,
    staggerInterval: 0,
    intensity: 0.6,
    reducedMotionFallback: 'fade',
  },
  overshoot: {
    duration: 0.7,
    delay: 0,
    easing: 'studioSpring',
    direction: 'up',
    distance: 30,
    scale: 0.88,
    staggerInterval: 0,
    intensity: 0.7,
    reducedMotionFallback: 'fade',
  },
  stagger: {
    duration: 0.5,
    delay: 0,
    easing: 'ease',
    direction: 'up',
    distance: 20,
    scale: 0.95,
    staggerInterval: 0.08,
    intensity: 0.5,
    reducedMotionFallback: 'fade',
  },
  reveal: {
    duration: 0.45,
    delay: 0,
    easing: 'ease',
    direction: 'up',
    distance: 0,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.4,
    reducedMotionFallback: 'fade',
  },
  wipe: {
    duration: 0.45,
    delay: 0,
    easing: 'ease',
    direction: 'up',
    distance: 0,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.4,
    reducedMotionFallback: 'fade',
  },
  tracking: {
    duration: 0.3,
    delay: 0,
    easing: 'ease',
    direction: 'none',
    distance: 0,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.3,
    reducedMotionFallback: 'static',
  },
  focus: {
    duration: 0.4,
    delay: 0,
    easing: 'ease',
    direction: 'center',
    distance: 0,
    scale: 1.05,
    staggerInterval: 0,
    intensity: 0.5,
    reducedMotionFallback: 'fade',
  },
  impact: {
    duration: 0.2,
    delay: 0,
    easing: 'easeOutExpo',
    direction: 'center',
    distance: 0,
    scale: 1.15,
    staggerInterval: 0,
    intensity: 0.8,
    reducedMotionFallback: 'fade',
  },
  float: {
    duration: 2.0,
    delay: 0,
    easing: 'ease',
    direction: 'none',
    distance: 4,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.2,
    reducedMotionFallback: 'static',
  },
  parallax: {
    duration: 4.0,
    delay: 0,
    easing: 'ease',
    direction: 'none',
    distance: 8,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.15,
    reducedMotionFallback: 'static',
  },
  draw: {
    duration: 1.0,
    delay: 0,
    easing: 'ease',
    direction: 'none',
    distance: 0,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.4,
    reducedMotionFallback: 'fade',
  },
  counter: {
    duration: 1.4,
    delay: 0,
    easing: 'ease',
    direction: 'none',
    distance: 0,
    scale: 1,
    staggerInterval: 0,
    intensity: 0.5,
    reducedMotionFallback: 'fade',
  },
}

export interface MotionConfig {
  motionIntensity: MotionIntensity
  typographyMotion: boolean
  cameraMotion: boolean
  backgroundMotion: boolean
  uiMotion: boolean
  sfxEnabled: boolean
  motionVariation: number // 0..1
  readabilityPriority: number // 0..1
  reducedMotion: boolean
}

export const DEFAULT_MOTION_CONFIG: MotionConfig = {
  motionIntensity: 'dynamic',
  typographyMotion: true,
  cameraMotion: true,
  backgroundMotion: true,
  uiMotion: true,
  sfxEnabled: true,
  motionVariation: 0.7,
  readabilityPriority: 0.8,
  reducedMotion: false,
}

export function intensityMultiplier(intensity: MotionIntensity): number {
  switch (intensity) {
    case 'subtle':
      return 0.5
    case 'dynamic':
      return 1.0
    case 'high':
      return 1.4
  }
}

export function resolvePreset(
  name: string,
  config: MotionConfig = DEFAULT_MOTION_CONFIG,
): MotionPreset {
  const base = MOTION_PRESETS[name] ?? MOTION_PRESETS.spring
  const mult = intensityMultiplier(config.motionIntensity)
  if (config.reducedMotion) {
    return {
      ...base,
      intensity: 0,
      distance: 0,
      scale: 1,
      staggerInterval: 0,
      reducedMotionFallback: 'static',
    }
  }
  return {
    ...base,
    intensity: base.intensity * mult,
    distance: base.distance * mult,
    scale: base.scale,
  }
}
