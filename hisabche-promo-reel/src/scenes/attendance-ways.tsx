// ============================================
// L2.25 — «برگه‌ی امضا یا لینک کارمند؟»: two ways to record attendance, on one screen.
// Design language: two tones, not two boxes. The paper way is small, sepia and quiet; the product's
// way is large, bright and sharp. They are separated by space and contrast only — never a drawn
// divider line (hard rule 14).
//
// The sign-sheet is a drawing of a sign-sheet. The other way is the real product: `CaptureView`
// plays the owner's recording of the employee's own page («حضور و غیاب من»), and the scene declares
// it in `captures` so the export gate knows. What the page really says (attendanceSelf.*):
// the result is either «ثبت شد» on the sheet at once, or «فرستاده شد و منتظر تأیید مدیر است».
// Blueprint: docs/scenarios/L2.25-sign-sheet-or-link.md
// ============================================

import type { ReactNode } from 'react'
import type { Scene } from '../engine/types'
import { clamp, ease, progress, spring } from '../engine/anim'
import { CaptureView } from './product-capture'

export const PAPER_SEPIA = '#d6c5a0'
export const NIGHT = '#0f1b24'
const INK = '#2a2118'
const BRIGHT = '#f1efe6'
const TEAL = '#35c4b4'

type SceneProps = { t: number; scene: Scene }

/** The recording both capture scenes show — one file, two cuts (trimStart). */
export const ATTENDANCE_CAPTURE = {
  file: 'attendance-self.mp4',
  route: '/my-attendance/[token]',
} as const

const pop = (t: number, at: number, dur = 0.5): number =>
  spring(clamp(progress(t, at, at + dur), 0, 1) * 1.15)

function Fill({ background, children }: { background: string; children: ReactNode }) {
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        background,
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

/** 1 — the two ways, one tone each. Frame 0 is already both words. */
export function TwoWaysHookScene({ t }: SceneProps) {
  const settle = (at: number) => 1 + 0.08 * (1 - pop(t, at, 0.45))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          background: PAPER_SEPIA,
          color: INK,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 900,
            lineHeight: 1.4,
            transform: `scale(${settle(0.1)})`,
          }}
        >
          برگه‌ی امضا
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: NIGHT,
          color: TEAL,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 150,
            fontWeight: 900,
            lineHeight: 1.4,
            transform: `scale(${settle(0.45)})`,
          }}
        >
          لینک کارمند
        </div>
      </div>
    </div>
  )
}

/** The sign-sheet, drawn: names down the side, a time written by hand, one cell left blank. */
export function SignSheet({ t, width }: { t: number; width: number }) {
  const height = width * 0.66
  const rows = [190, 262, 334]
  return (
    <svg width={width} height={height} viewBox="0 0 800 528" role="img" aria-label="برگه‌ی امضا">
      <rect
        x="6"
        y="6"
        width="788"
        height="516"
        rx="18"
        fill="#efe3c2"
        stroke="#8c7a55"
        strokeWidth="4"
      />
      <line x1="40" y1="120" x2="760" y2="120" stroke="#8c7a55" strokeWidth="4" />
      <line x1="470" y1="40" x2="470" y2="490" stroke="#b9a678" strokeWidth="3" />
      {rows.map((y, index) => {
        const written = ease(clamp(progress(t, 0.5 + index * 0.9, 1.2 + index * 0.9), 0, 1))
        return (
          <g key={y}>
            <line x1="60" y1={y + 28} x2="430" y2={y + 28} stroke="#b9a678" strokeWidth="3" />
            <line x1="500" y1={y + 28} x2="740" y2={y + 28} stroke="#b9a678" strokeWidth="3" />
            {index < 2 && (
              <path
                d={`M 520 ${y + 4} q 30 -22 60 0 t 60 0 t 60 0`}
                fill="none"
                stroke={INK}
                strokeWidth="6"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - written}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** 2 — the paper way, alone. */
export function SheetScene({ t }: SceneProps) {
  const text = ease(clamp(progress(t, 0.2, 0.7), 0, 1))
  return (
    <Fill background={PAPER_SEPIA}>
      <div
        style={{
          color: INK,
          fontSize: 92,
          fontWeight: 900,
          lineHeight: 1.6,
          marginBottom: 56,
          opacity: text,
          textAlign: 'center',
          padding: '0 110px',
        }}
      >
        با برگه: هر کس ساعت را می‌نویسد
      </div>
      <SignSheet t={t} width={880} />
    </Fill>
  )
}

/** 3 — both at once: the small sepia sheet above, the large product below. Space and tone, no line. */
export function SplitScene({ t }: SceneProps) {
  const labelOpacity = ease(clamp(progress(t, 0.2, 0.6), 0, 1))
  return (
    <div
      dir="rtl"
      style={{
        position: 'absolute',
        inset: 0,
        zoom: 0.5,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          height: 620,
          background: PAPER_SEPIA,
          color: INK,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          opacity: 0.88,
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 800, opacity: labelOpacity }}>با برگه</div>
        <SignSheet t={t + 2} width={560} />
      </div>
      <div
        style={{
          flex: 1,
          background: NIGHT,
          color: BRIGHT,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        <div style={{ fontSize: 84, fontWeight: 900, color: TEAL, opacity: labelOpacity }}>
          با لینک
        </div>
        <CaptureView
          file={ATTENDANCE_CAPTURE.file}
          route={ATTENDANCE_CAPTURE.route}
          t={t}
          width={560}
          maxHeight={880}
        />
      </div>
    </div>
  )
}

/** 5 — the two answers the page gives, in the product's own words. */
export function ResultsScene({ t }: SceneProps) {
  const first = ease(clamp(progress(t, 0.15, 0.65), 0, 1))
  const second = ease(clamp(progress(t, 1.5, 2.0), 0, 1))
  return (
    <Fill background={NIGHT}>
      <div
        style={{
          color: BRIGHT,
          display: 'flex',
          flexDirection: 'column',
          gap: 80,
          alignItems: 'center',
          textAlign: 'center',
          padding: '0 90px',
        }}
      >
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            opacity: first,
            transform: `translateY(${(1 - first) * 40}px)`,
          }}
        >
          ثبت‌شده روی برگه
        </div>
        <div
          style={{
            fontSize: 100,
            fontWeight: 900,
            color: TEAL,
            opacity: second,
            transform: `translateY(${(1 - second) * 40}px)`,
          }}
        >
          منتظر تأیید مدیر
        </div>
      </div>
    </Fill>
  )
}

/** 6 — the ask; the last half second is the opening pair again. */
export function SaveAttendanceScene({ t, scene }: SceneProps) {
  const dur = scene.end - scene.start
  const back = ease(clamp(progress(t, dur - 0.6, dur - 0.15), 0, 1))
  return (
    <div dir="rtl" style={{ position: 'absolute', inset: 0 }}>
      <Fill background={NIGHT}>
        <div
          style={{
            color: BRIGHT,
            fontSize: 130,
            fontWeight: 900,
            opacity: (1 - back) * pop(t, 0.1, 0.4),
          }}
        >
          ذخیره کن
        </div>
      </Fill>
      <div style={{ position: 'absolute', inset: 0, opacity: back }}>
        <TwoWaysHookScene t={0} scene={scene} />
      </div>
    </div>
  )
}
