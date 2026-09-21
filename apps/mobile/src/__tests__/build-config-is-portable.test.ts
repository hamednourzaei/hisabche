// ============================================
// ⚠️ A BUILD CONFIG THAT ONLY WORKS ON SOME NODE VERSIONS.
//
// Vite hands its config file to Node, and whether Node can read TypeScript
// depends on the VERSION: 22.22 strips types, 22.13 does not. The mobile
// config was `.ts`, so `pnpm build:shell` succeeded on a laptop and died on
// the EAS machine — which runs the version pinned in `eas.json` — with:
//
//   failed to load config from .../vite.shell.config.ts
//   SyntaxError: Unexpected token '{'
//
// Nothing local catches that: the command works here, every test is green,
// and the failure appears only after a two-minute upload, in a log nobody
// reads until the build fails.
//
// The configs are plain ESM JavaScript now, with their types declared beside
// them. These tests keep them that way.
// ============================================

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const mobileRoot = join(__dirname, '..', '..')
const repoRoot = join(mobileRoot, '..', '..')
const shellRoot = join(repoRoot, 'packages/app-shell')

describe('the build config runs on the build machine too', () => {
  it('⚠️ neither config is TypeScript', () => {
    expect(existsSync(join(mobileRoot, 'vite.shell.config.mjs'))).toBe(true)
    expect(existsSync(join(shellRoot, 'vite.shell.mjs'))).toBe(true)

    // The `.ts` versions must be GONE, not left beside the new ones: vite
    // would pick whichever the command names, and the old one still breaks.
    expect(existsSync(join(mobileRoot, 'vite.shell.config.ts'))).toBe(false)
    expect(existsSync(join(shellRoot, 'vite.shell.ts'))).toBe(false)
  })

  it('⚠️ the script and the package entry point at the .mjs files', () => {
    const mobilePkg = JSON.parse(readFileSync(join(mobileRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    // A script still naming the `.ts` file is the bug back, whatever the disk
    // says.
    expect(mobilePkg.scripts['build:shell']).toContain('vite.shell.config.mjs')
    expect(mobilePkg.scripts['build:shell']).not.toContain('.ts')

    const shellPkg = JSON.parse(readFileSync(join(shellRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, string>
    }
    expect(shellPkg.exports['./vite.shell']).toBe('./vite.shell.mjs')
  })

  it('⚠️ the shared config carries no TypeScript syntax at all', () => {
    const source = readFileSync(join(shellRoot, 'vite.shell.mjs'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')

    // The three that a `.mjs` file cannot contain and that Node 22.13 chokes
    // on: an interface, a type import, and an annotated parameter list.
    expect(source).not.toMatch(/^\s*export interface /m)
    expect(source).not.toMatch(/\bimport type\b/)
    expect(source).not.toMatch(/\): UserConfig \{/)
  })

  it('⚠️ its types are still declared, so hosts are type-checked', () => {
    // Dropping TypeScript from the config must not mean dropping the types —
    // desktop imports `shellRendererConfig` from TypeScript and has to be
    // told when it passes the wrong shape.
    const types = readFileSync(join(shellRoot, 'vite.shell.d.ts'), 'utf8')
    expect(types).toContain('export declare function shellRendererConfig')
    expect(types).toContain('singleFile')
  })

  it('⚠️ the build output is not uploaded to the build machine', () => {
    // `.gitignore` does not stop eas-cli: it packs the working directory, so
    // an ignored 6.5 MB build output still travelled — and a STALE one would
    // let a build succeed with a UI from somebody's laptop rather than from
    // the commit being built.
    const easignore = readFileSync(join(mobileRoot, '.easignore'), 'utf8')
    expect(easignore).toContain('assets/shell/')
  })
})
