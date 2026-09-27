// Reported 26 Sep 2026: a signed-in person could not open the home page — /fa
// sent them straight to the dashboard. The cause was an `AuthGate` around the
// landing that ran `router.replace('/dashboard')` for any stored session.
// Public pages (home, blog, features, legal, docs…) are for everyone; only the
// (dashboard) route group gates on sign-in.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB = join(__dirname, '../../../../apps/web')
const LANG = join(WEB, 'app/[lang]')

// Where a redirect for a signed-in person is the feature, not a bug.
const GATED = new Set(['(dashboard)', 'login', 'signup', 'onboarding', 'accept-invite'])

// Comments explain the removed redirect and would otherwise trip the guard.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

function publicSources(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      if (dir === LANG && GATED.has(name)) continue
      out.push(...publicSources(full))
    } else if (/\.tsx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

// Bodies of `useEffect(() => { … }, [` — code that runs on load, not on a click.
function effectBodies(src: string): string[] {
  return [...src.matchAll(/useEffect\(\s*\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[/g)].map((m) => m[1]!)
}

describe('public pages stay open to a signed-in person', () => {
  const files = publicSources(LANG)

  it('finds the public pages it guards', () => {
    const names = files.map((f) => relative(LANG, f).split(sep).join('/'))
    expect(names).toContain('page.tsx')
    expect(names.some((n) => n.startsWith('features/'))).toBe(true)
    expect(names.some((n) => n.startsWith('legal/'))).toBe(true)
  })

  it('no effect on a public page navigates to the dashboard', () => {
    const offenders = files.filter((f) =>
      effectBodies(strip(readFileSync(f, 'utf8'))).some(
        (body) => /router\.(replace|push)\(|redirect\(/.test(body) && body.includes('dashboard'),
      ),
    )
    expect(offenders.map((f) => relative(LANG, f))).toEqual([])
  })

  it('no public server component redirects to the dashboard', () => {
    const offenders = files.filter((f) =>
      /\b(permanentRedirect|redirect)\([^)]*dashboard/.test(strip(readFileSync(f, 'utf8'))),
    )
    expect(offenders.map((f) => relative(LANG, f))).toEqual([])
  })

  it('the home page renders the landing without an auth wrapper', () => {
    const home = strip(readFileSync(join(LANG, 'page.tsx'), 'utf8'))
    expect(home).toContain('<LandingPage')
    expect(home).not.toMatch(/Gate\b/)
    expect(home).not.toContain('useAuthStore')
  })

  it('the proxy does no auth redirect (it only prefixes the locale)', () => {
    const proxy = strip(readFileSync(join(WEB, 'proxy.ts'), 'utf8'))
    expect(proxy).not.toContain('dashboard')
    expect(proxy).not.toMatch(/cookies|authorization|token/i)
  })
})
