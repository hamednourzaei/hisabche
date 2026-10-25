/** Unit + component tests. Playwright handles E2E separately. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // `src` holds the desktop-side suites that are not Electron-main code — today
  // that is the golden-vector parity test, which proves the shared core computes
  // the same bytes under Jest as under Vitest.
  roots: ['<rootDir>/../../packages/app-shell/src', '<rootDir>/electron', '<rootDir>/src'],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],

  // ⚠️ Jest's default treats EVERY file under `__tests__` as a suite, so a
  // helper that lives beside the tests it serves (`db/__tests__/test-driver.ts`)
  // is reported as «Test suite failed to run». One red line that means nothing,
  // sitting in the output where a real failure would go.
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../packages/app-shell/src/$1',
    '\.css$': '<rootDir>/src/__mocks__/style.js',
  },
  transform: {
    // @noble/hashes (the local engine's checksum) ships ES modules only: it is compiled too.
    '^.+\.(t|j)sx?$': [
      'ts-jest',
      { tsconfig: { jsx: 'react-jsx', module: 'commonjs', allowJs: true } },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(@hisabche|@noble)/)'],
}
