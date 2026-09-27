// The camera scan button (27 Sep 2026): drawn only where the host has a
// camera, a code goes to the SAME handler the keyboard scanner feeds, and
// «camera not allowed» is said — not shown as «no barcode».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CameraScanButton } from '../components/ui/invoice-builder/camera-scan-button'
import { registerCameraScanner } from '../lib/barcode/camera-host'

const t = (key: string) => key

afterEach(() => {
  cleanup()
  registerCameraScanner(null)
})

describe('CameraScanButton', () => {
  it('draws nothing without a camera host (desktop, browser)', () => {
    const { container } = render(<CameraScanButton t={t} onCode={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('a scanned code goes to onCode', async () => {
    registerCameraScanner({ scan: async () => ({ status: 'scanned', code: '6260100001234' }) })
    const onCode = vi.fn()
    render(<CameraScanButton t={t} onCode={onCode} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'barcode.cameraScan' }))
    })
    expect(onCode).toHaveBeenCalledWith('6260100001234')
  })

  it('closing the camera does nothing — no row, no message', async () => {
    registerCameraScanner({ scan: async () => ({ status: 'cancelled' }) })
    const onCode = vi.fn()
    render(<CameraScanButton t={t} onCode={onCode} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(onCode).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('camera not allowed is SAID', async () => {
    registerCameraScanner({ scan: async () => ({ status: 'denied' }) })
    render(<CameraScanButton t={t} onCode={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })
    expect(screen.getByRole('alert').textContent).toBe('barcode.cameraDenied')
  })
})

describe('camera texts exist in all three languages (t() throws on a missing key)', () => {
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const messages = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'i18n', 'messages', lang, 'common.json'),
        'utf8',
      ),
    ) as { barcode: Record<string, string> }
    for (const key of ['cameraScan', 'cameraDenied', 'cameraTitle', 'cameraCancel']) {
      expect(messages.barcode[key], `${lang}: barcode.${key}`).toBeTruthy()
    }
  })
})
