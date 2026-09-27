// barcode.scan on the phone (27 Sep 2026): one scan at a time, and every
// request answered — a second request, the first code, or «closed».
import { finishScan, isScanning, onScanRequest, requestScan } from '../camera-scan'

describe('camera scan controller', () => {
  afterEach(() => finishScan({ status: 'cancelled' }))

  it('opens the overlay and answers with the first code', async () => {
    const seen: boolean[] = []
    const off = onScanRequest((active) => seen.push(active))
    const scan = requestScan()
    expect(isScanning()).toBe(true)
    finishScan({ status: 'scanned', code: '6260100001234' })
    await expect(scan).resolves.toEqual({ status: 'scanned', code: '6260100001234' })
    expect(seen).toEqual([true, false])
    off()
  })

  it('a second frame with a code does not answer twice', async () => {
    const scan = requestScan()
    finishScan({ status: 'scanned', code: 'A' })
    finishScan({ status: 'scanned', code: 'B' })
    await expect(scan).resolves.toEqual({ status: 'scanned', code: 'A' })
    expect(isScanning()).toBe(false)
  })

  it('a new request answers the old one as cancelled — never left hanging', async () => {
    const first = requestScan()
    const second = requestScan()
    await expect(first).resolves.toEqual({ status: 'cancelled' })
    finishScan({ status: 'scanned', code: 'X' })
    await expect(second).resolves.toEqual({ status: 'scanned', code: 'X' })
  })
})
