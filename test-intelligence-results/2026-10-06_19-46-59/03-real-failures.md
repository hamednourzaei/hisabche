# Real Failures

- feature: UI/Design
- test: gradients and focus ring match
- file: src/__tests__/parity.test.ts
- line: 184
- command: pnpm run test (design-tokens)
- error: AssertionError: expected 'linear-gradient(...)' to be 'linear-gradient(...)'
- classification: TEST BUG
- evidence: CSS string formatting mismatch in test assertions versus globals.css
- severity: LOW

- feature: UI/Design
- test: --glass-bg matches globals.css
- file: src/__tests__/parity.test.ts
- line: 107
- command: pnpm run test (design-tokens)
- error: AssertionError: expected 'rgba(16, 24, 32, 0.8)' to be 'rgba(16, 24, 32, 0.80)'
- classification: TEST BUG
- evidence: Decimal trailing zero mismatch
- severity: LOW
