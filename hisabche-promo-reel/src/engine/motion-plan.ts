// src/engine/motion-plan.ts
// Motion Plan — the per-scene contract that DRIVES rendering.
//
// `planSceneMotion()` turns what the scene actually says (content scan) and
// what the scene is for (narrative role, from kind + position in the reel)
// into a plan. `SceneView` applies the plan on every rendered frame:
//
//   * plan.metaphor  → <MetaphorLayer> (animated background metaphor, on screen)
//   * plan.camera    → camera wrapper (always on, never scale 1:1 — no slides)
//   * plan.intensity → scales camera amplitude — settings change real output
//   * plan.soundEvents → merged into SceneView's cue list → real SFX on export
//
// Fields with no output effect do not exist here. Selection is deterministic:
// same scene + same content ⇒ same plan (no randomness, no Math.random).
// ============================================

import { DEFAULT_MOTION_CONFIG, intensityMultiplier } from './motion-config'
import type { SoundKind } from './sound'
import type { Reel, Scene, Tone } from './types'

export type NarrativeRole =
  'hook' | 'problem' | 'evidence' | 'solution' | 'payoff' | 'cta' | 'context'

export type MotionMetaphorName =
  | 'warning-impact'
  | 'silent-leak'
  | 'rising-chart'
  | 'opposition'
  | 'transformation'
  | 'question-shake'
  | 'attention-ripple'

export type CameraMotion = {
  /** Scale at scene start (never 1.0 — a static camera IS a slide). */
  from: number
  /** Final scale by scene end. */
  to: number
  /** Horizontal drift in % of frame width over the scene. */
  panX: number
  /** Vertical drift in % of frame height over the scene. */
  panY: number
}

export type MotionPlan = {
  sceneId: string
  role: NarrativeRole
  visualGoal: string
  primaryMotion: string
  secondaryMotion: string
  typographyMotion: string
  camera: CameraMotion
  metaphor: MotionMetaphorName | null
  /** A second metaphor rendered alongside the first (e.g. hook impact + unknown shake). */
  secondaryMetaphor: MotionMetaphorName | null
  metaphorTone: Tone
  transition: 'cut' | 'swipe' | 'dissolve' | 'glitch' | 'zoom'
  intensity: 'subtle' | 'dynamic' | 'high'
  /** Seconds (local scene time) the main message must stay readable. */
  readabilityWindow: [number, number]
  soundEvents: { at: number; kind: SoundKind }[]
  reason: string
}

// ─── Content scanning (drives metaphor selection) ────────────────────────

const UNKNOWN_PATTERNS = ['نامعلوم', 'نا مشخص', 'معلوم نیست']
const WARNING_PATTERNS = [
  'هشدار',
  'خطا',
  'اشتباه',
  'قطع',
  'گم شد',
  'ندارید',
  'نمی‌دانید',
  'کسری',
  'سقوط',
  'نشت',
]
const LEAK_PATTERNS = ['نشت', 'پنهان', 'کم می‌شود', 'کم‌تر']
const GROWTH_PATTERNS = ['سود', 'رشد', 'افزایش', 'درآمد', 'فروش', 'درصد']

function specText(scene: Scene): string {
  const spec = scene.spec as unknown as Record<string, unknown>
  const parts: string[] = []
  const push = (v: unknown) => {
    if (typeof v === 'string') parts.push(v)
  }
  for (const key of [
    'title',
    'line',
    'sub',
    'question',
    'promise',
    'claim',
    'cta',
    'headline',
    'label',
    'left',
    'right',
    'name',
  ]) {
    push(spec[key])
  }
  push(scene.vo)
  for (const listKey of ['lines', 'cards', 'items', 'steps', 'rows']) {
    const list = spec[listKey]
    if (!Array.isArray(list)) continue
    for (const entry of list) {
      if (typeof entry === 'string') parts.push(entry)
      else if (entry && typeof entry === 'object') {
        const row = entry as Record<string, unknown>
        for (const key of ['title', 'sub', 'text', 'left', 'right', 'name', 'label', 'value'])
          push(row[key])
      }
    }
  }
  return parts.join(' ')
}

