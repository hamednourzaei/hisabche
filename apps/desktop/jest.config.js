/** Unit + component tests. Playwright handles E2E separately. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/src', '<rootDir>/electron'],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\.css$': '<rootDir>/src/__mocks__/style.js',
  },
  transform: {
    '^.+\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', module: 'commonjs' } }],
  },
  transformIgnorePatterns: ['node_modules/(?!(@hisabche)/)'],
}
