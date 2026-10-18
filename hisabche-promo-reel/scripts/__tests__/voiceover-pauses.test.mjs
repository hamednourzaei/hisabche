// ============================================
// scripts/__tests__/voiceover-pauses.test.mjs
//
// place-voiceover finds the phrase splits by itself, offline (owner, 17 Oct
// 2026: «اتوماتیک مکث‌ها رو پیدا کنه»). The case it must survive is the real
// part67.mp3: a breath after a comma («عمده،»), a breath mid-phrase
// («قیمت‌هات رو | یک بار بنویس») and a «؛» only 0.12 s long («بزنی؛»).
// ============================================

import { describe, expect, it } from 'vitest'

import { choosePauses, scriptChunks } from '../place-voiceover.mjs'

const scene = (text) => ({ sentence: { words: text.split(' ').map((word) => ({ word })) } })

describe('scriptChunks', () => {
  it('«؛» and a scene end are required, a comma is optional, the last chunk has no mark', () => {
    const chunks = scriptChunks([
      scene('یه قیمت اشتباه؛ یا سودت رفته، یا مشتری‌ات.'),
      scene('شروع رایگان.'),
    ])
    expect(chunks.map((c) => c.required)).toEqual([true, false, true, false])
  })
})

describe('choosePauses — the silences of part67.mp3 (silencedetect d=0.08)', () => {
  const scenes = [
    'همین برنج رو دیروز به همسایه‌ات ارزون‌تر دادی؛ چرا به من گرون‌تر؟',
    'قیمت عمده و خرده فقط توی ذهن خودته؛ شاگرد تازه هر بار یه عدد میگه.',
    'یه قیمت اشتباه؛ یا سودت رفته، یا مشتری‌ات.',
    'توی حسابچه هر مشتری فهرست قیمت خودش رو داره: عمده، خرده، همکار.',
    'اسم مشتری رو که بزنی؛ فاکتور خودش قیمت همون فهرست رو میذاره.',
    'قیمت‌هات رو یک بار بنویس؛ شروع رایگان در حسابچه.',
  ].map(scene)
  const silences = [
    [3.22, 3.69],
    [5.13, 5.73],
    [9.13, 9.66],
    [12.18, 12.89],
    [14.18, 14.53],
    [16.86, 17.42],
    [21.46, 22.01],
    [22.63, 22.89],
    [24.47, 25.04],
    [26.82, 26.94],
    [29.86, 30.48],
    [31.98, 32.24],
    [32.95, 33.36],
  ].map(([start, end]) => ({ start, end }))

  it('takes one silence per «؛» and sentence end, skips the comma and the breath', () => {
    const picked = choosePauses(silences, 0, 35.46, scriptChunks(scenes)).map((p) => p.start)
    expect(picked).toEqual([
      3.22, 5.13, 9.13, 12.18, 14.18, 16.86, 21.46, 24.47, 26.82, 29.86, 32.95,
    ])
    expect(picked).not.toContain(22.63) // «عمده،» — a comma
    expect(picked).not.toContain(31.98) // «قیمت‌هات رو | یک بار» — a breath
  })

  it('fewer silences than required marks: null, never a guess', () => {
    expect(choosePauses(silences.slice(0, 5), 0, 35.46, scriptChunks(scenes))).toBeNull()
  })
})
