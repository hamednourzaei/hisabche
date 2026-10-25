// ============================================
// Reel 97 — «برگه‌ی امضا یا لینک کارمند؟» (L2.25 of docs/100-VIDEO-PLAN.md) · 34 s
//
// Two ways to record attendance on one screen: the paper sign-sheet (a small sepia drawing of a
// sheet) and the product (the owner's real recording of the employee's own page «حضور و غیاب من»).
// Separated by tone and space only — no divider line. Silent edition: no recorded voice yet; the
// words are the product's own: «ثبت‌شده روی برگه» / «منتظر تأیید مدیر». No speed or accuracy claim.
//
// ⚠️ `attendance-self.mp4` is a real recording by the owner, outside the repository
// (docs/CAPTURE-MANIFEST.md). Missing → the export refuses (PRODUCT_CAPTURE). One file, two cuts:
// 0–9 s in the split, 9–16 s full screen. The page is public (opened from the employee's link), so
// no sign-in is needed to record it.
// Blueprint: docs/scenarios/L2.25-sign-sheet-or-link.md
// ============================================

import type { Cue, Reel } from '../engine/types'
import {
  ATTENDANCE_CAPTURE,
  NIGHT,
  ResultsScene,
  SaveAttendanceScene,
  SheetScene,
  SplitScene,
  TwoWaysHookScene,
} from '../scenes/attendance-ways'
import { sequence, total } from './shared'

const SCREEN_STATE =
  'The employee page «حضور و غیاب من», opened from the link on a phone-size window, recorded in one take (≥ 16 s): choose the entry time, press «ثبت», and show the result — «ثبت شد» or «فرستاده شد و منتظر تأیید مدیر است». Test data only.'

const scene = (component: typeof TwoWaysHookScene, cues: Cue[]) =>
  ({ kind: 'bespoke', theme: 'cinematic-obsidian', component, cues }) as const

const scenes = sequence(
  [
    // 1 (0–4s) — frame 0: the two ways, one tone each.
    {
      dur: 4,
      spec: scene(TwoWaysHookScene, [
        { at: 0.1, kind: 'pop' },
        { at: 0.45, kind: 'pop' },
      ]),
      vo: '',
    },
    // 2 (4–11s) — the paper way, alone.
    {
      dur: 7,
      spec: scene(SheetScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.6, kind: 'markerScribble' },
        { at: 1.5, kind: 'markerScribble' },
      ]),
      vo: '',
    },
    // 3 (11–20s) — both at once: small sheet above, the real page below.
    {
      dur: 9,
      spec: {
        ...scene(SplitScene, [
          { at: 0.02, kind: 'whoosh' },
          { at: 0.3, kind: 'pop' },
        ]),
        captures: [{ ...ATTENDANCE_CAPTURE, trimStart: 0, screenState: SCREEN_STATE }],
      },
      vo: '',
    },
    // 4 (20–27s) — the page alone: the result.
    {
      dur: 7,
      spec: {
        kind: 'product-capture',
        theme: 'cinematic-obsidian',
        ...ATTENDANCE_CAPTURE,
        trimStart: 9,
        label: 'حضور و غیاب من',
        screenState: SCREEN_STATE,
        stage: { background: NIGHT, ink: '#f1efe6' },
      },
      vo: '',
    },
    // 5 (27–31s) — the two answers the page gives.
    {
      dur: 4,
      spec: scene(ResultsScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.2, kind: 'pop' },
        { at: 1.55, kind: 'pop' },
      ]),
      vo: '',
    },
    // 6 (31–34s) — the ask; the last half second is frame 0 again.
    {
      dur: 3,
      spec: scene(SaveAttendanceScene, [
        { at: 0.02, kind: 'whoosh' },
        { at: 0.12, kind: 'pop' },
      ]),
      vo: '',
    },
  ],
  { noZoom: true },
)

export const reel97: Reel = {
  id: '97',
  title: 'برگه‌ی امضا یا لینک کارمند؟',
  duration: total(scenes),
  scenes,
  theme: 'cinematic-obsidian',
  musicMood: 'calm',
  noZoom: true,
}
