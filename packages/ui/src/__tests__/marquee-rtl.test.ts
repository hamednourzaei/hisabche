// The trust-bar marquee showed an EMPTY ribbon in fa/af for part of every loop.
// In RTL the copies are laid out leftward from the right edge; the component
// "fixed" RTL by reversing animation-direction, which starts the track shifted
// one whole copy to the left — wider than the screen — so nothing was visible.
// Measured in the browser: coverage fell to 0% at loop start. The travel is now
// mirrored through --marquee-shift (-1 LTR, +1 RTL) and stays at 100%.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const config = readFileSync(join(__dirname, '../../tailwind.config.ts'), 'utf8')
const marquee = readFileSync(join(__dirname, '../components/ui/marquee.tsx'), 'utf8').replace(
  /^\s*\/\/.*$/gm,
  '',
)

describe('marquee loops seamlessly in RTL', () => {
  it('the keyframe travel is signed by --marquee-shift', () => {
    expect(config).toContain('var(--marquee-shift, -1) * (100% + var(--gap))')
  })

  it('RTL flips the sign instead of reversing the animation', () => {
    expect(marquee).toContain('rtl:[--marquee-shift:1]')
    expect(marquee).not.toContain('rtl:[animation-direction')
  })
})
