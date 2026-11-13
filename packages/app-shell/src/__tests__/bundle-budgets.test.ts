import fs from 'node:fs'
import path from 'node:path'

const BUDGETS_PATH = path.resolve(__dirname, '../../bundle-budgets.json')

const REPORT_PATH =
  process.env.PACK_REPORT_PATH ??
  path.resolve(__dirname, '../../../../.esbuild-tmp/desktop-shell/pack-report.json')
const HAS_REPORT = fs.existsSync(REPORT_PATH)

// ⚠️ NEVER GREEN BY DEFAULT. Without a measured report this test is SKIPPED
// (reported as skipped, not passed). CI sets REQUIRE_PACK_REPORT=1 after the
// shell build, and then a missing report is a failure.
const runOrSkip = HAS_REPORT ? it : it.skip

describe('bundle budgets (V62 Slice 7)', () => {
  it('a report is present when the build step requires one', () => {
    if (process.env.REQUIRE_PACK_REPORT === '1' && !HAS_REPORT) {
      throw new Error(
        `REQUIRE_PACK_REPORT=1 but no pack-report.json at ${REPORT_PATH}. Run the shell Vite build + node scripts/packs/report.mjs.`,
      )
    }
  })

  runOrSkip('verifies pack-report.json against measured budgets', () => {
    const reportPath = REPORT_PATH

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
      // A budgeted pack missing from the report is a FAILURE, not 0 bytes: a
      // renamed or mis-parsed chunk would otherwise pass every budget silently.
      const measured = report.packs[packId]
      // (No expect message argument: desktop runs this file under Jest too.)
      if (!measured) throw new Error(`pack "${packId}" has a budget but is missing from the report`)
      expect(measured.gzipBytes).toBeLessThanOrEqual(maxGzip)
    }
  })
})
