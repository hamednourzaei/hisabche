// ============================================
// L2.22 — «مانده‌ی بانک با مانده‌ی دفاتر نمی‌خواند»: a one-gap lesson written in chalk.
// Design language: a dark green board, chalk-white figures that write themselves on from the right
// (the way Persian is written), one yellow chalk for the answer. No paper, no cards, no neon.
//
// ⚠️ Every figure on the board is ILLUSTRATIVE and says so («نمونه» on every beat that has numbers).
// The real thing is the recording near the end: the product's own page «مغایرت‌گیری بانکی»,
// which shows «مانده‌ی بانک / مانده‌ی دفاتر / اختلاف» and lists suggested matches that a person
// confirms one by one («تأیید گروهی وجود ندارد» — bank.suggestions_hint in the app's catalogue).
// Blueprint: docs/scenarios/L2.22-bank-gap-in-chalk.md
// ============================================

import type { CSSProperties, ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'

export const BOARD = '#10261f'
export const CHALK = '#f1efe6'
const YELLOW = '#f2c94c'

type SceneProps = { t: number; scene: Scene }

const pop = (t: number, at: number, dur = 0.5): number =>
  spring(clamp(progress(t, at, at + dur), 0, 1) * 1.15)

/** The board: dark green with a soft chalk-dust glow. */
function Board({ children }: { children: ReactNode }) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        background: `radial-gradient(ellipse at 50% 38%, #1a3d32 0%, ${BOARD} 62%, #0a1a15 100%)`,
        color: CHALK,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

/** Text that writes itself on, right to left, as if drawn in chalk. */
function Chalk({
  children,
  t,
  at,
  dur = 0.7,
  size,
  color = CHALK,
  weight = 800,
}: {
  children: ReactNode
  t: number
  at: number
  dur?: number
  size: number
  color?: string
  weight?: number
}) {
  const written = ease(clamp(progress(t, at, at + dur), 0, 1))
  const style: CSSProperties = {
    fontSize: size,
    fontWeight: weight,
    lineHeight: 1.45,
    color,
    textShadow: `0 0 18px ${color}55`,
    clipPath: `inset(-20px 0 -20px ${(1 - written) * 100}%)`,
    opacity: written > 0 ? 1 : 0,
    whiteSpace: 'nowrap',
  }
  return <div style={style}>{children}</div>
}

/** Every beat with figures says they are an example. */
function Sample({ t, at = 0.1 }: { t: number; at?: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 150,
        insetInlineEnd: 90,
        padding: '8px 26px',
        border: `3px dashed ${YELLOW}`,
        borderRadius: 14,
        color: YELLOW,
        fontSize: 46,
        fontWeight: 700,
        opacity: ease(clamp(progress(t, at, at + 0.3), 0, 1)),
      }}
    >
      نمونه
    </div>
  )
}

const column: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 34,
}

/** 1 — the bank's balance. Frame 0 is already the figure. */
export function BankScene({ t }: SceneProps) {
  return (
    <Board>
      <Sample t={t} />
      <div style={column}>
        <div style={{ transform: `scale(${1 + 0.08 * (1 - pop(t, 0.1, 0.45))})` }}>
          <Chalk t={t} at={0} dur={0.01} size={300}>
            ۹۰۰
          </Chalk>
        </div>
        <Chalk t={t} at={0.5} size={104}>
          مانده‌ی بانک
        </Chalk>
      </div>
    </Board>
  )
}

/** 2 — the books' balance. */
export function BooksScene({ t }: SceneProps) {
  return (
    <Board>
      <Sample t={t} />
      <div style={{ ...column, gap: 50 }}>
        <div style={{ display: 'flex', gap: 36, alignItems: 'baseline', opacity: 0.7 }}>
          <Chalk t={t} at={0} dur={0.01} size={80}>
            مانده‌ی بانک
          </Chalk>
          <Chalk t={t} at={0} dur={0.01} size={120}>
            ۹۰۰
          </Chalk>
        </div>
        <Chalk t={t} at={0.4} size={104} color={YELLOW}>
          مانده‌ی دفاتر
        </Chalk>
        <Chalk t={t} at={0.9} dur={1.1} size={260} color={YELLOW}>
          ۱٬۰۰۰
        </Chalk>
      </div>
    </Board>
  )
}

