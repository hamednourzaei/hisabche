// ============================================
// packages/sync/src/__tests__/durable-outbox.test.ts
//
// Tests for Durable Outbox & Resilient Transport Fallback
// ============================================

import { describe, it, expect, vi } from 'vitest'
import { DurableOutboxManager } from '../durable-outbox-and-fallback'

describe('Durable Outbox & Transport Fallback', () => {
  it('starts in websocket mode and switches to polling after failure threshold', () => {
    const onSwitch = vi.fn()
    const manager = new DurableOutboxManager({
      maxSocketFailuresBeforeFallback: 3,
      onTransportSwitch: onSwitch,
    })

    expect(manager.getTransportState().currentTransport).toBe('websocket')

    manager.recordSocketFailure('Connection reset')
    expect(manager.getTransportState().currentTransport).toBe('websocket')

    manager.recordSocketFailure('Handshake timeout')
    expect(manager.getTransportState().currentTransport).toBe('websocket')

    // 3rd failure reaches threshold
    manager.recordSocketFailure('WSS blocked by ISP')
    expect(manager.getTransportState().currentTransport).toBe('polling')
    expect(onSwitch).toHaveBeenCalledWith('polling', expect.stringContaining('threshold reached'))

    manager.stop()
  })

  it('enqueues mutations into durable outbox and commits them on server ack', () => {
    const manager = new DurableOutboxManager()

    const mutation = manager.enqueueMutation({
      id: 'mut-101',
      idempotencyKey: 'idemp-101',
      workspaceId: 'ws-1',
      endpoint: '/api/invoices',
      method: 'POST',
      payload: { amountMinor: 50000 },
    })

    expect(mutation.status).toBe('pending')
    expect(manager.getPendingMutations().length).toBe(1)

    // Server commits mutation with cursor 42
    manager.commitMutation('mut-101', 42)
    expect(manager.getPendingMutations().length).toBe(0)
    expect(manager.getTransportState().lastSyncedCursor).toBe(42)

    manager.stop()
  })
})
