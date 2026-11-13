import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const adminRoot = 'C:/Users/hamed/Desktop/hisabche/apps/admin'
const skip = new Set(['node_modules', '.next', '__tests__', 'dist'])
const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(ts|tsx)$/.test(entry.name) && entry.name !== 'next-env.d.ts') files.push(full)
  }
}
walk(adminRoot)

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

for (const file of files) {
  const rel = relative(adminRoot, file).replace(/\\/g, '/')
  const source = strip(readFileSync(file, 'utf8'))
  const offenders = []
  if (/<table[\s>]/.test(source)) offenders.push('<table>')
  if (/<select[\s>]/.test(source)) offenders.push('<select>')
  if (/text-\[(?:9|10|11)px\]/.test(source)) offenders.push('small-text')
  if (offenders.length) {
    console.log(`${rel}: ${offenders.join(', ')}`)
    for (const line of source.split('\n')) {
      if (/<table[\s>]|<select[\s>]|text-\[(?:9|10|11)px\]/.test(line)) {
        console.log(`   ${line.trim().slice(0, 140)}`)
      }
    }
  }
}
