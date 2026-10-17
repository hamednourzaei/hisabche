import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { clamp, ease, mix, progress } from './engine/anim'
import { play, setMuted } from './engine/sound'
import { getReelRegistryEntry } from './data/reel-registry'
import type { Reel } from './engine/types'
import { REELS } from './reels'
import { SceneView, reelCues } from './scenes'

const W = 540
const H = 960
const FADE_IN = 0.28
const FADE_OUT = 0.16

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

function Frame({ reel, t }: { reel: Reel; t: number }) {
  const index = reel.scenes.findIndex((scene) => t >= scene.start && t < scene.end)
  const scene = reel.scenes[index === -1 ? reel.scenes.length - 1 : index]!
  const local = t - scene.start
  const fadeIn = index <= 0 ? 1 : ease(progress(local, 0, FADE_IN))
  const isLast = index === reel.scenes.length - 1 || index === -1
  const fadeOut = isLast
    ? 1
    : 1 - ease(progress(local, scene.end - scene.start - FADE_OUT, FADE_OUT))

  // Hard Rule 2 & 3: Intentional directional motion on scene transitions (subtle Y rise & depth)
  const enterMotion = index <= 0 ? 1 : ease(progress(local, 0, FADE_IN * 1.2))
  const translateY = index <= 0 ? 0 : mix(10, 0, enterMotion)
  const scale = index <= 0 ? 1 : mix(0.985, 1, enterMotion)

  const registry = getReelRegistryEntry(reel.id)
  const theme = scene.spec.theme ?? reel.theme ?? registry.themeName
  const artDirection = registry.artDirection
  const layoutTopology = registry.layoutTopology

  // Inherit opening archetype from registry if not explicitly defined on scene spec
  const sceneWithArchetype =
    scene.spec.kind === 'hook' && !scene.spec.openingArchetype && registry.openingArchetype
      ? { ...scene, spec: { ...scene.spec, openingArchetype: registry.openingArchetype } }
      : scene

  return (
    <div
      className={`frame theme-${theme} art-${artDirection} topology-${layoutTopology.replace('.', '-')}`}
      data-reel-id={reel.id}
      data-art-direction={artDirection}
      data-layout-topology={layoutTopology}
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
        <SceneView scene={sceneWithArchetype} t={local} />
      </div>
    </div>
  )
}

// ?reel=01&t=3.5&frame — open a reel at a moment; `frame` shows only the frame.
const params = new URLSearchParams(window.location.search)
const START_REEL = Math.max(
  0,
  REELS.findIndex((r) => r.id === params.get('reel')),
)
const START_T = Number(params.get('t')) || 0
const START_FRAME = params.has('frame')

