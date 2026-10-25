import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { clamp } from './engine/anim'
import { play, setMuted } from './engine/sound'

import { REELS } from './reels'
import { reelCues } from './scenes'
import { ReelFrame } from './ReelFrame'
import { FreeBazaarReelView } from './freestyle/FreeBazaarReelView'
import { FreeWarehouseReelView } from './freestyle/FreeWarehouseReelView'
import { FreePartnersReelView } from './freestyle/FreePartnersReelView'
import { FREE_REELS_CATALOG } from './freestyle/bazaar-humor-data'

const W = 540
const H = 960

const fmt = (s: number) => {
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

// ?reel=01&t=3.5&frame — open a reel at a moment; `frame` shows only the frame.
const params = new URLSearchParams(window.location.search)
const freeParam = params.get('free') || params.get('mode')
const START_IS_FREE =
  Boolean(freeParam) || params.get('reel') === 'free' || params.get('free') === '1'
const START_FREE_IDX =
  freeParam === '2' || freeParam === 'warehouse'
    ? 1
    : freeParam === '3' || freeParam === 'partners'
      ? 2
      : 0
const START_REEL = Math.max(
  0,
  REELS.findIndex((r) => r.id === params.get('reel')),
)
const START_T = Number(params.get('t')) || 0
const START_FRAME = params.has('frame')

export function App() {
  const [isFreeReel, setIsFreeReel] = useState(START_IS_FREE)
  const [freeIndex, setFreeIndex] = useState(START_FREE_IDX)
  const currentFree = FREE_REELS_CATALOG[freeIndex]!

  const [reelIndex, setReelIndex] = useState(START_REEL)
  const reel = REELS[reelIndex]!
  const cues = useMemo(() => reelCues(reel), [reel])

  const duration = isFreeReel ? currentFree.meta.duration : reel.duration
  const currentCues = isFreeReel ? currentFree.cues : cues

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
      time.current = clamp(to, 0, duration)
      last.current = null
      setT(time.current)
    },
    [duration],
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
      const next = Math.min(duration, prev + dt)
      for (const cue of currentCues) if (cue.at > prev && cue.at <= next) play(cue.kind)
      time.current = next
      setT(next)
      if (next >= duration) {
        setPlaying(false)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, currentCues, duration])

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
    setIsFreeReel(false)
    setPlaying(false)
    setReelIndex(index)
    time.current = 0
    setT(0)
  }

  const standardScene =
    reel.scenes.find((s) => t >= s.start && t < s.end) ?? reel.scenes[reel.scenes.length - 1]!
  const freeScene =
    currentFree.scenes.find((s) => t >= s.start && t < s.end) ??
    currentFree.scenes[currentFree.scenes.length - 1]!

  const sceneTitle = isFreeReel ? freeScene.title : standardScene.spec.kind
  const sceneVo = isFreeReel ? freeScene.vo : standardScene.vo
  const sceneNumber = isFreeReel
    ? currentFree.scenes.indexOf(freeScene) + 1
    : reel.scenes.indexOf(standardScene) + 1

  // Scale: in cinema the frame fills the window height (or exactly 2× for 1080×1920).
  const scale = cinema
    ? exact
      ? 2
      : Math.min(viewport.w / W, viewport.h / H)
    : Math.min((viewport.w - 380) / W, (viewport.h - 40) / H, 1)

  const renderActiveFreeView = () => {
    if (freeIndex === 0) return <FreeBazaarReelView t={t} />
    if (freeIndex === 1) return <FreeWarehouseReelView t={t} />
    return <FreePartnersReelView t={t} />
  }

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
            {isFreeReel ? renderActiveFreeView() : <ReelFrame reel={reel} t={t} />}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="studio">
      <aside className="panel">
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          <button
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: !isFreeReel ? 'var(--cyan)' : 'rgba(255,255,255,0.06)',
              color: !isFreeReel ? '#000' : 'var(--ink)',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              setIsFreeReel(false)
              setPlaying(false)
              seek(0)
            }}
          >
            🏢 استودیوی B2B (۸۱ ریل)
          </button>
          <button
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              background: isFreeReel ? '#f59e0b' : 'rgba(255,255,255,0.06)',
              color: isFreeReel ? '#000' : 'var(--ink)',
              border: 'none',
              cursor: 'pointer',
            }}
            onClick={() => {
              setIsFreeReel(true)
              setPlaying(false)
              seek(0)
            }}
          >
            🎭 ویدیوهای آزاد بازار ({FREE_REELS_CATALOG.length})
          </button>
        </div>

        {isFreeReel ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {FREE_REELS_CATALOG.map((fr, idx) => (
              <button
                key={fr.meta.id}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 800,
                  background: idx === freeIndex ? '#f59e0b' : 'rgba(255,255,255,0.07)',
                  color: idx === freeIndex ? '#000' : '#f1f5f9',
                  border:
                    idx === freeIndex ? '1px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  textAlign: 'right',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onClick={() => {
                  setFreeIndex(idx)
                  setPlaying(false)
                  seek(0)
                }}
              >
                <span>{fr.meta.title}</span>
                <span
                  style={{
                    fontSize: 11,
                    background: idx === freeIndex ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.15)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {fr.meta.duration}s
                </span>
              </button>
            ))}
          </div>
        ) : (
          <h1>ویدیوهای معرفی حسابچه</h1>
        )}

        <div className="reel-list">
          {isFreeReel ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {currentFree.scenes.map((s) => (
                <button
                  key={s.id}
                  className={s === freeScene ? 'reel-btn active' : 'reel-btn'}
                  onClick={() => {
                    setPlaying(false)
                    seek(s.start)
                  }}
                >
                  <span className="reel-id">{s.id}</span> {s.title}
                  <span className="reel-dur">{s.dur}s</span>
                </button>
              ))}
            </div>
          ) : (
            REELS.map((r, i) => (
              <button
                key={r.id}
                className={i === reelIndex ? 'reel-btn active' : 'reel-btn'}
                onClick={() => chooseReel(i)}
              >
                <span className="reel-id">{r.id}</span> {r.title}
                <span className="reel-dur">{fmt(r.duration)}</span>
              </button>
            ))
          )}
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
            {fmt(t)} / {fmt(duration)}
          </div>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            dir="ltr"
          />
          <div className="markers" dir="ltr">
            {isFreeReel
              ? currentFree.scenes.map((s, i) => (
                  <button
                    key={i}
                    className={s === freeScene ? 'marker active' : 'marker'}
                    style={{
                      left: `${(s.start / duration) * 100}%`,
                      width: `${((s.end - s.start) / duration) * 100}%`,
                    }}
                    onClick={() => seek(s.start)}
                    title={s.title}
                  >
                    {i + 1}
                  </button>
                ))
              : reel.scenes.map((s, i) => (
                  <button
                    key={i}
                    className={s === standardScene ? 'marker active' : 'marker'}
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
            <div className="tp-label">
              متن گوینده — صحنه {sceneNumber} ({sceneTitle})
            </div>
            <div className="tp-text">{sceneVo}</div>
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
            {isFreeReel ? renderActiveFreeView() : <ReelFrame reel={reel} t={t} />}
          </div>
        </div>
      </main>
    </div>
  )
}