/** 3 — the gap: books minus bank. */
export function GapScene({ t }: SceneProps) {
  const answer = pop(t, 3.0, 0.6)
  return (
    <Board>
      <Sample t={t} />
      <div style={{ ...column, gap: 70 }}>
        <div style={{ display: 'flex', gap: 30, alignItems: 'center', direction: 'ltr' }}>
          <Chalk t={t} at={0.2} dur={0.8} size={130} color={YELLOW}>
            ۱٬۰۰۰
          </Chalk>
          <Chalk t={t} at={1.1} dur={0.3} size={130}>
            −
          </Chalk>
          <Chalk t={t} at={1.5} dur={0.8} size={130}>
            ۹۰۰
          </Chalk>
          <Chalk t={t} at={2.5} dur={0.3} size={130}>
            =
          </Chalk>
        </div>
        <div
          style={{
            opacity: clamp(answer * 1.5, 0, 1),
            transform: `scale(${0.7 + 0.3 * answer})`,
            ...column,
            gap: 14,
          }}
        >
          <div style={{ fontSize: 100, fontWeight: 800, color: YELLOW }}>اختلاف</div>
          <div
            style={{
              fontSize: 300,
              fontWeight: 900,
              color: YELLOW,
              lineHeight: 1.1,
              textShadow: `0 0 40px ${YELLOW}66`,
            }}
          >
            ۱۰۰
          </div>
        </div>
      </div>
    </Board>
  )
}

/** 4 — what the gap is: money the books know about and the bank has not seen yet. */
export function CauseScene({ t }: SceneProps) {
  return (
    <Board>
      <Sample t={t} />
      <div style={{ ...column, gap: 40 }}>
        <Chalk t={t} at={0.2} dur={0.6} size={280} color={YELLOW}>
          ۱۰۰
        </Chalk>
        <Chalk t={t} at={1.2} dur={0.9} size={120}>
          هنوز نرسیده
        </Chalk>
        <Chalk t={t} at={3.2} dur={0.9} size={84} color={YELLOW}>
          پیدا کردنش، تطبیق است
        </Chalk>
      </div>
    </Board>
  )
}

/** 6 — the rule: the bank plus what is on its way equals the books. */
export function RuleScene({ t }: SceneProps) {
  return (
    <Board>
      <Sample t={t} />
      <div style={{ ...column, gap: 90 }}>
        <div style={{ display: 'flex', gap: 28, alignItems: 'center', direction: 'ltr' }}>
          <Chalk t={t} at={0.2} dur={0.7} size={130}>
            ۹۰۰
          </Chalk>
          <Chalk t={t} at={0.8} dur={0.3} size={130} color={YELLOW}>
            +
          </Chalk>
          <Chalk t={t} at={1.1} dur={0.7} size={130} color={YELLOW}>
            ۱۰۰
          </Chalk>
          <Chalk t={t} at={1.8} dur={0.3} size={130}>
            =
          </Chalk>
          <Chalk t={t} at={2.1} dur={0.8} size={130}>
            ۱٬۰۰۰
          </Chalk>
        </div>
        <Chalk t={t} at={3.0} dur={0.9} size={88} color={YELLOW}>
          تأیید گروهی نیست
        </Chalk>
      </div>
    </Board>
  )
}

/** 7 — the ask, and the first figure again so the reel can loop. */
export function ShareScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const back = ease(clamp(progress(t, dur - 0.6, dur - 0.15), 0, 1))
  return (
    <Board>
      <div style={{ ...column, gap: 14, opacity: 1 - back }}>
        <Chalk t={t} at={0.1} size={110}>
          برای حسابدارت
        </Chalk>
        <Chalk t={t} at={0.5} size={110}>
          بفرست
        </Chalk>
        <Chalk t={t} at={1.1} dur={0.5} size={72} color={YELLOW}>
          ذخیره کن
        </Chalk>
      </div>
      <div style={{ position: 'absolute', ...column, opacity: back }}>
        <div
          style={{
            fontSize: 300,
            fontWeight: 800,
            color: CHALK,
            textShadow: `0 0 18px ${CHALK}55`,
            lineHeight: 1.45,
          }}
        >
          ۹۰۰
        </div>
      </div>
    </Board>
  )
}
