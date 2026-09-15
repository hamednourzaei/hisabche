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
  it('RTL has its own mirrored keyframe instead of a reversed animation', () => {
    expect(config).toContain("'marquee-rtl'")
    expect(config).toContain('translateX(100%)')
    expect(marquee).toContain('rtl:animate-marquee-rtl')
    expect(marquee).not.toContain('rtl:[animation-direction')
  })

  it('reverse survives the animation shorthand (both rows ran the same way)', () => {
    expect(marquee).toContain("reverse && '![animation-direction:reverse]'")
  })

  it('keyframes carry no var() — the compositor cannot run those', () => {
    const block = config.slice(config.indexOf('marquee: {'), config.indexOf('animation: {'))
    expect(block.length).toBeGreaterThan(50)
    expect(block).not.toContain('var(')
  })
})
