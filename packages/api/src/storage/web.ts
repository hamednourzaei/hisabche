// ============================================
// Browser adapter — backed by localStorage.
// Registered automatically so existing web callers need no change.
// ============================================

import { registerStorage, type KeyValueStorage } from './index'

export function createWebStorage(): KeyValueStorage {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  }
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

if (hasLocalStorage()) {
  registerStorage(createWebStorage())
}