const contains = (text: string, patterns: readonly string[]) =>
  patterns.some((p) => text.includes(p))

// ─── Narrative role (from scene kind + position in the reel) ─────────────

const EVIDENCE_KINDS = [
  'mockup',
  'ledger',
  'chart',
  'queue',
  'word-sync',
  'cinematic-product',
  'offline-sync-demo',
  'profit-waterfall-demo',
  'warehouse-movement-demo',
  'dual-perspective-demo',
  'fragmented-tools-demo',
  'financial-intelligence',
]

/** Kind-only role, used when the reel context is unknown (single-scene render). */
function roleOfKind(kind: string): NarrativeRole {
  if (kind === 'hook') return 'hook'
  if (kind === 'cta') return 'cta'
  if (EVIDENCE_KINDS.includes(kind)) return 'evidence'
  if (kind === 'versus' || kind === 'split' || kind === 'compare' || kind === 'dialogue')
    return 'solution'
  if (kind === 'day' || kind === 'bridge' || kind === 'stagger' || kind === 'hub') return 'context'
  return 'solution'
}

export function narrativeRoleOf(scene: Scene, scenes: readonly Scene[]): NarrativeRole {
  // Without reel context (a lone SceneView render), fall back to kind only —
  // a single scene must never be mislabelled "hook" just because it is alone.
  if (scenes.length <= 1) return roleOfKind(scene.spec.kind)
  const index = scenes.indexOf(scene)
  if (index === -1) return roleOfKind(scene.spec.kind)
  const last = scenes.length - 1
  if (index === 0) return 'hook'
  if (index === last) return 'cta'
  if (index === last - 1) return 'payoff'
  if (index === 1) return 'problem'
  return roleOfKind(scene.spec.kind)
}

// ─── The generator ───────────────────────────────────────────────────────

const ROLE_CAMERA: Record<NarrativeRole, CameraMotion> = {
  // A hook pushes IN hard — the camera must never rest on frame 0.
  hook: { from: 1.06, to: 1.14, panX: 1.2, panY: -0.8 },
  problem: { from: 1.03, to: 1.1, panX: -1.0, panY: 0.6 },
  // Evidence (UI mockups) get the strongest push-in: prove the product.
  evidence: { from: 1.04, to: 1.16, panX: 1.4, panY: -1.0 },
  solution: { from: 1.02, to: 1.09, panX: 1.0, panY: 0.8 },
  payoff: { from: 1.02, to: 1.12, panX: 0, panY: -1.2 },
  cta: { from: 1.03, to: 1.08, panX: 0, panY: 0 },
  context: { from: 1.02, to: 1.07, panX: -0.8, panY: 0.5 },
}

function metaphorFor(
  role: NarrativeRole,
  text: string,
  kind: string,
): { primary: MotionMetaphorName | null; secondary: MotionMetaphorName | null } {
  const unknown = contains(text, UNKNOWN_PATTERNS)
  // Hook: impact/chart metaphor is the primary statement, the unknown value shakes beside it.
  if (role === 'hook') {
    const primary = contains(text, LEAK_PATTERNS)
      ? 'silent-leak'
      : contains(text, GROWTH_PATTERNS)
        ? 'rising-chart'
        : 'warning-impact'
    return { primary, secondary: unknown ? 'question-shake' : null }
  }
  // Content first: an unknown value gets the question-shake wherever it appears.
  if (unknown) return { primary: 'question-shake', secondary: null }
  if (contains(text, WARNING_PATTERNS)) return { primary: 'warning-impact', secondary: null }
  switch (role) {
    case 'problem':
      return {
        primary: contains(text, LEAK_PATTERNS) ? 'silent-leak' : 'warning-impact',
        secondary: null,
      }
    case 'evidence':
      return { primary: null, secondary: null }
    case 'solution':
      return {
        primary: kind === 'versus' || kind === 'dialogue' ? 'opposition' : null,
        secondary: null,
      }
    case 'payoff':
      return { primary: 'transformation', secondary: null }
    case 'cta':
      return { primary: 'attention-ripple', secondary: null }
    case 'context':
      return { primary: null, secondary: null }
    default:
      return { primary: null, secondary: null }
  }
}

