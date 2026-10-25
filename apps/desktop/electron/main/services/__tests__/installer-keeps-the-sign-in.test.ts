// An update or a reinstall must not sign anyone out (owner, 24 Oct 2026).
// The sign-in lives in userData; these are the two facts that keep it there.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const desktop = join(__dirname, '..', '..', '..', '..')

describe('where the sign-in lives, and what the installer does to it', () => {
  it('the uninstaller does not delete the app data', () => {
    const builder = readFileSync(join(desktop, 'electron-builder.yml'), 'utf8')
    expect(builder).toContain('deleteAppDataOnUninstall: false')
    expect(builder).not.toContain('deleteAppDataOnUninstall: true')
  })

  it('userData is pinned to one folder that does not depend on the app name or version', () => {
    const main = readFileSync(join(desktop, 'electron/main/index.ts'), 'utf8')
    expect(main).toContain(
      "app.setPath('userData', join(app.getPath('appData'), '@hisabche', 'desktop'))",
    )
    // …and it runs before the vault or the database can touch the path.
    expect(main.indexOf('app.setPath')).toBeLessThan(main.indexOf('initDatabase()'))
  })
})
