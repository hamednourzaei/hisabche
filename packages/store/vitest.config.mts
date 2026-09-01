import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The store persists through `localStorage`, and the staleness tests turn
    // on what survives a reload. A node environment has no storage at all, so
    // the persisted branch — the one that caused the outage — would not run.
    environment: 'jsdom',
    globals: false,
  },
})
