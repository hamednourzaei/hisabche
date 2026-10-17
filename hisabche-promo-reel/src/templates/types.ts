// ============================================
// Hisabche 2026 Master Viral Template Archetypes
// 12 High-Retention Motion Graphics Frameworks for SaaS Conversion
// ============================================

export type ViralTemplateId =
  | 'tactile-train-scroll'
  | 'thermal-receipt-scroll'
  | 'infinite-spatial-board'
  | 'vox-documentary-collage'
  | 'minimal-vector-philosophy'
  | 'chat-panic-to-calm'
  | 'liquid-glass-spatial'
  | 'kinetic-color-block'
  | 'split-screen-stopwatch'
  | 'isometric-exploded-ui'
  | 'continuous-line-traveler'
  | 'swiss-financial-terminal'
  | 'premium-motion-graphics'

export interface TemplateMetadata {
  id: ViralTemplateId
  titleFa: string
  titleEn: string
  whyViral: string
  motionMechanism: string
  soundPalette: string[]
  recommendedPainCategory: string
  cadence: 'high-velocity' | 'rhythmic-editorial' | 'hypnotic-calm' | 'tension-race'
}

export interface TemplateSceneProps {
  t: number
  title?: string
  subtitle?: string
  children?: React.ReactNode
  accentColor?: string
  style?: React.CSSProperties
  className?: string
}
