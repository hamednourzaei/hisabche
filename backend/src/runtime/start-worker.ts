import type { FastifyInstance } from 'fastify'

export interface WorkerHandle {
  stop: () => Promise<void>
}

export function startWorkerLoop(onTick: () => Promise<void>, intervalMs = 60_000): WorkerHandle {
  const timer = setInterval(() => {
    void onTick().catch(() => undefined)
  }, intervalMs)
  if (typeof timer.unref === 'function') timer.unref()

  return {
    async stop() {
      clearInterval(timer)
    },
  }
}

export async function startWorkerHealthServer(
  app: FastifyInstance,
  port: number,
  host = '0.0.0.0',
): Promise<void> {
  await app.listen({ port, host })
}
