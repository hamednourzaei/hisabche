import { checkReel } from './check-frame-bounds.mjs'

const reelIds = [
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
  '13',
  '14',
  '15',
  '16',
  '17',
  '18',
  '19',
  '20',
]

console.log('Starting Phase 2 Baseline Measurement for Reels 06–20...')

const results = []

for (const id of reelIds) {
  try {
    const res = await checkReel(id)
    console.log(`Reel ${id}: ${res.problems.length} violation(s)`)
    results.push(res)
  } catch (err) {
    console.error(`Reel ${id} failed:`, err.message)
    results.push({ reel: id, error: err.message, problems: [] })
  }
}

import fs from 'node:fs'
fs.writeFileSync('scripts/phase2-baseline.json', JSON.stringify(results, null, 2))
console.log('Saved baseline to scripts/phase2-baseline.json')
