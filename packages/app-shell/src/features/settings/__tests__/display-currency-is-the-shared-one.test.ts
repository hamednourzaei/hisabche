// «ارز نمایش روی این دستگاه» (24 Oct 2026). A gold business read «AFN» here:
// the card kept a currency of its own in the shell's UI store, started at AFN,
// and nothing read it. There is ONE currency preference — the product's
// (`useCurrencyStore`, through `useDisplayBasis`) — and this card is a view of it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const strip = (source: string) =>
  source
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
    .join('\n')

const settings = strip(readFileSync(join(__dirname, '..', 'settings-page.tsx'), 'utf8'))
const uiStore = strip(
  readFileSync(join(__dirname, '..', '..', '..', 'shared', 'stores', 'ui.store.ts'), 'utf8'),
)

describe('the device display-currency card', () => {
  it('reads and writes the shared preference, not one of its own', () => {
    expect(settings).toContain('useDisplayBasis')
    expect(settings).not.toContain('useUiStore')
    expect(settings).not.toContain("'AFN'")
  })

  it('offers what the shared hook offers (books currency + currencies with a rate)', () => {
    expect(settings).toContain('display.availableBases')
    expect(settings).not.toContain('CURRENCY_CODES')
  })

  it('choosing the books currency stores «no choice», so a later change of books is followed', () => {
    expect(settings).toContain('next === display.base ? null : next')
  })

  it('the shell UI store no longer keeps a currency', () => {
    expect(uiStore).not.toMatch(/currency/i)
  })
})
