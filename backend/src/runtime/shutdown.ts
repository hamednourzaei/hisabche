export function registerGracefulShutdown(
  onShutdown: (signal: string) => Promise<void>,
): () => void {
  let shuttingDown = false
  const handler = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    void onShutdown(signal).finally(() => process.exit(0))
  }
  process.once('SIGTERM', () => handler('SIGTERM'))
  process.once('SIGINT', () => handler('SIGINT'))
  return () => {
    shuttingDown = true
  }
}
