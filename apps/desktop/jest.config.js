/** Unit + component tests. Playwright handles E2E separately. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/../../packages/app-shell/src', '<rootDir>/electron'],
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
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', module: 'commonjs' } }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@hisabche)/)'],
}
