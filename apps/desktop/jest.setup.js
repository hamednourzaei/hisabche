// jsdom omits TextEncoder and btoa; the ESC/POS encoder needs both.
const { TextDecoder, TextEncoder } = require('node:util')

global.TextEncoder = global.TextEncoder ?? TextEncoder
global.TextDecoder = global.TextDecoder ?? TextDecoder

global.btoa =
  global.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64'))
global.atob =
  global.atob ?? ((value) => Buffer.from(value, 'base64').toString('binary'))
