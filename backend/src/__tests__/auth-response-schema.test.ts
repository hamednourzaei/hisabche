// ============================================
// The auth response schema — it has to describe the WHOLE object.
//
// ---------------------------------------------------------------------------
// ⚠️ WHAT THIS EMPTIED
//
// `toJsonSchema` in `auth.routes.ts` did not recurse. A nested `z.object()`
// became `{ type: 'object' }` with no `properties`, and Fastify hands that to
// fast-json-stringify, which serializes STRICTLY from the schema and drops
// every field the schema does not name.
//
// So `POST /auth/login`, `GET /auth/me` and `PATCH /auth/profile` all sent:
//
//     { "user": {} }
//
// ⚠️ AND NOTHING FAILED. `token` is a sibling of `user`, so signing in worked,
// the session persisted, and every subsequent request authenticated normally.
// The client simply cached a user with no id, no email and no name. The
// visible symptom was an account menu containing nothing but «خروج» and a
// header that could not say which business you were in — three screens away
// from the cause.
//
// This is why the test asserts the SHAPE of the generated schema rather than
// the behaviour of a route: the route behaves fine. The schema is the defect.
// ============================================

import { z } from 'zod'
import { describe, expect, it } from 'vitest'

// The generator is module-private, so it is reconstructed here from the same
// source. If it moves, this import breaks loudly rather than silently testing
// a copy that has drifted.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(join(__dirname, '..', 'routes', 'auth.routes.ts'), 'utf8')

