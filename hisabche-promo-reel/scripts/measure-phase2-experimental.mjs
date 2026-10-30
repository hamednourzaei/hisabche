import { checkReel } from './check-frame-bounds.mjs'
import fs from 'node:fs'

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

console.log('Starting Phase 2 Experimental Measurement for Reels 06–20...')

const baseline = JSON.parse(fs.readFileSync('scripts/phase2-baseline.json', 'utf8'))
const results = []

for (const id of reelIds) {
  try {
    const res = await checkReel(id)
    const baseReel = baseline.find((b) => b.reel === id || b.reel === String(Number(id)))
    const baseCount = baseReel?.problems?.length ?? 'N/A'
    console.log(
      `Reel ${id}: ${baseCount} baseline -> ${res.problems.length} experimental violation(s)`,
    )
    results.push(res)
  } catch (err) {
    console.error(`Reel ${id} failed:`, err.message)
    results.push({ reel: id, error: err.message, problems: [] })
  }
}

fs.writeFileSync('scripts/phase2-experimental.json', JSON.stringify(results, null, 2))
console.log('Saved experimental results to scripts/phase2-experimental.json')
