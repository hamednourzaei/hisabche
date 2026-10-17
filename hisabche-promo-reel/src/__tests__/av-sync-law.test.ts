// ============================================
// AV sync law — the script side (owner, 17 Oct 2026).
//
// «The sounds don't match the video» came from sounds that had no visual
// event at their moment: a cue on a word nothing on screen reacted to, or an
// alert at a sentence ending that drew nothing. From reel 60 on:
//
//   1. a word that carries a `sound` carries an `action` — the visual event
//      the sound belongs to (the actor reads that action's time);
//   2. a sentence ending carries no sound — it is a hold, not an event;
//   3. every `action` named by a word is drawn by the reel's actor file, so a
//      sound cannot be paired with an action name nothing uses.
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { REELS } from '../reels'

const FROM_REEL = 60

const lawful = REELS.filter((reel) => Number(reel.id) >= FROM_REEL)

/** The actor source a word-sync reel is drawn by: src/components/Reel<ID>*.tsx */
function actorSource(id: string): string {
  const dir = path.join(__dirname, '..', 'components')
  const file = fs
    .readdirSync(dir)
    .find((name) => name.startsWith(`Reel${id}`) && name.endsWith('.tsx'))
  return file ? fs.readFileSync(path.join(dir, file), 'utf8') : ''
}

describe('AV sync law — every sound has a visual event', () => {
  it('applies to reel 60 onward', () => {
    expect(lawful.length).toBeGreaterThan(0)
  })

  for (const reel of lawful) {
    describe(`reel ${reel.id}`, () => {
      const source = actorSource(reel.id)

      reel.scenes.forEach((scene, index) => {
        const plan = scene.sentence
        if (!plan) return

        it(`scene ${index + 1}: a word with a sound has an action`, () => {
          const orphans = plan.words.filter((w) => w.sound && !w.action).map((w) => w.word)
          expect(orphans, 'sound with no visual event').toEqual([])
        })

        it(`scene ${index + 1}: the sentence ending carries no sound`, () => {
          expect(
            plan.sentenceEnding?.sound,
            'a hold has no visual event to sync to',
          ).toBeUndefined()
        })

        it(`scene ${index + 1}: every sounded action is drawn by the actor`, () => {
          const unused = plan.words
            .filter((w) => w.sound && w.action)
            .map((w) => w.action!)
            .filter((action) => !source.includes(`'${action}'`))
          expect(unused, 'action named in the script but never read by the actor').toEqual([])
        })
      })
    })
  }
})