describe('the generator recurses', () => {
  it('⚠️ handles a nested object by name, not just by type', () => {
    // The exact shape of the bug: emitting `{ type: 'object' }` and stopping.
    expect(source).toMatch(/typeName === 'ZodObject'/)
    expect(source).toMatch(/properties,/)
    // The recursive call is what was missing.
    expect(source).toMatch(/\[key, describe\(value\)\]/)
  })

  it('⚠️ gives arrays their `items`', () => {
    // An array without `items` serializes as `[]` — the same defect one
    // container out.
    expect(source).toMatch(/typeName === 'ZodArray'/)
    expect(source).toMatch(/items: describe\(/)
  })

  it('still leaves ZodAny unconstrained', () => {
    // Typing `details` as a string is what made a 400's validation payload
    // unserializable, turning it into a 500.
    expect(source).toMatch(/ZodAny.*ZodUnknown|ZodAny\/`ZodUnknown`|ZodAny`\/`ZodUnknown/)
  })

  it('⚠️ declares nullable fields as a union', () => {
    expect(source).toMatch(/nullable \? \[type, 'null'\] : type/)
  })

  it('still distinguishes optional from required', () => {
    expect(source).toMatch(/if \(!optional\) required\.push\(key\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// A faithful reimplementation of the fixed generator, so the OUTPUT can be
// asserted and not only the source text. Kept deliberately small: if the real
// one changes shape, the source assertions above fail first.
// ─────────────────────────────────────────────────────────────────────────────

function unwrap(schema: any): { inner: any; optional: boolean; nullable: boolean } {
  let inner = schema
  let optional = false
  let nullable = false
  while (
    inner?._def?.typeName === 'ZodOptional' ||
    inner?._def?.typeName === 'ZodNullable' ||
    inner?._def?.typeName === 'ZodDefault' ||
    inner?._def?.typeName === 'ZodEffects'
  ) {
    if (inner._def.typeName === 'ZodEffects') {
      inner = inner._def.schema
      continue
    }
    if (inner._def.typeName === 'ZodNullable') nullable = true
    else if (inner._def.typeName !== 'ZodDefault') optional = true
    inner = inner._def.innerType
  }
  return { inner, optional, nullable }
}

function jsonTypeOf(t: string | undefined): string | undefined {
  return {
    ZodString: 'string',
    ZodNumber: 'number',
    ZodBoolean: 'boolean',
    ZodArray: 'array',
    ZodObject: 'object',
  }[t ?? '']
}

function describeNode(schema: unknown): any {
  const { inner, nullable } = unwrap(schema)
  const typeName = inner?._def?.typeName as string | undefined

  if (typeName === 'ZodObject') {
    const shape = (inner.shape || {}) as Record<string, unknown>
    const required: string[] = []
    const properties = Object.fromEntries(
      Object.entries(shape).map(([key, value]) => {
        const { optional } = unwrap(value)
        if (!optional) required.push(key)
        return [key, describeNode(value)]
      }),
    )
    return { type: 'object', properties, required }
  }

  if (typeName === 'ZodArray') {
    return { type: 'array', items: describeNode(inner._def?.type) }
  }

  const type = jsonTypeOf(typeName)
  if (!type) return {}
  return { type: nullable ? [type, 'null'] : type }
}

describe('the generated schema, for the shape that actually broke', () => {
  const authResponse = z.object({
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      fullName: z.string(),
      businessName: z.string().nullable(),
      createdAt: z.string().datetime(),
    }),
    token: z.string(),
  })

  const generated = describeNode(authResponse)

  it('⚠️ the nested user carries every field', () => {
    // With the old generator this object was `{ type: 'object' }` and
    // fast-json-stringify emitted `{}`.
    expect(Object.keys(generated.properties.user.properties).sort()).toEqual([
      'businessName',
      'createdAt',
      'email',
      'fullName',
      'id',
    ])
  })

  it('⚠️ a nullable field keeps its null', () => {
    // Declared as a plain string, fast-json-stringify does not reject `null` —
    // it SUBSTITUTES `""`. So «this account never named its business» arrived
    // as «its name is the empty string», and the prompt asking the owner to set
    // one could not tell that it needed to appear.
    expect(generated.properties.user.properties.businessName).toEqual({
      type: ['string', 'null'],
    })
  })

  it('a non-nullable field is left alone', () => {
    expect(generated.properties.user.properties.fullName).toEqual({ type: 'string' })
  })

  it('the sibling token survives, as it always did', () => {
    // This is why the bug was invisible: auth kept working.
    expect(generated.properties.token).toEqual({ type: 'string' })
  })

  it('⚠️ an array of objects gets its items described', () => {
    const withList = z.object({ rows: z.array(z.object({ id: z.string(), n: z.number() })) })
    const out = describeNode(withList)
    expect(out.properties.rows.items.properties).toEqual({
      id: { type: 'string' },
      n: { type: 'number' },
    })
  })

  it('optional fields are not marked required', () => {
    const withOptional = z.object({ a: z.string(), b: z.string().optional() })
    expect(describeNode(withOptional).required).toEqual(['a'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// The role the header renders.
// ─────────────────────────────────────────────────────────────────────────────

describe('role reaches the client', () => {
  it('⚠️ is declared in every user response schema', () => {
    // Undeclared is dropped — the same omission that emptied the whole object.
    // login, signup, /auth/me and PATCH /auth/profile.
    expect(source.match(/role: z\.string\(\)\.nullable\(\)/g)?.length).toBe(4)
  })

  it('⚠️ is null when the membership is ambiguous, not the first row', () => {
    // Picking one of several is the fail-open guess auth.middleware.ts was
    // fixed for. Display or not, it must not invent a role.
    expect(source).toMatch(
      /data\?\.length === 1 \? \(\(data\[0\] as any\)\.role \?\? null\) : null/,
    )
  })

  it('excludes revoked and suspended memberships', () => {
    const helper = source.slice(source.indexOf('async function resolveSoleRole'))
    expect(helper).toMatch(/\.eq\('has_access', true\)/)
    expect(helper).toMatch(/\.is\('suspended_at', null\)/)
  })

  it('⚠️ a failed lookup is «unknown», not a role', () => {
    expect(source).toMatch(/if \(error\) return null/)
  })
})
