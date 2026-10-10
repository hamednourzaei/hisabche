// packages/ui/src/components/ui/landing/three/runtime.ts
//
// What the ten landing variants share of Three.js: a renderer, a way to free
// it, and the design tokens as colours. It builds NO object — every mesh, light
// and camera move belongs to the variant that draws it (`variants/NN-…/scene.ts`).
//
// Plain `three`, not a React renderer: a scroll-driven scene changes every
// frame, and a scene held in React state would re-render the page every frame.
//
// ⚠️ This module imports `three`. It is only ever reached through the dynamic
// import in `scene-canvas.tsx`, so the library is not in the first paint.

import * as THREE from 'three'

export type ViewportMode = 'mobile' | 'tablet' | 'desktop'

export interface SceneRuntime {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  mode: ViewportMode
  /** A design token (`--color-primary`) as a colour. Never a literal hex. */
  color: (token: string) => THREE.Color
  render: () => void
  dispose: () => void
}

const MOBILE_MAX = 767
const TABLET_MAX = 1279

export function viewportMode(width: number): ViewportMode {
  if (width <= MOBILE_MAX) return 'mobile'
  if (width <= TABLET_MAX) return 'tablet'
  return 'desktop'
}

/** A throwaway context: is WebGL there at all? */
export function isWebGLAvailable(): boolean {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'))
  } catch {
    return false
  }
}

/**
 * Tokens are stored as bare `H S% L%` triples (see `globals.css`), which no
 * colour parser accepts on its own.
 */
function readToken(host: Element, token: string): THREE.Color {
  const value = getComputedStyle(host).getPropertyValue(token).trim()
  const [h, s, l] = value.split(/\s+/).map((part) => Number.parseFloat(part))
  const color = new THREE.Color()
  if (h === undefined || s === undefined || l === undefined) return color
  if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) return color
  return color.setHSL(h / 360, s / 100, l / 100, THREE.SRGBColorSpace)
}

export function createSceneRuntime(canvas: HTMLCanvasElement): SceneRuntime {
  const mode = viewportMode(window.innerWidth)
  const cores = navigator.hardwareConcurrency ?? 4
  const light = mode === 'mobile' || cores <= 4

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !light,
    alpha: true,
    powerPreference: light ? 'low-power' : 'high-performance',
  })
  // No post-processing anywhere: one extra full-screen pass per frame is the
  // quickest way for a landing page to lose its interaction budget.
  renderer.setPixelRatio(Math.min(light ? 1.25 : 1.75, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(canvas)

  return {
    renderer,
    scene,
    camera,
    mode,
    color: (token) => readToken(canvas, token),
    render: () => renderer.render(scene, camera),
    dispose: () => {
      observer.disconnect()
      disposeScene(scene)
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}

/** Free every geometry, material and texture under `root`, each exactly once. */
export function disposeScene(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()

  root.traverse((child) => {
    const drawn = child as Partial<THREE.Mesh>
    if (drawn.geometry) geometries.add(drawn.geometry)
    const material = drawn.material
    if (Array.isArray(material)) material.forEach((item) => materials.add(item))
    else if (material) materials.add(material)
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => {
    for (const value of Object.values(material)) {
      if (value instanceof THREE.Texture) value.dispose()
    }
    material.dispose()
  })
}
