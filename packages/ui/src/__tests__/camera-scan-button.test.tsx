// The scan button (27 Sep → 28 Sep 2026). It was drawn only where the phone
// app had a camera, so the website had no scan button at all. Now it is drawn
// everywhere and opens a dialog: a device/typed code + Enter, or the camera
// (the host's scanner, else the browser's). Every code goes to the SAME
// handler the keyboard listener feeds, and «camera not allowed» is said.
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

const openDialog = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'barcode.scanButton' }))
  })
}

describe('CameraScanButton', () => {
  it('is drawn with no camera host too — the website on a computer or phone', () => {
    render(<CameraScanButton t={t} onCode={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'barcode.scanButton' })).toBeTruthy()
  })

  it('a device (or typed) code + Enter goes to onCode, and the dialog reports open/closed', async () => {
    const onCode = vi.fn()
    const onOpenChange = vi.fn()
    render(<CameraScanButton t={t} onCode={onCode} onOpenChange={onOpenChange} />)
    await openDialog()
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    const field = screen.getByPlaceholderText('barcode.hint')
    fireEvent.change(field, { target: { value: ' 6260100001234 ' } })
    await act(async () => {
      fireEvent.submit(field.closest('form')!)
    })
    expect(onCode).toHaveBeenCalledWith('6260100001234')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('an empty code adds nothing', async () => {
    const onCode = vi.fn()
    render(<CameraScanButton t={t} onCode={onCode} />)
    await openDialog()
    await act(async () => {
      fireEvent.submit(screen.getByPlaceholderText('barcode.hint').closest('form')!)
    })
    expect(onCode).not.toHaveBeenCalled()
  })

  it("the phone app's camera: a scanned code goes to onCode", async () => {
    registerCameraScanner({ scan: async () => ({ status: 'scanned', code: '6260100001234' }) })
    const onCode = vi.fn()
    render(<CameraScanButton t={t} onCode={onCode} />)
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'barcode.cameraScan' }))
    })
    expect(onCode).toHaveBeenCalledWith('6260100001234')
  })

  it('closing the camera does nothing — no row, no message', async () => {
    registerCameraScanner({ scan: async () => ({ status: 'cancelled' }) })
    const onCode = vi.fn()
    render(<CameraScanButton t={t} onCode={onCode} />)
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'barcode.cameraScan' }))
    })
    expect(onCode).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('camera not allowed is SAID', async () => {
    registerCameraScanner({ scan: async () => ({ status: 'denied' }) })
    render(<CameraScanButton t={t} onCode={vi.fn()} />)
    await openDialog()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'barcode.cameraScan' }))
    })
    expect(screen.getByRole('alert').textContent).toBe('barcode.cameraDenied')
  })
})

describe('both invoice pages pause their own scanner while the dialog is open', () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  it.each([
    'invoice-builder/containers/invoice-builder-container.tsx',
    'quick-invoice/containers/quick-invoice-container.tsx',
  ])('%s', (rel) => {
    const src = strip(readFileSync(join(__dirname, '..', 'components', 'ui', rel), 'utf8'))
    expect(src).toContain('onOpenChange={setScanDialogOpen}')
    expect(src).toContain('!scanDialogOpen')
    // Drawn unconditionally: no «only where a camera host exists» gate.
    expect(src).not.toContain('getCameraScanner()')
  })
})

describe('the website lets its own pages use the camera', () => {
  //  in Permissions-Policy blocked the browser camera on every page:
  // the button would open, and the camera would always fail.
  it('Permissions-Policy allows camera for our own origin', () => {
    const config = readFileSync(
      join(__dirname, '..', '..', '..', '..', 'apps', 'web', 'next.config.js'),
      'utf8',
    )
    expect(config).toContain("'camera=(self), microphone=(), geolocation=()'")
    expect(config).not.toContain("'camera=(), ")
  })
})

describe('scan texts exist in all three languages (t() throws on a missing key)', () => {
  it.each(['fa', 'af', 'en'])('%s', (lang) => {
    const messages = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', 'i18n', 'messages', lang, 'common.json'),
        'utf8',
      ),
    ) as { barcode: Record<string, string> }
    for (const key of [
      'cameraScan',
      'cameraDenied',
      'cameraTitle',
      'cameraCancel',
      'cameraUnsupported',
      'cameraFailed',
      'scanButton',
      'scanTitle',
      'scanHint',
      'scanAdd',
      'hint',
    ]) {
      expect(messages.barcode[key], `${lang}: barcode.${key}`).toBeTruthy()
    }
  })
})
