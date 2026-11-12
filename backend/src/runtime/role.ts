export type ProcessRole = 'api' | 'worker' | 'all'

export function parseProcessRole(raw: string | undefined = process.env.ROLE): ProcessRole {
  const norm = (raw ?? 'all').trim().toLowerCase()
  if (norm === 'api' || norm === 'worker' || norm === 'all') {
    return norm
  }
  throw new Error(`INVALID_PROCESS_ROLE: expected api|worker|all, got "${raw}"`)
}

export function shouldStartHttpApi(role: ProcessRole): boolean {
  return role === 'api' || role === 'all'
}

export function shouldStartWorkers(role: ProcessRole): boolean {
  return role === 'worker' || role === 'all'
}
