// ============================================
// Guard: execution-site-not-device-class.test.ts
//
// Guarantees:
// 1. `execution-site.ts` contains ZERO imports from runtime-policy.
// 2. Contains no reference to hardware heuristics: DeviceClass, memoryGb, classifyDevice.
// Execution site is strictly a pure decision based on data readiness,
// local transport presence and active workspace (§2.1).
// ============================================

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

describe('V68.3 Guard — Execution Site Decoupled from Device Class / Hardware', () => {
  test('execution-site.ts does not reference runtime-policy or device class symbols', () => {
    const file = path.resolve(__dirname, '../lib/execution-site.ts')
    expect(fs.existsSync(file)).toBe(true)

    const content = fs.readFileSync(file, 'utf8')
    // Strip comments
    const stripped = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')

    expect(stripped).not.toContain('runtime-policy')
    expect(stripped).not.toContain('DeviceClass')
    expect(stripped).not.toContain('classifyDevice')
    expect(stripped).not.toContain('memoryGb')
    expect(stripped).not.toContain('hardwareConcurrency')
  })
})
