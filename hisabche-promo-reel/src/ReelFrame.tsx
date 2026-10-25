import { clamp, ease, mix, progress } from './engine/anim'
import { getReelRegistryEntry } from './data/reel-registry'
import type { Reel } from './engine/types'
import { SceneView } from './scenes'

const W = 540
const H = 960
const FADE_IN = 0.28
const FADE_OUT = 0.16

export function ReelFrame({ reel, t }: { reel: Reel; t: number }) {
  const index = reel.scenes.findIndex((scene) => t >= scene.start && t < scene.end)
  const scene = reel.scenes[index === -1 ? reel.scenes.length - 1 : index]!
  const local = t - scene.start
  const fadeIn = index <= 0 ? 1 : ease(progress(local, 0, FADE_IN))
  const isLast = index === reel.scenes.length - 1 || index === -1
  const fadeOut = isLast
    ? 1
    : 1 - ease(progress(local, scene.end - scene.start - FADE_OUT, FADE_OUT))

  const enterMotion = index <= 0 ? 1 : ease(progress(local, 0, FADE_IN * 1.2))
  const translateY = reel.noZoom || index <= 0 ? 0 : mix(10, 0, enterMotion)
  const scale = reel.noZoom || index <= 0 ? 1 : mix(0.985, 1, enterMotion)

  const registry = (() => {
    try {
      return getReelRegistryEntry(reel.id)
    } catch {
      return null
    }
  })()
  const theme = scene.spec.theme ?? reel.theme ?? registry?.themeName ?? 'obsidian-cinematic'
  const artDirection = registry?.artDirection ?? 'cinematic-obsidian'
  const layoutTopology = registry?.layoutTopology ?? 'single-column'
  const openingArchetype = registry?.openingArchetype

  const sceneWithArchetype =
    scene.spec.kind === 'hook' && !scene.spec.openingArchetype && openingArchetype
      ? { ...scene, spec: { ...scene.spec, openingArchetype } }
      : scene

  return (
    <div
      className={`frame theme-${theme} art-${artDirection} topology-${layoutTopology.replace('.', '-')}`}
      data-reel-id={reel.id}
      data-art-direction={artDirection}
      data-layout-topology={layoutTopology}
      style={{ width: W, height: H }}
    >
      <div className="bg-glow" />
      <div className="bg-grid" />
      <div
        key={`${reel.id}-${index}`}
        className="scene-wrap"
        style={{
          opacity: clamp(fadeIn * fadeOut),
          transform: `translateY(${translateY}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <SceneView scene={sceneWithArchetype} t={local} scenes={reel.scenes} />
      </div>
    </div>
  )
}
