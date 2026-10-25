// The reusable motion library — a catalogue built FROM the source, not beside it.
//
// Nothing here is a second motion system and nothing is rendered: the catalogue reads the real
// TypeScript (components, operators, primitives, typography, engine maths, templates, sound
// library) and the real reels (timelines, scene kinds, themes, cues), and records for each asset:
// a stable id, where it lives, its parameters, what it imports, its provenance/licence, who uses
// it and one example. The editable source stays where it is; the catalogue only points at it.
//
//   node scripts/motion-catalogue.mjs build            writes docs/motion-catalogue/{registry.json,CATALOGUE.md}
//   node scripts/motion-catalogue.mjs search type=scene-component style=paper-pocket
//   node scripts/motion-catalogue.mjs search tag=typography dep=anim.ts used=false
//
// Search fields: type · tag · name · style (theme) · kind (scene kind) · dep (an import it needs) ·
// restriction (text in its licence/provenance) · min / max (seconds, for reels and scenes) ·
// used=true|false · reel=NN.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'docs', 'motion-catalogue')
const posix = (p) => p.split(path.sep).join('/')
const rel = (abs) => posix(path.relative(ROOT, abs))

/** Where motion source lives, and what an export from there is. */
const SOURCE_DIRS = [
  { dir: 'src/scenes', family: 'scene' },
  { dir: 'src/motion-operators', family: 'operator' },
  { dir: 'src/templates', family: 'template' },
  { dir: 'src/ui', family: 'ui' },
  { dir: 'src/creative', family: 'creative' },
  { dir: 'src/freestyle', family: 'freestyle' },
  { dir: 'src/components', family: 'component' },
  { dir: 'src/engine', family: 'engine' },
]

const TAG_RULES = [
  [
    'typography',
    /Kinetic|Text|Type|Word|Headline|Typo|Rich|Persian|Subtitle|Caption|Numeral|Teleprompter/i,
  ],
  ['transition', /Transition|Swish|Whoosh|Wipe|Cut\b|Morph|Dissolve|Reveal/i],
  ['background', /Background|Backdrop|Stage|Texture|Grid|Fog|Glow|Canvas|Ambient|Atmosphere/i],
  ['product-demo', /Mockup|Pos\b|Invoice|Dashboard|Capture|Terminal|Receipt|Ledger/i],
  ['chart', /Chart|Graph|Waterfall|Odometer|Counter|Bar\b/i],
  ['character', /Avatar|Person|Figure|Character/i],
  ['sound', /Cue|Sound|Audio|Foley/i],
]

const isComponentName = (name) => /^[A-Z]/.test(name)

