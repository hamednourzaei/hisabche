// backend/src/routes/debug.routes.ts
import { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { platformAdminGuard } from '../middleware/platform-admin.middleware'

// ⚠️ PLATFORM ADMINS ONLY (audit 7 Nov 2026, AUDIT-80 #14).
//
// These routes list every registered route and report the process's memory,
// uptime, Node version and environment. The global hook in index.ts only
// required a session, so ANY signed-in customer of any business could read
// them — a map of the API and the server's internals handed to every account.
// Nothing in the clients calls them; they are an operator's tool.
const adminOnly = { preHandler: [authenticate, platformAdminGuard] }

export async function debugRoutes(fastify: FastifyInstance) {
  // ─── لیست همه‌ی Route‌های ثبت‌شده ──────────────────────
  fastify.get('/api/debug/routes', adminOnly, async () => {
    const routes = fastify.printRoutes()
    const routeList = routes.split('\n').filter((r) => r.trim())

    return {
      success: true,
      totalRoutes: routeList.length,
      routes: routeList,
      hasNotificationRoutes: routeList.some((r) => r.includes('notifications')),
      timestamp: new Date().toISOString(),
    }
  })

  // ─── بررسی یک Route خاص ──────────────────────────────────
  fastify.get('/api/debug/check/:path', adminOnly, async (request) => {
    const { path } = request.params as { path: string }
    const routes = fastify.printRoutes()
    const routeList = routes.split('\n').filter((r) => r.trim())

    const found = routeList.some((r) => r.includes(path))

    return {
      success: true,
      path: `/${path}`,
      found,
      message: found ? '✅ Route found' : '❌ Route not found',
      timestamp: new Date().toISOString(),
    }
  })

  // ─── اطلاعات سرور ─────────────────────────────────────────
  fastify.get('/api/debug/info', adminOnly, async () => {
    return {
      success: true,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }
  })
}
