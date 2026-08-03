import type { CreateInvoice } from '@hisabche/validation'

import { useOutboxStore } from '../outbox.store'

const payload = { type: 'sale', total: 100 } as unknown as CreateInvoice

describe('outbox store', () => {
  beforeEach(() => {
    useOutboxStore.setState({ entries: [], lastSyncedAt: null })
  })

  it('queues an entry as pending with zero attempts', () => {
    useOutboxStore.getState().enqueue({ clientId: 'c1', kind: 'invoice.create', payload })

    const [entry] = useOutboxStore.getState().entries
    expect(entry?.status).toBe('pending')
    expect(entry?.attempts).toBe(0)
  })

  it('increments attempts and records the error on failure', () => {
    useOutboxStore.getState().enqueue({ clientId: 'c1', kind: 'invoice.create', payload })
    useOutboxStore.getState().markFailed('c1', 'boom')

    const [entry] = useOutboxStore.getState().entries
    expect(entry?.status).toBe('failed')
    expect(entry?.attempts).toBe(1)
    expect(entry?.lastError).toBe('boom')
  })

  it('drops an entry once it is synced', () => {
    useOutboxStore.getState().enqueue({ clientId: 'c1', kind: 'invoice.create', payload })
    useOutboxStore.getState().remove('c1')

    expect(useOutboxStore.getState().entries).toHaveLength(0)
  })
})
