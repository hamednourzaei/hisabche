// src/avatars/vrm-avatar/vrm-shared.ts
//
// ONE avatar for the whole film.
//
// The model is a 47 MB .vrm. Each scene used to mount its own component, and
// each component fetched, parsed and uploaded it again with a renderer of its
// own — five times in a reel, with a cache that was written and never read.
//
// Here the file is fetched once per page, one renderer and one scene hold the
// model, and every scene only POSES it and copies the picture into its own
// canvas. The exporter waits on `__REEL_MEDIA_PENDING`, so the first frame is
// never drawn before the model is there.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, type VRM } from '@pixiv/three-vrm'

const PENDING = '__REEL_MEDIA_PENDING'
type PendingSet = Set<Promise<void>>

function pendingSet(): PendingSet {
  const g = globalThis as unknown as Record<string, PendingSet | undefined>
  const existing = g[PENDING]
  if (existing) return existing
  const created: PendingSet = new Set()
  g[PENDING] = created
  return created
}

export interface AvatarStage {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  vrm: VRM
}

export interface AvatarView {
  width: number
  height: number
  /** Head-to-heels, or a closer shot of the upper body. */
  full: boolean
  fov: number
}

const loading = new Map<string, Promise<AvatarStage>>()
const loaded = new Map<string, AvatarStage>()

/** The stage, only if the model has already arrived. */
export function loadedAvatarStage(url: string): AvatarStage | undefined {
  return loaded.get(url)
}

function addStudioLights(scene: THREE.Scene): void {
  scene.add(new THREE.AmbientLight(0xfff5ea, 1.3))

  // Key light (top-front-right)
  const key = new THREE.DirectionalLight(0xffede0, 2.2)
  key.position.set(1.5, 2.8, 2.8)
  scene.add(key)

  // Warm fill (front-left)
  const fill = new THREE.DirectionalLight(0xfdba74, 1.2)
  fill.position.set(-2.0, 1.5, 2.0)
  scene.add(fill)

  // Cyan rim, the product's edge colour, from behind
  const rim = new THREE.DirectionalLight(0x38bdf8, 1.8)
  rim.position.set(0.0, 3.0, -2.5)
  scene.add(rim)

  // Floor bounce, a gentle warm light up onto the heels
  const bounce = new THREE.DirectionalLight(0xff3b5c, 0.85)
  bounce.position.set(0.0, -1.0, 1.8)
  scene.add(bounce)
}

function styleHeels(vrm: VRM): void {
  const heel = new THREE.MeshPhysicalMaterial({
    color: 0xb91c1c,
    roughness: 0.18,
    metalness: 0.12,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  })
  vrm.scene.traverse((object) => {
    if (!(object as THREE.Mesh).isMesh) return
    const mesh = object as THREE.Mesh
    const name = mesh.name.toLowerCase()
    if (['shoe', 'boot', 'heel', 'foot', 'sole'].some((part) => name.includes(part))) {
      mesh.material = heel
    }
  })
}

async function buildStage(url: string): Promise<AvatarStage> {
  const renderer = new THREE.WebGLRenderer({
    canvas: document.createElement('canvas'),
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08

  const scene = new THREE.Scene()
  addStudioLights(scene)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20)

  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  const gltf = await loader.loadAsync(url)
  const vrm = gltf.userData.vrm as VRM | undefined
  if (!vrm) throw new Error(`The file at ${url} is not a VRM model`)

  // The model faces away from the camera as exported.
  vrm.scene.rotation.y = Math.PI
  styleHeels(vrm)
  scene.add(vrm.scene)

  return { renderer, scene, camera, vrm }
}

/**
 * Start (once) and return the shared stage. Every caller gets the same
 * promise, so a second scene never fetches the file again.
 */
export function loadAvatarStage(url: string): Promise<AvatarStage> {
  const existing = loading.get(url)
  if (existing) return existing

  const created = buildStage(url)
  loading.set(url, created)

  // The exporter awaits this set before it captures a frame.
  const settled = created.then(
    (stage) => {
      loaded.set(url, stage)
    },
    (error: unknown) => {
      loading.delete(url)
      console.warn('Failed to load VRM model from:', url, error)
    },
  )
  pendingSet().add(settled)

  return created
}

/** Point the shared camera and renderer at one scene's box. */
export function frameAvatarStage(stage: AvatarStage, view: AvatarView): void {
  const { renderer, camera } = stage
  const size = renderer.getSize(new THREE.Vector2())
  if (size.x !== view.width || size.y !== view.height) {
    renderer.setSize(view.width, view.height)
  }

  // Full body: head to heels with room above for a raised hand (model ~1.75 m,
  // a pointing hand reaches ~2.05 m). Close shot: head and shoulders.
  const camY = view.full ? 0.95 : 1.35
  const camZ = view.full ? 4.8 : 2.4
  const lookY = view.full ? 0.95 : 1.32

  camera.fov = view.fov
  camera.aspect = view.width / view.height
  camera.position.set(0, camY, camZ)
  camera.lookAt(0, lookY, 0)
  camera.updateProjectionMatrix()
}

/** One step of the model's hair and cloth, in seconds. */
const SPRING_STEP = 1 / 30

/**
 * Hair and cloth for THIS pose, the same every time.
 *
 * Springs remember where they were, and the exporter seeks: the same second
 * reached from two different places would hang the hair two different ways.
 * So the springs are put back to rest and let settle for a few fixed steps
 * under the pose that was just applied — a function of the pose alone.
 */
export function settleSprings(vrm: VRM): void {
  // The springs rest against where the bones ARE, so the new pose must reach the
  // world matrices first — otherwise they would rest against the previous frame's.
  vrm.humanoid.update()
  vrm.scene.updateMatrixWorld(true)
  vrm.springBoneManager?.reset()
  for (let i = 0; i < 4; i += 1) vrm.update(SPRING_STEP)
}
