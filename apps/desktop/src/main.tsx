// ============================================
// Renderer entry.
//
// Bootstrap order matters: storage adapter first (the API client reads the
// token and language through it), then i18n, then the persisted session.
// ============================================

import React from 'react'
import { createRoot } from 'react-dom/client'

import './styles.css'
import { App } from './app/app'
import { bridge } from './shared/lib/bridge'
import { initDesktopI18n } from './shared/i18n'
import { initStorage } from './shared/lib/storage'
import { useAuthStore } from './features/auth/auth.store'

async function bootstrap(): Promise<void> {
  await initStorage()

  const info = await bridge()?.app.info()
  await initDesktopI18n(info?.locale ?? 'fa-IR')
  await useAuthStore.getState().hydrate()

  const container = document.getElementById('root')
  if (!container) throw new Error('ROOT_MISSING')

  createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

void bootstrap()