function analyze(abs) {
  const text = fs.readFileSync(abs, 'utf8')
  const kind = abs.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  const sf = ts.createSourceFile(abs, text, ts.ScriptTarget.ES2022, true, kind)
  const line = (node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const docOf = (node) => {
    const ranges = ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []
    return (
      ranges
        .map((r) =>
          text
            .slice(r.pos, r.end)
            .replace(/^\/\*+|\*+\/$/g, '')
            .replace(/^\s*\/\/ ?/gm, '')
            .replace(/^\s*\* ?/gm, '')
            .trim(),
        )
        .filter(Boolean)
        .slice(-1)[0] ?? ''
    )
  }
  const paramsOf = (fn) => {
    const first = fn.parameters?.[0]
    if (!first) return []
    const typeNode = first.type
    const members =
      typeNode && ts.isTypeLiteralNode(typeNode)
        ? typeNode.members.map((m) => ({
            name: m.name?.getText(sf) ?? '?',
            type: m.type?.getText(sf) ?? 'unknown',
            optional: Boolean(m.questionToken),
          }))
        : []
    if (ts.isObjectBindingPattern(first.name)) {
      return first.name.elements.map((el) => {
        const name = (el.propertyName ?? el.name).getText(sf)
        const found = members.find((m) => m.name === name)
        return {
          name,
          type: found?.type ?? 'unknown',
          optional: Boolean(el.initializer) || Boolean(found?.optional),
        }
      })
    }
    if (typeNode && !members.length)
      return [{ name: first.name.getText(sf), type: typeNode.getText(sf), optional: false }]
    return members
  }
  const imports = []
  const exportsFound = []
  const push = (name, what, node, fn) =>
    exportsFound.push({
      name,
      what,
      line: line(node),
      doc: docOf(node),
      params: fn ? paramsOf(fn) : [],
    })

  for (const stmt of sf.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      const names = []
      const clause = stmt.importClause
      if (clause?.name) names.push(clause.name.text)
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements)
          names.push((el.propertyName ?? el.name).text)
      }
      imports.push({ from: stmt.moduleSpecifier.text, names })
      continue
    }
    const exported =
      ts.canHaveModifiers(stmt) &&
      ts.getModifiers(stmt)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (!exported) continue
    if (ts.isFunctionDeclaration(stmt) && stmt.name) push(stmt.name.text, 'function', stmt, stmt)
    else if (ts.isVariableStatement(stmt)) {
      for (const d of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue
        const init = d.initializer
        const fn =
          init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : undefined
        push(d.name.text, fn ? 'function' : 'const', stmt, fn)
      }
    } else if (ts.isInterfaceDeclaration(stmt)) push(stmt.name.text, 'type', stmt)
    else if (ts.isTypeAliasDeclaration(stmt)) push(stmt.name.text, 'type', stmt)
    else if (ts.isClassDeclaration(stmt) && stmt.name) push(stmt.name.text, 'class', stmt)
  }
  const header = text
    .split('\n')
    .slice(0, 40)
    .filter((l) => /^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n')
  const provenance = header
    .split('\n')
    .map((l) => l.replace(/^\s*(\/\/|\/\*+|\*+\/?)\s?/, '').trim())
    .filter((l) =>
      /inspired|reference|licen[cs]e|\bMIT\b|CC0|CC BY|copyright|adapted|technique only/i.test(l),
    )
  return { imports, exports: exportsFound, provenance }
}

