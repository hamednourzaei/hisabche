// ============================================
// backend/src/__tests__/http-failure-diagnostics.test.ts
//
// A 500 must say which database code it was, and a known refusal must not
// be turned into a 500. See errors/http-failure.ts.
// ============================================

import Fastify from 'fastify'
import { describe, expect, it } from 'vitest'

import { DatabaseError, NotFoundError } from '../errors/database.error'
import { sendFailure } from '../errors/http-failure'

async function answer(err: unknown) {
  const app = Fastify()
  app.get('/x', async (_request, reply) => sendFailure(reply, app.log, err, 'Failed to do it'))
  const response = await app.inject({ method: 'GET', url: '/x' })
  await app.close()
  return response
}

describe('sendFailure', () => {
  it('a missing branch is 404, not 500', async () => {
    const response = await answer(new NotFoundError('Branch'))
    expect(response.statusCode).toBe(404)
  })

  it('a database failure carries its code, never its message', async () => {
    const response = await answer(
      new DatabaseError('Failed to fetch roles', {
        code: '42703',
        message: 'column roles.code does not exist',
      }),
    )
    expect(response.statusCode).toBe(500)
    const body = response.json()
    expect(body).toMatchObject({ error: 'Failed to do it', dbCode: '42703' })
    expect(JSON.stringify(body)).not.toContain('roles.code')
  })

  it('an operational code at the front of the message is surfaced', async () => {
    const response = await answer(
      new DatabaseError('EMPLOYEE_BRANCH_NOT_MIGRATED: table missing', { code: '42P01' }),
    )
    expect(response.json()).toMatchObject({ code: 'EMPLOYEE_BRANCH_NOT_MIGRATED', dbCode: '42P01' })
  })
})
