// The sync page's stage texts exist in all three desktop locales, and the Dari
// (fa-AF) sync texts are DARI. Eight of them were Pashto («همغږي ناکام شو»,
// «قطار خالي دی»…) until 27 Sep 2026 — a Dari user read them in another
// language, and nothing failed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCALES = join(__dirname, '..', '..', '..', '..', '..', 'i18n', 'src', 'locales')
const read = (file: string) =>
  JSON.parse(readFileSync(join(LOCALES, file), 'utf8')) as { sync: Record<string, unknown> }

const REQUIRED = [
  'stage.queued',
  'stage.sending',
  'stage.retrying',
  'stage.rejected',
  'stage.committed',
  'col.record',
  'col.operation',
  'col.stage',
  'col.reason',
  'col.time',
  'op.create',
  'op.update',
  'op.delete',
  'entity.invoice',
  'entity.customer',
  'entity.product',
  'entity.transaction',
  'committedTitle',
  'committedHint',
  'rejectedHint',
]

const at = (obj: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj)

describe('sync stage texts', () => {
  it.each(['en.json', 'fa-IR.json', 'fa-AF.json'])('%s has every key', (file) => {
    const sync = read(file).sync
    const missing = REQUIRED.filter(
      (k) => typeof at(sync, k) !== 'string' || !String(at(sync, k)).trim(),
    )
    expect(missing).toEqual([])
  })

  it('⚠️ the Dari sync texts contain no Pashto-only letters', () => {
    const PASHTO_ONLY = /[ږښېۍټډړڼګ]/
    const offenders = Object.entries(read('fa-AF.json').sync)
      .flatMap(([k, v]) =>
        typeof v === 'string'
          ? [[k, v] as const]
          : Object.entries(v as object).map(([kk, vv]) => [`${k}.${kk}`, String(vv)] as const),
      )
      .filter(([, v]) => PASHTO_ONLY.test(v))
    expect(offenders).toEqual([])
  })
})