function resolveImport(fromAbs, spec) {
  if (!spec.startsWith('.')) return null
  const base = path.resolve(path.dirname(fromAbs), spec)
  for (const candidate of [
    base + '.ts',
    base + '.tsx',
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    base,
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function classify(family, file, name, what) {
  if (what === 'type') return 'type'
  if (/Cues?$/.test(name) || /Cues$/.test(name.replace(/\(\)$/, ''))) return 'sound-cues'
  if (family === 'scene') return isComponentName(name) ? 'scene-component' : 'scene-helper'
  if (family === 'operator') return isComponentName(name) ? 'motion-operator' : 'operator-helper'
  if (family === 'template') return isComponentName(name) ? 'viral-template' : 'template-helper'
  if (family === 'ui') {
    if (/typography/.test(file)) return 'typography'
    return isComponentName(name) ? 'ui-primitive' : 'ui-helper'
  }
  if (family === 'engine') {
    if (/anim\.ts$/.test(file) || /math\.ts$/.test(file)) return 'animation-math'
    if (/motion-(presets|plan|config)/.test(file)) return 'motion-preset'
    if (/sound\.ts$/.test(file)) return 'sound-engine'
    return 'engine-rule'
  }
  return isComponentName(name) ? `${family}-component` : `${family}-helper`
}

const tagsOf = (name, file) =>
  TAG_RULES.filter(([, re]) => re.test(name) || re.test(path.basename(file))).map(([tag]) => tag)

function listSources() {
  const files = []
  for (const { dir, family } of SOURCE_DIRS) {
    const abs = path.join(ROOT, dir)
    if (!fs.existsSync(abs)) continue
    for (const name of fs.readdirSync(abs).sort()) {
      if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !/\.d\.ts$/.test(name))
        files.push({ abs: path.join(abs, name), family })
    }
  }
  return files
}

function soundLibrary() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'assets', 'sfx', 'manifest.json'), 'utf8'),
  )
  const licences = new Map()
  const md = fs.readFileSync(path.join(ROOT, 'assets', 'sfx', 'LICENSES.md'), 'utf8')
  for (const l of md.split(/\r?\n/)) {
    if (!l.startsWith('|')) continue
    const p = l.split('|').map((x) => x.trim())
    if (p.length >= 6) {
      const file = p[1].replace(/`/g, '')
      if (/\.(ogg|mp3)$/.test(file))
        licences.set(file, {
          source: p[2].replace(/\[Link\]\(([^)]*)\)/, '$1'),
          licence: p[4].replace(/\*/g, ''),
        })
    }
  }
  const files = []
  for (const [kind, list] of Object.entries(manifest)) {
    for (const file of list)
      files.push({
        file,
        kind,
        ...(licences.get(file) ?? { source: null, licence: 'NOT DOCUMENTED' }),
      })
  }
  const music = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'assets', 'music', 'manifest.json'), 'utf8'),
  ).map((m) => ({
    file: m.file,
    mood: m.mood,
    bpm: m.bpm,
    ...(licences.get(m.file) ?? { source: null, licence: 'NOT DOCUMENTED' }),
  }))
  return {
    kinds: Object.keys(manifest).sort(),
    files,
    music,
    syncRules: 'scripts/sync-law.mjs (AV SYNC LAW, CLAUDE.md §15)',
  }
}

export async function buildRegistry() {
  const sources = listSources()
  const analysis = new Map(sources.map((s) => [s.abs, analyze(s.abs)]))

  // Assets: one per export that is a component, helper or rule (types are listed but not "assets").
  const assets = []
  const byFileName = new Map()
  for (const { abs, family } of sources) {
    const a = analysis.get(abs)
    const deps = a.imports.map((i) => ({ module: i.from, names: i.names }))
    for (const ex of a.exports) {
      const id = `${rel(abs)
        .replace(/^src\//, '')
        .replace(/\.(ts|tsx)$/, '')}#${ex.name}`
      const type = classify(family, rel(abs), ex.name, ex.what)
      const asset = {
        id,
        name: ex.name,
        type,
        tags: tagsOf(ex.name, abs),
        source: { path: rel(abs), line: ex.line },
        params: ex.params,
        dependencies: deps,
        doc: ex.doc,
        provenance: a.provenance,
        licence: a.provenance.length ? 'see provenance notes' : 'project source (Hisabche)',
        usedBy: [],
        themes: [],
        example: null,
      }
      assets.push(asset)
      byFileName.set(`${abs}::${ex.name}`, asset)
    }
  }

  // Usage: import-based (a reel that imports the symbol), from every reel source file.
  const reelDir = path.join(ROOT, 'src', 'reels')
  const reelFiles = fs
    .readdirSync(reelDir)
    .filter((n) => /\.ts$/.test(n) && n !== 'index.ts' && n !== 'shared.ts')
    .sort()
  const reelSources = new Map()
  for (const name of reelFiles) {
    const abs = path.join(reelDir, name)
    const text = fs.readFileSync(abs, 'utf8')
    const a = analyze(abs)
    reelSources.set(name, {
      abs,
      text,
      a,
      ids: [...text.matchAll(/\bid:\s*'(\d{2})'/g)].map((m) => m[1]),
    })
    for (const imp of a.imports) {
      const target = resolveImport(abs, imp.from)
      if (!target) continue
      for (const n of imp.names) {
        const asset = byFileName.get(`${target}::${n}`)
        if (!asset) continue
        const at =
          text
            .split('\n')
            .findIndex(
              (l) =>
                new RegExp(`\\b${n}\\b`).test(l) &&
                !/^\s*import\b/.test(l) &&
                !/^\s*\}?\s*from\b/.test(l),
            ) + 1
        asset.usedBy.push({ file: rel(abs), line: at || null })
      }
    }
  }
  for (const asset of assets) {
    asset.usedBy.sort((x, y) => x.file.localeCompare(y.file))
    asset.example = asset.usedBy[0] ?? null
  }

  // Reels: timelines straight from the registered reel objects.
  const server = await createServer({
    root: ROOT,
    server: { middlewareMode: true, hmr: false, watch: null },
    logLevel: 'error',
  })
  let REELS
  let registry
  let cuesOf
  try {
    ;({ REELS } = await server.ssrLoadModule('/src/reels/index.ts'))
    registry = await server.ssrLoadModule('/src/data/reel-registry.ts')
    ;({ reelCues: cuesOf } = await server.ssrLoadModule('/src/scenes/index.tsx'))
  } finally {
    await server.close()
  }
  // `reelNN` → the file `src/reels/index.ts` imports it from (single and grouped imports alike).
  const importedFrom = new Map()
  for (const imp of analyze(path.join(reelDir, 'index.ts')).imports) {
    if (!imp.from.startsWith('./')) continue
    for (const n of imp.names) importedFrom.set(n, imp.from.slice(2))
  }
  // `export { film01 as reel21 }` — the reel is registered under an alias; its source is the original's.
  const indexText = fs.readFileSync(path.join(reelDir, 'index.ts'), 'utf8')
  for (const m of indexText.matchAll(/(\w+)\s+as\s+(reel\d+)/g)) {
    if (importedFrom.has(m[1])) importedFrom.set(m[2], importedFrom.get(m[1]))
  }
  const specKindCounts = new Map()
  const reels = REELS.map((reel) => {
    const id = String(reel.id).padStart(2, '0')
    const registered =
      registry.REEL_REGISTRY?.[id] ?? registry.REEL_REGISTRY_LIST?.find((e) => e.id === id)
    const registeredFile = importedFrom.get(`reel${id}`) ?? importedFrom.get(`reel${Number(id)}`)
    const candidates = [...reelSources.entries()]
      .filter(([, s]) => s.ids.includes(id))
      .map(([n]) => `src/reels/${n}`)
    const sourceFile = registeredFile ? `src/reels/${registeredFile}.ts` : (candidates[0] ?? null)
    const cueKinds = new Set(cuesOf(reel).map((c) => c.kind))
    const scenes = reel.scenes.map((scene) => {
      const spec = scene.spec
      specKindCounts.set(spec.kind, [...(specKindCounts.get(spec.kind) ?? []), id])
      return {
        kind: spec.kind,
        start: scene.start,
        end: scene.end,
        theme: spec.theme ?? null,
        component: typeof spec.component === 'function' ? spec.component.name : null,
        actor: typeof spec.actor === 'string' ? spec.actor : null,
      }
    })
    const imports = reelSources.get(path.basename(sourceFile ?? ''))?.a.imports ?? []
    const usesAssets = assets
      .filter((a) => a.type !== 'type' && a.usedBy.some((u) => u.file === sourceFile))
      .map((a) => a.id)
    const ambiguous = candidates.length > 1 ? candidates : null
    for (const a of assets)
      if (usesAssets.includes(a.id))
        for (const th of [reel.theme, ...scenes.map((s) => s.theme)])
          if (th && !a.themes.includes(th)) a.themes.push(th)
    return {
      id,
      title: reel.title,
      seconds: scenes.length ? scenes[scenes.length - 1].end : 0,
      theme: reel.theme ?? null,
      artDirection: registered?.artDirection ?? null,
      layoutTopology: registered?.layoutTopology ?? null,
      viralTemplate: registered?.viralTemplate ?? null,
      aspectRatio: '9:16 (1080x1920)',
      source: sourceFile,
      sourceNote: !sourceFile
        ? 'SOURCE NOT FOUND'
        : ambiguous
          ? `ID COLLISION: ${ambiguous.join(', ')} all declare id '${id}'`
          : null,
      scenes,
      soundKinds: [...cueKinds].sort(),
      assetsUsed: usesAssets,
      importsFrom: imports.map((i) => i.from),
    }
  })

  const specKinds = [...specKindCounts.entries()]
    .map(([kind, ids]) => ({
      id: `spec-kind:${kind}`,
      kind,
      reels: [...new Set(ids)].sort(),
      scenes: ids.length,
    }))
    .sort((a, b) => a.kind.localeCompare(b.kind))

  return {
    summary: {
      assets: assets.filter((a) => a.type !== 'type').length,
      types: assets.filter((a) => a.type === 'type').length,
      reels: reels.length,
      specKinds: specKinds.length,
      reelsWithoutSource: reels.filter((r) => !r.source).map((r) => r.id),
      reelsWithIdCollision: reels
        .filter((r) => r.sourceNote?.startsWith('ID COLLISION'))
        .map((r) => r.id),
      aspectRatio: '9:16 (1080x1920)',
    },
    assets,
    specKinds,
    reels,
    sounds: soundLibrary(),
  }
}

