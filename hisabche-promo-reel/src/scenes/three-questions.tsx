// ============================================
// L1.09 — «سه سؤال درباره‌ی تاریخ انقضا»: a no-voice, type-led reel on a paper stage.
// The text IS the content (no narration, no subtitle bar), so nothing is said twice; the one
// shot of the real product (`/till`) is a `product-capture` scene, not a drawing.
// Blueprint: docs/scenarios/L1.09-three-questions-about-expiry.md
//
// Hard rule 14: one focal element, ≤ 6 words on stage, centred at Y ∈ [42%, 58%].
// ============================================

import type { CSSProperties } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'

const PAPER = '#f2efe6'
const INK = '#16150f'
const BLUE = '#1f4dff'

type SceneProps = { t: number; scene: Scene }

const pop = (t: number, at: number, dur = 0.5): number =>
  spring(clamp(progress(t, at, at + dur), 0, 1) * 1.15)

function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        background: PAPER,
        color: INK,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

/** A marker stroke that draws itself under (or around) a line of type. */
function MarkerStroke({
  t,
  at,
  dur = 0.55,
  width,
}: {
  t: number
  at: number
  dur?: number
  width: number
}) {
  const drawn = ease(clamp(progress(t, at, at + dur), 0, 1))
  return (
    <svg
      width={width}
      height={44}
      viewBox={`0 0 ${width} 44`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path
        d={`M 6 28 C ${width * 0.25} 8, ${width * 0.55} 40, ${width - 6} 14`}
        fill="none"
        stroke={BLUE}
        strokeWidth={14}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - drawn}
      />
    </svg>
  )
}

const focal: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 28,
  textAlign: 'center',
  padding: '0 70px',
}

/** Frame 0 and the last frame: the number three (the label and its stroke follow in the hook). */
function Three({ t, label = true }: { t: number; label?: boolean }) {
  // Already on screen at frame 0 (the first frame must arrest); the slam settles it.
  const settle = 1 + 0.1 * (1 - pop(t, 0.1, 0.45))
  return (
    <div style={focal}>
      <div
        style={{
          fontSize: 380,
          lineHeight: 1,
          fontWeight: 900,
          transform: `scale(${settle})`,
        }}
      >
        ۳
      </div>
      {label && (
        <>
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              lineHeight: 1.5,
              opacity: ease(clamp(progress(t, 0.5, 0.9), 0, 1)),
            }}
          >
            سؤال
          </div>
          <MarkerStroke t={t} at={0.55} width={360} />
        </>
      )}
    </div>
  )
}

/** The hook: the number, its label, and — once they have landed — when the questions are for. */
export function ThreeHookScene({ t }: SceneProps) {
  const when = ease(clamp(progress(t, 1.5, 1.95), 0, 1))
  return (
    <Stage>
      <div style={{ ...focal, gap: 20 }}>
        <Three t={t} />
        <div
          style={{
            fontSize: 64,
            whiteSpace: 'nowrap',
            fontWeight: 700,
            lineHeight: 1.6,
            opacity: when,
            transform: `translateY(${(1 - when) * 28}px)`,
          }}
        >
          درباره‌ی تاریخ انقضا
        </div>
      </div>
    </Stage>
  )
}

/** One question: its number small and blue, the question large, the key word underlined. */
function Question({
  t,
  number,
  words,
  underline,
}: {
  t: number
  number: string
  words: string[]
  underline: number
}) {
  const size = words.length > 3 ? 104 : 116
  return (
    <div style={focal}>
      <div
        style={{
          width: 150,
          height: 150,
          borderRadius: 999,
          background: BLUE,
          color: PAPER,
          fontSize: 96,
          fontWeight: 900,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: `scale(${pop(t, 0.1)})`,
        }}
      >
        {number}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 36,
          width: '100%',
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.7,
        }}
      >
        {words.map((word, index) => {
          const shown = ease(clamp(progress(t, 0.4 + index * 0.18, 0.7 + index * 0.18), 0, 1))
          return (
            <span
              key={`${index}-${word}`}
              style={{
                position: 'relative',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 36}px)`,
              }}
            >
              {word}
              {index === underline && (
                <span
                  style={{
                    position: 'absolute',
                    insetInline: 0,
                    bottom: -6,
                    display: 'flex',
                    justifyContent: 'center',
                  }}
                >
                  <MarkerStroke
                    t={t}
                    at={0.4 + words.length * 0.18 + 0.1}
                    width={Math.max(180, word.length * 62)}
                  />
                </span>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function QuestionOneScene({ t }: SceneProps) {
  return (
    <Stage>
      <Question t={t} number="۱" words={['کدام', 'کالا', 'نزدیک', 'انقضاست؟']} underline={2} />
    </Stage>
  )
}

export function QuestionTwoScene({ t }: SceneProps) {
  return (
    <Stage>
      <Question t={t} number="۲" words={['چند', 'روز', 'مانده؟']} underline={1} />
    </Stage>
  )
}

export function QuestionThreeScene({ t }: SceneProps) {
  return (
    <Stage>
      <Question t={t} number="۳" words={['ارزش', 'کالای', 'منقضی', 'چقدر؟']} underline={2} />
    </Stage>
  )
}

/** The three answers in one line: the number beside the thing it was about. */
export function RecapScene({ t }: SceneProps) {
  const items: [string, string][] = [
    ['۱', 'نزدیک'],
    ['۲', 'روز'],
    ['۳', 'ارزش'],
  ]
  return (
    <Stage>
      <div style={{ ...focal, gap: 56 }}>
        {items.map(([number, word], index) => {
          const shown = pop(t, 0.2 + index * 0.45)
          return (
            <div
              key={number}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 40,
                opacity: clamp(shown * 1.5, 0, 1),
                transform: `translateX(${(1 - clamp(shown, 0, 1)) * 90}px)`,
              }}
            >
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 999,
                  background: BLUE,
                  color: PAPER,
                  fontSize: 84,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {number}
              </div>
              <div style={{ fontSize: 124, fontWeight: 900, lineHeight: 1.5 }}>{word}</div>
            </div>
          )
        })}
      </div>
    </Stage>
  )
}

/** The ask, then — in the last half second — the opening «۳» again, so the reel loops. */
export function SaveScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const back = ease(clamp(progress(t, dur - 0.6, dur - 0.15), 0, 1))
  return (
    <Stage>
      <div style={{ ...focal, opacity: 1 - back, transform: `scale(${1 - back * 0.08})` }}>
        <div
          style={{
            fontSize: 112,
            fontWeight: 900,
            lineHeight: 1.6,
            transform: `scale(${pop(t, 0.05)})`,
          }}
        >
          ذخیره کن
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.6,
            opacity: ease(clamp(progress(t, 0.35, 0.7), 0, 1)),
          }}
        >
          برای وقت چیدن قفسه
        </div>
        <MarkerStroke t={t} at={0.3} width={420} />
      </div>
      <div style={{ position: 'absolute', opacity: back }}>
        <Three t={dur} label={false} />
      </div>
    </Stage>
  )
}
