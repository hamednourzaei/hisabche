// ============================================
// backend/src/routes/email-otp.routes.ts
//
// V54 5.1 — email one-time codes for the signed-in person's OWN address.
// Infrastructure only: sending is off until EMAIL_OTP_ENABLED === 'true'
// (the email subscription is not bought yet).
//
//   GET  /api/auth/email-otp/status   { enabled, configured, verified }
//   POST /api/auth/email-otp/request  send a code to the account's email
//   POST /api/auth/email-otp/verify   { code } → VERIFIED | WRONG | EXPIRED | LOCKED
//
// ⚠️ `authenticate` only, and that is right here: every route reads and writes
// the caller's OWN codes for the caller's OWN address (BUG-101 rule). The
// address is the account's, never one from the body.
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'

import { sendFailure } from '../errors/http-failure'
import { authenticate } from '../middleware/auth.middleware'
import { emailOtpStatus, requestEmailOtp, verifyEmailOtp } from '../services/auth/email-otp.service'

const verifyBody = z.object({ code: z.string().min(1).max(32) }).strict()
const requestBody = z.object({ lang: z.enum(['fa', 'af', 'en']).optional() }).strict()

/** One budget per person, not per IP (the server sits behind a shared proxy). */
const perUser = (request: FastifyRequest) => `otp:${request.userId ?? request.ip}`

export async function emailOtpRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/auth/email-otp/status',
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        return reply.send(await emailOtpStatus(request.userId, request.user.email ?? ''))
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to read the email verification')
      }
    },
  )

  fastify.post(
    '/api/auth/email-otp/request',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 5, timeWindow: '10 minutes', keyGenerator: perUser } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = requestBody.parse(request.body ?? {})
        const result = await requestEmailOtp(
          request.userId,
          request.user.email ?? '',
          body.lang ?? 'fa',
        )
        return reply.status(202).send(result)
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to send the email code')
      }
    },
  )

  fastify.post(
    '/api/auth/email-otp/verify',
    {
      preHandler: [authenticate],
      config: { rateLimit: { max: 10, timeWindow: '1 minute', keyGenerator: perUser } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = verifyBody.parse(request.body)
        const verdict = await verifyEmailOtp(request.userId, request.user.email ?? '', body.code)
        return reply.status(verdict === 'VERIFIED' ? 200 : 422).send({ verdict })
      } catch (err) {
        return sendFailure(reply, request.log, err, 'Failed to verify the email code')
      }
    },
  )
}
