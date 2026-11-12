import fs from 'node:fs'
import path from 'node:path'

const BUDGETS_PATH = path.resolve(__dirname, '../../bundle-budgets.json')

describe('bundle budgets (V62 Slice 7)', () => {
  it('verifies pack-report.json against measured budgets when a report exists', () => {
    const reportPath =
      process.env.PACK_REPORT_PATH ??
      path.resolve(__dirname, '../../../../.esbuild-tmp/desktop-shell/pack-report.json')

    if (!fs.existsSync(reportPath)) {
      console.warn(
        `[bundle-budgets] SKIPPED: no pack-report.json at ${reportPath}. Run shell Vite build + node scripts/packs/report.mjs first.`,
      )
      return
    }

    const budgets = JSON.parse(fs.readFileSync(BUDGETS_PATH, 'utf8')) as {
      measuredAt: string | null
      coreEntryMaxGzipBytes: number | null
      packsMaxGzipBytes: Record<string, number>
    }

    expect(typeof budgets.coreEntryMaxGzipBytes).toBe('number')

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
      coreEntry: { gzipBytes: number }
      packs: Record<string, { gzipBytes: number }>
    }

    expect(report.coreEntry.gzipBytes).toBeLessThanOrEqual(budgets.coreEntryMaxGzipBytes!)
    for (const [packId, maxGzip] of Object.entries(budgets.packsMaxGzipBytes)) {
      const actual = report.packs[packId]?.gzipBytes ?? 0
      expect(actual).toBeLessThanOrEqual(maxGzip)
    }
  })
})
