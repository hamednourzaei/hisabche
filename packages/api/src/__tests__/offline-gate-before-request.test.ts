// A request the offline endpoint matrix refuses never reaches the engine: the
// client answers with the engine's own 501 body and announces it, so the shell
// can tell the person «this needs the online edition».
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import apiClient, {
  onOfflineRefusal,
  registerLocalTransport,
  setAppEdition,
  type LocalTransportRequest,
  type OfflineRefusal,
} from '../lib/client'

let sent: LocalTransportRequest[] = []
let refusals: OfflineRefusal[] = []
let stop: () => void = () => {}

beforeEach(() => {
  sent = []
  refusals = []
  setAppEdition('offline')
  registerLocalTransport(async (request) => {
    sent.push(request)
    return { status: 200, data: { ok: true } }
  })
  stop = onOfflineRefusal((refusal) => refusals.push(refusal))
})

afterEach(() => {
  stop()
  setAppEdition('cloud')
})

describe('the offline gate before the request', () => {
  it('lets an available endpoint through to the engine', async () => {
    const res = await apiClient.get('/invoices')
    expect(res.status).toBe(200)
    expect(sent.map((r) => r.path)).toEqual(['/invoices'])
    expect(refusals).toEqual([])
  })

  it('refuses an online_required endpoint WITHOUT calling the engine, and says which feature', async () => {
    const error = await apiClient.get('/billing/plans').catch((e: unknown) => e)
    expect(sent).toEqual([])
    expect(refusals).toEqual([
      {
        feature: 'billing.portal',
        availability: 'online_required',
        method: 'GET',
        path: '/billing/plans',
      },
    ])
    expect(error).toMatchObject({
      response: {
        status: 501,
        data: {
          code: 'OFFLINE_NOT_AVAILABLE',
          feature: 'billing.portal',
          details: { availability: 'online_required' },
        },
      },
    })
  })

  it('words a not_supported endpoint as not_supported', async () => {
    const error = await apiClient.post('/auth/login', {}).catch((e: unknown) => e)
    expect(sent).toEqual([])
    expect(error).toMatchObject({
      response: { data: { details: { availability: 'not_supported' } } },
    })
  })

  it('does nothing in the cloud edition', async () => {
    setAppEdition('cloud')
    expect(refusals).toEqual([])
  })
})
