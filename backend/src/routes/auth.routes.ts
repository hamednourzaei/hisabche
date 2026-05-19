// ============================================
// Auth Routes — Fastify
// ============================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

interface LoginBody {
  email: string
  password: string
}

interface SignUpBody {
  email: string
  password: string
  fullName: string
  businessName?: string
}

const MOCK_USER = {
  id: 'user-1',
  email: 'demo@hisabche.com',
  fullName: 'احمد محمدی',
  businessName: 'فروشگاه محمدی',
  createdAt: new Date().toISOString(),
}

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/api/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email, password } = request.body as LoginBody

    if (email === 'demo@hisabche.com' && password === 'Demo1234') {
      const token = 'hisabche-jwt-token-' + Date.now()
      return {
        user: MOCK_USER,
        token,
      }
    }

    return reply.status(401).send({
      error: 'Invalid credentials',
      message: 'Email or password is incorrect',
      statusCode: 401,
    })
  })

  fastify.post('/api/auth/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as SignUpBody

    const token = 'hisabche-jwt-token-' + Date.now()
    return {
      user: {
        id: `user-${Date.now()}`,
        email: body.email,
        fullName: body.fullName,
        businessName: body.businessName,
        createdAt: new Date().toISOString(),
      },
      token,
    }
  })

  fastify.post('/api/auth/logout', async () => {
    return { success: true }
  })

  fastify.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'No token provided',
        statusCode: 401,
      })
      return
    }
    return { user: MOCK_USER }
  })
}