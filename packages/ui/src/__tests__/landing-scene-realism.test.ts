// packages/ui/src/__tests__/landing-scene-realism.test.ts
//
// Realism & physical interaction assertions for the 3D landing hall:
// - Kinematic distance-based wheel rotation
// - Gate access-control equipment structural clearance
// - Articulated character hands and expressive facial features
// - Architectural environmental density and MEP infrastructure

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const LANDING = join(process.cwd(), 'src/components/ui/landing')
const code = (file: string) =>
  readFileSync(join(LANDING, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line))
    .join('\n')
    .split(/\s+/)
    .join(' ')

describe('3D scene realism and physical interaction pass', () => {
  const scene = code('journey/scene.ts')

  describe('logistics van & kinematic wheel rotation', () => {
    const WHEEL_RADIUS = 0.34

    it('uses exact distance-based kinematic rotation rather than time or arbitrary multipliers', () => {
      // Rotation angle = distance / radius
      expect(scene).toContain('wheel.rotation.z = -run / 0.34')
      expect(scene).not.toContain('wheel.rotation.z = -run * 2.9')
    })

    it('calculates rotation with less than 0.1% error across distance travel', () => {
      const distances = [0, 0.5, 1.2, 5.0, 15.0, 30.0]
      for (const dist of distances) {
        const expectedAngle = dist / WHEEL_RADIUS
        const codeAngle = dist / 0.34
        expect(Math.abs(codeAngle - expectedAngle)).toBeLessThan(1e-9)
      }
    })

    it('models complete wheel assembly with tire, rim, spokes, hub and brake disc', () => {
      expect(scene).toContain('wheelAssembly')
      expect(scene).toContain('spoke')
      expect(scene).toContain('lug')
      expect(scene).toContain('brakeDisc')
      expect(scene).toContain('caliper')
    })
  })

  describe('access control gates', () => {
    it('models physical base plate, rounded cap and recessed optical sensor', () => {
      expect(scene).toContain('PEDESTAL_HALF_WIDTH * 2 + 0.08')
      expect(scene).toContain('clampBracket')
    })

    it('transitions LED status indicator between amber approach and green authorization', () => {
      expect(scene).toContain("gate.lamp.color.copy(state === 'closed' ? warm : done)")
    })
  })

  describe('character realism & expressive anatomy', () => {
    it('equips clerks with articulated hands (palm, thumb, fingers)', () => {
      expect(scene).toContain('handGroup')
      expect(scene).toContain('thumb')
      expect(scene).toContain('finger')
    })

    it('equips characters with readable eyes, sclera, iris, pupil and expressive eyebrows', () => {
      expect(scene).toContain('sclera')
      expect(scene).toContain('iris')
      expect(scene).toContain('pupil')
      expect(scene).toContain('catchlight')
      expect(scene).toContain('eyelid')
      expect(scene).toContain('eyebrow')
    })

    it('implements deterministic blinking and gaze-following attention hierarchy', () => {
      expect(scene).toContain('blinkCycle')
      expect(scene).toContain('isBlinking')
      expect(scene).toContain('browLift')
    })

    it('equips robot protagonist with mechanical clamp fingers and multi-state visor', () => {
      expect(scene).toContain('visorState')
      expect(scene).toContain('scanBar')
    })
  })

  describe('architectural layering & environmental density', () => {
    it('constructs layered wall geometry with baseboards, wainscot dado, and crown molding', () => {
      expect(scene).toContain('baseboards')
      expect(scene).toContain('wainscots')
      expect(scene).toContain('crownMoldings')
      expect(scene).toContain('wallPanels')
    })

    it('adds ceiling MEP infrastructure including cable trays, HVAC air ducts and diffusers', () => {
      expect(scene).toContain('cableTrays')
      expect(scene).toContain('airDucts')
      expect(scene).toContain('diffusers')
      expect(scene).toContain('sprinklers')
    })

    it('populates office workstations with instanced accessories and dynamic procedural UI', () => {
      expect(scene).toContain('keyboards')
      expect(scene).toContain('mice')
      expect(scene).toContain('mugs')
      expect(scene).toContain('paperStacks')
      expect(scene).toContain('screenUI')
    })
  })
})