function transitionFor(role: NarrativeRole, index: number): MotionPlan['transition'] {
  // Alternate so consecutive scenes never share the same transition family.
  if (role === 'hook') return 'cut'
  if (role === 'evidence') return index % 2 === 0 ? 'swipe' : 'dissolve'
  if (role === 'payoff') return 'zoom'
  if (role === 'problem') return 'glitch'
  return index % 2 === 0 ? 'dissolve' : 'swipe'
}

export function planSceneMotion(scene: Scene, scenes: readonly Scene[] = [scene]): MotionPlan {
  const role = narrativeRoleOf(scene, scenes)
  const kind = scene.spec.kind
  const index = scenes.indexOf(scene)
  const text = specText(scene)
  const hasUnknown = contains(text, UNKNOWN_PATTERNS)
  const duration = scene.end - scene.start
  const intensity = DEFAULT_MOTION_CONFIG.motionIntensity
  const { primary: rawMetaphor, secondary: rawSecondaryMetaphor } = metaphorFor(role, text, kind)

  const disableZoom = Boolean(scene.noZoom)

  const metaphor = rawMetaphor
  const secondaryMetaphor = rawSecondaryMetaphor

  // Intensity scales camera amplitude so settings genuinely change output.
  const amp = intensityMultiplier(intensity)
  const base = ROLE_CAMERA[role]
  const camera: CameraMotion = disableZoom
    ? { from: 1, to: 1, panX: 0, panY: 0 }
    : {
        from: 1 + (base.from - 1) * amp,
        to: 1 + (base.to - 1) * amp,
        panX: base.panX * amp,
        panY: base.panY * amp,
      }

  const primaryMotion =
    metaphor === 'warning-impact'
      ? 'impact-ripple'
      : metaphor === 'silent-leak'
        ? 'leak-drift'
        : metaphor === 'rising-chart'
          ? 'chart-rise'
          : metaphor === 'opposition'
            ? 'opposing-tilt'
            : metaphor === 'transformation'
              ? 'value-transform'
              : metaphor === 'question-shake'
                ? 'question-shake'
                : 'entrance-spring'

  return {
    sceneId: `${kind}-${index}`,
    role,
    visualGoal:
      role === 'hook'
        ? 'frame-0-arrest'
        : role === 'evidence'
          ? 'prove-product'
          : role === 'payoff'
            ? 'reveal-value'
            : role === 'cta'
              ? 'invite-action'
              : 'carry-story',
    primaryMotion,
    secondaryMotion: 'breathing-text',
    typographyMotion: 'entrance-spring + breathing (no static hold > 1.2s)',
    camera,
    metaphor,
    secondaryMetaphor,
    metaphorTone:
      role === 'problem' || role === 'hook' ? 'red' : role === 'payoff' ? 'green' : 'cyan',
    transition: transitionFor(role, index),
    intensity,
    readabilityWindow: [Math.min(duration * 0.3, 1.4), Math.max(duration * 0.85, duration - 0.4)],
    soundEvents: metaphor === 'warning-impact' ? [{ at: 0.25, kind: 'impact' }] : [],
    reason:
      `role=${role}; content=${hasUnknown ? 'unknown-value' : contains(text, WARNING_PATTERNS) ? 'warning' : 'neutral'}; ` +
      `metaphor=${metaphor ?? 'none'} chosen for ${kind} at index ${index}`,
  }
}

/** Convenience: plan for every scene of a reel. */
export function planReelMotion(reel: Reel): MotionPlan[] {
  return reel.scenes.map((scene) => planSceneMotion(scene, reel.scenes))
}
