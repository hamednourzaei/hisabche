// ============================================
// Printing.
//
// A4 / invoice output goes through an offscreen BrowserWindow so the renderer
// never blocks. Thermal receipts are pre-encoded as ESC/POS by the renderer and
// sent to the OS spooler as a raw job.
// ============================================

import { BrowserWindow } from 'electron'
import { writeFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { sessionCan } from '@hisabche/auth-core'

const run = promisify(execFile)

export interface PrintHtmlInput {
  html: string
  landscape: boolean
  silent: boolean
  deviceName?: string | undefined
}

export async function printHtml(input: PrintHtmlInput): Promise<boolean> {
  // Validate input
  if (!input.html || typeof input.html !== 'string' || input.html.length > 2_000_000) {
    throw new Error('INVALID_INPUT: Invalid HTML content')
  }

  // Validate device name if provided
  if (input.deviceName && (typeof input.deviceName !== 'string' || input.deviceName.length > 200)) {
    throw new Error('INVALID_INPUT: Invalid device name')
  }

  // Check authentication
  const { sessionStore } = await import('../../shared/lib/storage')
  const session = await sessionStore.read()
  if (!session?.token) {
    throw new Error('UNAUTHORIZED: No valid session')
  }

  // Check authorization (printing requires record.create permission)
  if (!sessionCan(session, 'record.create')) {
    throw new Error('FORBIDDEN: Insufficient permissions for printing')
  }

  // Validate printer device if provided
  if (input.deviceName) {
    // Additional printer-specific validation can be added here
    // For now, just ensure the device name format is safe
    if (
      input.deviceName.includes(';') ||
      input.deviceName.includes('&') ||
      input.deviceName.includes('|')
    ) {
      throw new Error('INVALID_INPUT: Device name contains invalid characters')
    }
  }

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true },
  })

  try {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(input.html)}`)
    return await new Promise<boolean>((resolve) => {
      win.webContents.print(
        {
          silent: input.silent,
          printBackground: true,
          landscape: input.landscape,
          ...(input.deviceName ? { deviceName: input.deviceName } : {}),
        },
        (success) => resolve(success),
      )
    })
  } finally {
    win.destroy()
  }
}

/**
 * Send a raw ESC/POS byte stream to a thermal printer.
 * Electron has no raw-print API, so the platform spooler is used directly.
 */
export async function printEscPos(dataBase64: string, deviceName?: string): Promise<boolean> {
  const file = join(tmpdir(), `hisabche-receipt-${Date.now()}.bin`)
  await writeFile(file, Buffer.from(dataBase64, 'base64'))

  try {
    if (process.platform === 'win32') {
      const target = deviceName ? `\\\\localhost\\${deviceName}` : 'PRN'
      await run('cmd', ['/c', 'copy', '/b', file, target])
      return true
    }

    // CUPS on macOS and Linux — `-l` keeps the stream raw.
    await run('lp', deviceName ? ['-d', deviceName, '-o', 'raw', file] : ['-o', 'raw', file])
    return true
  } catch (error) {
    console.error('[print] ESC/POS job failed:', error)
    return false
  } finally {
    await unlink(file).catch(() => undefined)
  }
}
