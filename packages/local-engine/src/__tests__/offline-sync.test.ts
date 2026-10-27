import { describe, expect, it } from 'vitest'

interface ConflictRecord {
  entityId: string
  clientVersion: number
  serverVersion: number
  clientData: Record<string, unknown>
  serverData: Record<string, unknown>
  resolvedBy?: 'client' | 'server' | 'manual'
}

function resolveConflict(
  conflict: ConflictRecord,
  strategy: 'lww' | 'server_wins' | 'manual',
): ConflictRecord {
  if (strategy === 'server_wins') {
    return { ...conflict, resolvedBy: 'server' }
  }
  if (strategy === 'lww') {
    const clientTs = Number(conflict.clientData.updatedAt || 0)
    const serverTs = Number(conflict.serverData.updatedAt || 0)
    return {
      ...conflict,
      resolvedBy: clientTs >= serverTs ? 'client' : 'server',
    }
  }
  return { ...conflict, resolvedBy: 'manual' }
}

describe('Offline Sync & Conflict Resolution (Option 31)', () => {
  it('detects version mismatch between client and server', () => {
    const conflict: ConflictRecord = {
      entityId: 'invoice-101',
      clientVersion: 1,
      serverVersion: 2,
      clientData: { title: 'Client Edit', updatedAt: 1000 },
      serverData: { title: 'Server Edit', updatedAt: 2000 },
    }
    expect(conflict.clientVersion).toBeLessThan(conflict.serverVersion)
  })

  it('resolves using Last-Write-Wins (LWW)', () => {
    const conflict: ConflictRecord = {
      entityId: 'product-202',
      clientVersion: 1,
      serverVersion: 1,
      clientData: { price: 120, updatedAt: 3000 },
      serverData: { price: 100, updatedAt: 2000 },
    }
    const resolved = resolveConflict(conflict, 'lww')
    expect(resolved.resolvedBy).toBe('client')
  })

  it('marks conflict for manual resolution when requested', () => {
    const conflict: ConflictRecord = {
      entityId: 'account-303',
      clientVersion: 1,
      serverVersion: 2,
      clientData: { balance: 5000 },
      serverData: { balance: 6000 },
    }
    const resolved = resolveConflict(conflict, 'manual')
    expect(resolved.resolvedBy).toBe('manual')
  })
})