function renderCatalogue(registry) {
  const lines = []
  const s = registry.summary
  lines.push('# Motion catalogue', '')
  lines.push(
    '> Generated by `node scripts/motion-catalogue.mjs build` — do not edit by hand. Machine-readable twin: `registry.json`.',
  )
  lines.push(
    '> The catalogue POINTS at the editable source (components, operators, primitives, engine maths, reel timelines); it holds no rendered video, no frames, no captures.',
    '',
  )
  lines.push(
    `**${s.assets} assets** · ${s.types} types · **${s.reels} reels** · ${s.specKinds} scene kinds · every reel ${s.aspectRatio}`,
    '',
  )
  if (s.reelsWithoutSource.length)
    lines.push(`⚠️ Reels whose source could not be found: ${s.reelsWithoutSource.join(', ')}`, '')
  if (s.reelsWithIdCollision.length)
    lines.push(
      `⚠️ Reels whose id is declared by more than one file: ${s.reelsWithIdCollision.join(', ')}`,
      '',
    )
  lines.push(
    '## Search',
    '',
    '```',
    'node scripts/motion-catalogue.mjs search type=scene-component style=paper-pocket',
    'node scripts/motion-catalogue.mjs search tag=typography used=false',
    'node scripts/motion-catalogue.mjs search reel=94',
    'node scripts/motion-catalogue.mjs search min=30',
    '```',
    '',
  )
  const byType = new Map()
  for (const a of registry.assets)
    if (a.type !== 'type') byType.set(a.type, [...(byType.get(a.type) ?? []), a])
  lines.push('## Assets by type', '')
  for (const [type, list] of [...byType.entries()].sort()) {
    lines.push(
      `### ${type} (${list.length})`,
      '',
      '| Id | Params | Tags | Used by | Provenance |',
      '| --- | --- | --- | ---: | --- |',
    )
    for (const a of list) {
      const params = a.params.map((p) => `${p.name}${p.optional ? '?' : ''}`).join(', ') || '—'
      lines.push(
        `| \`${a.id}\` | ${params} | ${a.tags.join(', ') || '—'} | ${new Set(a.usedBy.map((u) => u.file)).size} | ${a.provenance.length ? a.provenance[0].slice(0, 70) : a.licence} |`,
      )
    }
    lines.push('')
  }
  lines.push(
    '## Scene kinds (the spec vocabulary)',
    '',
    '| Kind | Scenes | Reels |',
    '| --- | ---: | --- |',
  )
  for (const k of registry.specKinds)
    lines.push(`| \`${k.kind}\` | ${k.scenes} | ${k.reels.join(', ')} |`)
  lines.push(
    '',
    '## Reels',
    '',
    '| Reel | Seconds | Theme | Art direction | Source | Scenes | Note |',
    '| --- | ---: | --- | --- | --- | ---: | --- |',
  )
  for (const r of registry.reels)
    lines.push(
      `| ${r.id} | ${r.seconds} | ${r.theme ?? '—'} | ${r.artDirection ?? '—'} | ${r.source ?? '—'} | ${r.scenes.length} | ${r.sourceNote ?? ''} |`,
    )
  lines.push(
    '',
    '## Sound library',
    '',
    `Kinds: ${registry.sounds.kinds.join(', ')}. Synchronisation rules: ${registry.sounds.syncRules}.`,
    '',
    '| File | Kind | Licence |',
    '| --- | --- | --- |',
  )
  for (const f of registry.sounds.files) lines.push(`| \`${f.file}\` | ${f.kind} | ${f.licence} |`)
  lines.push('')
  return lines.join('\n')
}

