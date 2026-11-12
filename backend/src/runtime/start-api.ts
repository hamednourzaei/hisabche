import type { FastifyInstance } from 'fastify'

export async function startApiServer(
  app: FastifyInstance,
  port: number,
  host = '0.0.0.0',
): Promise<void> {
  await app.listen({ port, host })
}
