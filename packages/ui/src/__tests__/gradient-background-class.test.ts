// `bg-[var(--gradient-brand)]` compiles to `background-color: var(--gradient-brand)`.
// A gradient is not a colour, so the declaration is invalid and NOTHING paints —
// measured in the built CSS: the landing header's «Start Free» was white text on
// a transparent background, invisible on the light theme. 33 call sites had it.
// A gradient must go through the `image:` hint: `bg-[image:var(--gradient-brand)]`.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const files: string[] = []
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(name)) files.push(full)
  }
}
walk(join(__dirname, '..'))

describe('gradient backgrounds use the image hint', () => {
  it('no bg-[var(--gradient…)] (it becomes background-color and paints nothing)', () => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('bg-[var(--gradient'))
    expect(offenders.map((f) => f.split(/[\\/]src[\\/]/).pop())).toEqual([])
  })
})
