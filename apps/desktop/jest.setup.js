// jsdom omits TextEncoder and btoa; the ESC/POS encoder needs both.
const { TextDecoder, TextEncoder } = require('node:util')

global.TextEncoder = global.TextEncoder ?? TextEncoder
global.TextDecoder = global.TextDecoder ?? TextDecoder

global.btoa =
  global.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64'))
global.atob =
  global.atob ?? ((value) => Buffer.from(value, 'base64').toString('binary'))

// ⚠️ jsdom's crypto has no `randomUUID`.
//
// Every store that mints an id asks for one at import time (the invoice
// draft's submission key), so a suite that imports `@hisabche/store` died
// before its first test with «crypto.randomUUID is not a function» — a
// failure that says nothing about the code under test. Node's own webcrypto
// has it; the definition is forced because jsdom's `crypto` is read-only.
const { webcrypto } = require('node:crypto')

if (typeof global.crypto?.randomUUID !== 'function') {
  Object.defineProperty(global.crypto ?? global, 'randomUUID', {
    value: () => webcrypto.randomUUID(),
    configurable: true,
    writable: true,
  })
}

// Mock @noble/curves for CommonJS Jest environment in Desktop
jest.mock(
  '@noble/curves/ed25519.js',
  () => ({
    ed25519: {
      keygen: () => ({ secretKey: new Uint8Array(32), publicKey: new Uint8Array(32) }),
      sign: () => new Uint8Array(64),
      verify: () => true,
    },
  }),
  { virtual: true },
)
