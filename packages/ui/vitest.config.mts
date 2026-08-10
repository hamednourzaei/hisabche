import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Hook tests (row selection, bulk actions) render through React, which
    // needs a DOM. The pure token/format tests are unaffected by running in
    // jsdom, so one environment keeps the config simple.
    environment: 'jsdom',
    globals: false,
  },
})
