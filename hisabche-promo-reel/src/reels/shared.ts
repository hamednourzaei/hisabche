import type { Scene, SceneSpec } from '../engine/types'

/** Lays scenes end to end: give each a duration, get start/end. */
export function sequence(parts: { dur: number; spec: SceneSpec; vo: string }[]): Scene[] {
  let at = 0
  return parts.map((part) => {
    const scene = { start: at, end: at + part.dur, spec: part.spec, vo: part.vo }
    at += part.dur
    return scene
  })
}

export const total = (scenes: Scene[]) => scenes[scenes.length - 1]?.end ?? 0

/** The closing scene every reel shares: two comment boxes. */
export function ctaScene(dur = 13): { dur: number; spec: SceneSpec; vo: string } {
  return {
    dur,
    spec: {
      kind: 'cta',
      tagline: 'حسابچه | نرم‌افزار مالی ابری، با اپ آفلاین',
      boxes: [
        {
          lead: 'اگر می‌خواهید همین الان رایگان شروع کنید…',
          action: 'کامنت کنید:',
          word: 'رایگان',
          tone: 'cyan',
        },
        {
          lead: 'اگر لینک دانلود اپ و مشاوره می‌خواهید…',
          action: 'کامنت کنید:',
          word: 'حسابچه',
          tone: 'purple',
        },
      ],
      switchAt: Math.round(dur * 0.47 * 10) / 10,
    },
    vo: 'اگر می‌خواهید همین الان رایگان شروع کنید، کامنت کنید «رایگان». برای لینک دانلود و مشاوره، کامنت کنید «حسابچه».',
  }
}

/** The comparison's three columns — never two: traditional software is not Excel. */
export const COMPARE_COLUMNS: [string, string, string, string] = [
  'قابلیت',
  'اکسل و دفتر',
  'نرم‌افزار سنتی',
  'حسابچه',
]
