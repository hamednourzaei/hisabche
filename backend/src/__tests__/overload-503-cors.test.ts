// ============================================
// A 503 from the overload / maintenance hook must be readable by the browser.
//
// The hook runs before the CORS plugin is registered, so its 503 carried no
// Access-Control-Allow-Origin: the web app saw a «CORS error» instead of «busy, retry».
// ============================================
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(__dirname, '..', 'index.ts'), 'utf8')

describe('503 before CORS', () => {
  it('both early 503s expose themselves to an allowed browser origin', () => {
    const hook = source.slice(
      source.indexOf("server.addHook('onRequest', async (request, reply) => {"),
    )
    const overloaded = hook.indexOf("error: 'SERVICE_OVERLOADED'")
    const readOnly = hook.indexOf("error: 'SERVICE_READ_ONLY'")
    expect(overloaded).toBeGreaterThan(-1)
    expect(readOnly).toBeGreaterThan(-1)
    expect(hook.slice(0, overloaded)).toContain('exposeToBrowser(request, reply)')
    expect(hook.slice(overloaded, readOnly)).toContain('exposeToBrowser(request, reply)')
  })

  it('uses the same allow-list as the CORS plugin, with credentials', () => {
    const helper = source.slice(source.indexOf('function exposeToBrowser('))
    expect(helper).toContain('browserOrigins(isProduction).includes(origin)')
    expect(helper).toContain("'Access-Control-Allow-Credentials', 'true'")
  })
})