export function App() {
  const [reelIndex, setReelIndex] = useState(START_REEL)
  const reel = REELS[reelIndex]!
  const cues = useMemo(() => reelCues(reel), [reel])
  const [t, setT] = useState(START_T)
  const [playing, setPlaying] = useState(false)
  const [muted, setMutedState] = useState(false)
  const [showVo, setShowVo] = useState(true)
  const [cinema, setCinema] = useState(START_FRAME)
  const [exact, setExact] = useState(params.has('exact'))
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })

  const time = useRef(START_T)
  const last = useRef<number | null>(null)

  useEffect(() => setMuted(muted), [muted])

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const seek = useCallback(
    (to: number) => {
      time.current = clamp(to, 0, reel.duration)
      last.current = null
      setT(time.current)
    },
    [reel.duration],
  )

  useEffect(() => {
    if (typeof window !== 'undefined') {
      ;(window as unknown as { __SEEK_REEL?: (to: number) => void }).__SEEK_REEL = seek
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as unknown as { __SEEK_REEL?: (to: number) => void }).__SEEK_REEL
      }
    }
  }, [seek])

  // The clock. Sounds fire only when the clock CROSSES a cue while playing.
  useEffect(() => {
    if (!playing) {
      last.current = null
      return
    }
    let frame = 0
    const tick = (now: number) => {
      const prev = time.current
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      const next = Math.min(reel.duration, prev + dt)
      for (const cue of cues) if (cue.at > prev && cue.at <= next) play(cue.kind)
      time.current = next
      setT(next)
      if (next >= reel.duration) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, cues, reel.duration])

  const restart = useCallback(() => {
    seek(0)
    setPlaying(true)
  }, [seek])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        if (cinema) restart()
        else setPlaying((p) => !p)
      } else if (event.key === 'Escape') setCinema(false)
      else if (event.key === 'ArrowLeft') seek(time.current + 1)
      else if (event.key === 'ArrowRight') seek(time.current - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cinema, restart, seek])

  const chooseReel = (index: number) => {
    setPlaying(false)
    setReelIndex(index)
    time.current = 0
    setT(0)
  }

  const scene =
    reel.scenes.find((s) => t >= s.start && t < s.end) ?? reel.scenes[reel.scenes.length - 1]!

  // Scale: in cinema the frame fills the window height (or exactly 2× for 1080×1920).
  const scale = cinema
    ? exact
      ? 2
      : Math.min(viewport.w / W, viewport.h / H)
    : Math.min((viewport.w - 380) / W, (viewport.h - 40) / H, 1)

  if (cinema) {
    return (
      <div className="cinema">
        <div
          style={{
            width: W * scale,
            height: H * scale,
            overflow: 'hidden',
            flexShrink: 0,
            direction: 'ltr',
          }}
        >
          <div
            style={{
              width: W,
              height: H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <Frame reel={reel} t={t} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="studio">
      <aside className="panel">
        <h1>ویدیوهای معرفی حسابچه</h1>
        <div className="reel-list">
          {REELS.map((r, i) => (
            <button
              key={r.id}
              className={i === reelIndex ? 'reel-btn active' : 'reel-btn'}
              onClick={() => chooseReel(i)}
            >
              <span className="reel-id">{r.id}</span> {r.title}
              <span className="reel-dur">{fmt(r.duration)}</span>
            </button>
          ))}
        </div>

        <div className="controls">
          <button onClick={() => setPlaying((p) => !p)}>{playing ? 'توقف' : 'پخش'}</button>
          <button onClick={restart}>از اول</button>
          <button onClick={() => setMutedState((m) => !m)}>
            {muted ? 'صدا: خاموش' : 'صدا: روشن'}
          </button>
          <button onClick={() => setShowVo((v) => !v)}>
            {showVo ? 'متن گوینده: روشن' : 'متن گوینده: خاموش'}
          </button>
        </div>

        <div className="timeline">
          <div className="time">
            {fmt(t)} / {fmt(reel.duration)}
          </div>
          <input
            type="range"
            min={0}
            max={reel.duration}
            step={0.01}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            dir="ltr"
          />
          <div className="markers" dir="ltr">
            {reel.scenes.map((s, i) => (
              <button
                key={i}
                className={s === scene ? 'marker active' : 'marker'}
                style={{
                  left: `${(s.start / reel.duration) * 100}%`,
                  width: `${((s.end - s.start) / reel.duration) * 100}%`,
                }}
                onClick={() => seek(s.start)}
                title={`صحنه ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {showVo ? (
          <div className="teleprompter">
            <div className="tp-label">متن گوینده — صحنه {reel.scenes.indexOf(scene) + 1}</div>
            <div className="tp-text">{scene.vo}</div>
          </div>
        ) : null}

        <div className="cinema-box">
          <label>
            <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} />{' '}
            دقیقاً ۱۰۸۰×۱۹۲۰ (اگر صفحه جا دارد)
          </label>
          <button
            className="primary"
            onClick={() => {
              setPlaying(false)
              seek(0)
              setCinema(true)
            }}
          >
            حالت ضبط
          </button>
          <p className="hint">
            در حالت ضبط: Space = از اول و پخش · Esc = خروج. کنترل‌ها و نشانگر ماوس دیده نمی‌شوند.
          </p>
        </div>
      </aside>

      <main className="stage">
        <div
          style={{
            width: W * scale,
            height: H * scale,
            overflow: 'hidden',
            flexShrink: 0,
            direction: 'ltr',
          }}
        >
          <div
            style={{
              width: W,
              height: H,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <Frame reel={reel} t={t} />
          </div>
        </div>
      </main>
    </div>
  )
}
