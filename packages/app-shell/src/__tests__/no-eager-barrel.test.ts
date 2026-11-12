import fs from 'node:fs'
import path from 'node:path'

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

describe('no eager @hisabche/ui barrel import in app-shell entry (V62 Slice 2)', () => {
  it('forbids importing from the @hisabche/ui root barrel inside packages/app-shell/src/app/**', () => {
    const appDir = path.resolve(__dirname, '../app')
    const files = fs
      .readdirSync(appDir)
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => path.join(appDir, name))

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const clean = stripComments(fs.readFileSync(file, 'utf8'))
      const hasBarrelImport = /from\s+['"]@hisabche\/ui['"]/.test(clean)
      if (hasBarrelImport) {
        throw new Error(
          `${path.basename(file)} must use deep @hisabche/ui/* imports instead of the root barrel`,
        )
      }
      expect(hasBarrelImport).toBe(false)
    }
  })
})
