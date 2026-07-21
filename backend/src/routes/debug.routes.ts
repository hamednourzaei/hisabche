// backend/src/routes/debug.routes.ts
import { FastifyInstance } from "fastify";

export async function debugRoutes(fastify: FastifyInstance) {
  // ─── لیست همه‌ی Route‌های ثبت‌شده ──────────────────────
  fastify.get('/api/debug/routes', async () => {
    const routes = fastify.printRoutes();
    const routeList = routes.split('\n').filter(r => r.trim());
    
    return {
      success: true,
      totalRoutes: routeList.length,
      routes: routeList,
      hasNotificationRoutes: routeList.some(r => r.includes('notifications')),
      timestamp: new Date().toISOString(),
    };
  });

  // ─── بررسی یک Route خاص ──────────────────────────────────
  fastify.get('/api/debug/check/:path', async (request, reply) => {
    const { path } = request.params as { path: string };
    const routes = fastify.printRoutes();
    const routeList = routes.split('\n').filter(r => r.trim());
    
    const found = routeList.some(r => r.includes(path));
    
    return {
      success: true,
      path: `/${path}`,
      found,
      message: found ? '✅ Route found' : '❌ Route not found',
      timestamp: new Date().toISOString(),
    };
  });

  // ─── اطلاعات سرور ─────────────────────────────────────────
  fastify.get('/api/debug/info', async () => {
    return {
      success: true,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version,
      env: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    };
  });
}