export function searchRegistry(registry, query) {
  const has = (hay, needle) =>
    String(hay ?? '')
      .toLowerCase()
      .includes(String(needle).toLowerCase())
  let list = registry.assets.filter((a) => a.type !== 'type')
  if (query.type) list = list.filter((a) => a.type === query.type)
  if (query.tag) list = list.filter((a) => a.tags.includes(query.tag))
  if (query.name) list = list.filter((a) => has(a.name, query.name))
  if (query.style) list = list.filter((a) => a.themes.includes(query.style))
  if (query.dep) list = list.filter((a) => a.dependencies.some((d) => has(d.module, query.dep)))
  if (query.restriction)
    list = list.filter(
      (a) =>
        has(a.licence, query.restriction) || a.provenance.some((p) => has(p, query.restriction)),
    )
  if (query.used) list = list.filter((a) => a.usedBy.length > 0 === (query.used === 'true'))
  if (query.reel)
    list = list.filter((a) =>
      registry.reels.find((r) => r.id === query.reel)?.assetsUsed.includes(a.id),
    )
  if (query.kind) {
    const reels = registry.specKinds.find((k) => k.kind === query.kind)?.reels ?? []
    list = list.filter((a) =>
      registry.reels.some((r) => reels.includes(r.id) && r.assetsUsed.includes(a.id)),
    )
  }
  const reels = registry.reels.filter(
    (r) =>
      (query.min ? r.seconds > Number(query.min) : true) &&
      (query.max ? r.seconds <= Number(query.max) : true) &&
      (query.style ? r.theme === query.style : true) &&
      (query.reel ? r.id === query.reel : true),
  )
  return { assets: list, reels }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [command, ...rest] = process.argv.slice(2)
  const file = path.join(OUT_DIR, 'registry.json')
  if (command === 'build') {
    const registry = await buildRegistry()
    fs.mkdirSync(OUT_DIR, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(registry, null, 2) + '\n')
    fs.writeFileSync(path.join(OUT_DIR, 'CATALOGUE.md'), renderCatalogue(registry))
    console.log(JSON.stringify(registry.summary, null, 2))
  } else if (command === 'search') {
    const registry = JSON.parse(fs.readFileSync(file, 'utf8'))
    const query = Object.fromEntries(rest.map((p) => p.split('=')))
    const found = searchRegistry(registry, query)
    for (const a of found.assets)
      console.log(
        `${a.type.padEnd(16)} ${a.id}  [${a.tags.join(',')}]  used by ${new Set(a.usedBy.map((u) => u.file)).size}`,
      )
    for (const r of found.reels)
      console.log(`reel ${r.id}  ${r.seconds}s  ${r.theme ?? '—'}  ${r.title}`)
    console.log(`${found.assets.length} assets · ${found.reels.length} reels`)
  } else {
    console.log('usage: node scripts/motion-catalogue.mjs build | search key=value ...')
  }
}
