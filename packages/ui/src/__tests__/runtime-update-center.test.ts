import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...collectKeys(v as Record<string, unknown>, full))
    } else {
      out.push(full)
    }
  }
  return out.sort()
}

describe('Slice S6 — RuntimeUpdateCenter 3-language i18n parity & design token compliance', () => {
  it('defines identical runtimeUpdate keys across fa, af, and en bundles', () => {
    const readLocale = (lang: string) => {
      const p = path.resolve(process.cwd(), `../i18n/messages/${lang}/common.json`)
      const json = JSON.parse(fs.readFileSync(p, 'utf8')) as {
        runtimeUpdate?: Record<string, unknown>
      }
      expect(json.runtimeUpdate).toBeDefined()
      return collectKeys(json.runtimeUpdate!)
    }

    const fa = readLocale('fa')
    const af = readLocale('af')
    const en = readLocale('en')
    expect(fa.length).toBeGreaterThanOrEqual(15)
    expect(af).toEqual(fa)
    expect(en).toEqual(fa)
  })

  it('uses logical RTL classes and design tokens without hardcoded hex colors', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ui/updates/runtime-update-center.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).toContain('text-start')
    expect(src).toContain('ms-2')
  })
})
