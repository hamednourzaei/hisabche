// ============================================
// Host platform, read once from the main process.
// Used for accelerator labels (⌘ vs Ctrl) and window chrome.
// ============================================

import { useEffect, useState } from 'react'

import { bridge } from '@/shared/lib/bridge'

export function usePlatform(): string {
  const [platform, setPlatform] = useState<string>('win32')

  useEffect(() => {
    let cancelled = false
    void bridge()
      ?.app.info()
      .then((info) => {
        if (!cancelled) setPlatform(info.platform)
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [])

  return platform
}
