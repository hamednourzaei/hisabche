import { describe, expect, it, afterEach } from 'vitest'
import { parseProcessRole, shouldStartHttpApi, shouldStartWorkers } from '../../runtime/role'
import { PressureMonitor } from '../../runtime/pressure'
import {
  deriveServiceMode,
  getServiceModeState,
  isWriteBlocked,
  setServiceModeInput,
} from '../../runtime/service-mode'

describe('C.4.1, C.4.4, C.4.5 Process roles, Load shedding, Degraded modes', () => {
  afterEach(() => {
    setServiceModeInput({ primaryWritable: true, replicaLagExceeded: false, underPressure: false })
  })

  it('parses ROLE=api|worker|all and gates HTTP vs worker loops', () => {
    expect(shouldStartHttpApi(parseProcessRole('api'))).toBe(true)
    expect(shouldStartWorkers(parseProcessRole('api'))).toBe(false)
    expect(shouldStartHttpApi(parseProcessRole('worker'))).toBe(false)
    expect(shouldStartWorkers(parseProcessRole('worker'))).toBe(true)
    expect(() => parseProcessRole('invalid')).toThrow(/INVALID_PROCESS_ROLE/)
  })

  it('triggers load shedding when event-loop lag exceeds threshold', () => {
    const mon = new PressureMonitor()
    mon.setForcedDelayForTest(400)
    const snap = mon.snapshot({
      maxEventLoopDelayMs: 250,
      maxHeapUsedBytes: 2_000_000_000,
      maxRssBytes: 3_000_000_000,
      retryAfterSeconds: 7,
    })
    expect(snap.overloaded).toBe(true)
    expect(snap.reason).toBe('event_loop_lag')
    expect(snap.retryAfterSeconds).toBe(7)
  })

  it('switches to read_only when primary is down and blocks writes', () => {
    expect(
      deriveServiceMode({
        primaryWritable: false,
        replicaLagExceeded: false,
        underPressure: false,
      }),
    ).toBe('read_only')
    setServiceModeInput({ primaryWritable: false })
    expect(getServiceModeState().mode).toBe('read_only')
    expect(isWriteBlocked()).toBe(true)
  })
})
