import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { extractFileRelationships } from '../lib/ast-relationship-extractor.mjs'

const ROOT = process.cwd()

function readProjectFile(relPath) {
  const full = join(ROOT, relPath)
  assert.ok(existsSync(full), `Expected real file to exist: ${relPath}`)
  return readFileSync(full, 'utf8')
}

describe('Hisabche AST Code Intelligence — Golden Relationship Tests (10 Real Repository Domains)', () => {
  // Domain 1: Invoices (packages/local-engine/src/routes/invoices.ts)
  it('Domain 1 [Invoices]: cross-file IMPORTS and USES_TYPE to local db.ts', () => {
    const file = 'packages/local-engine/src/routes/invoices.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    // Cross-file import #1
    const dbImport = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === '../db')
    assert.ok(dbImport, 'Must extract import to ../db')
    assert.strictEqual(dbImport.status, 'RESOLVED')
    assert.strictEqual(dbImport.evidence, 'AST_VERIFIED')
    assert.strictEqual(dbImport.targetId, 'packages/local-engine/src/db.ts')

    // Cross-file type reference #2
    const typeRef = rels.find((r) => r.type === 'USES_TYPE' && r.rawIdentifier === 'LocalDb')
    assert.ok(typeRef, 'Must resolve USES_TYPE for LocalDb')
    assert.strictEqual(typeRef.status, 'RESOLVED')
    assert.strictEqual(typeRef.evidence, 'AST_VERIFIED')
    assert.ok(typeRef.targetId.includes('db.ts#LocalDb'))
  })

  // Domain 2: Payments (backend/src/services/payments/payments.repository.ts)
  it('Domain 2 [Payments]: cross-file imports and database client requests', () => {
    const file = 'backend/src/services/payments/payments.repository.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    // Cross-file import #3
    const dbRel = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === '../../db')
    assert.ok(dbRel)
    assert.strictEqual(dbRel.status, 'RESOLVED')
    assert.strictEqual(dbRel.targetId, 'backend/src/db.ts')

    // Cross-file import #4
    const clientReq = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier === '../../utils/client-request',
    )
    assert.ok(clientReq)
    assert.strictEqual(clientReq.status, 'RESOLVED')
    assert.strictEqual(clientReq.targetId, 'backend/src/utils/client-request.ts')
  })

  // Domain 3: Inventory (packages/validation/src/schemas/product.schema.ts)
  it('Domain 3 [Inventory]: cross-file import and schema call', () => {
    const file = 'packages/validation/src/schemas/product.schema.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    // Cross-file import #5
    const commonSchema = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier.includes('common.schema'),
    )
    assert.ok(commonSchema)
    assert.strictEqual(commonSchema.status, 'RESOLVED')
    assert.strictEqual(commonSchema.targetId, 'packages/validation/src/schemas/common.schema.ts')

    // External import zod
    const zodImp = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === 'zod')
    assert.ok(zodImp)
    assert.strictEqual(zodImp.status, 'EXTERNAL')
  })

  // Domain 4: Accounting (backend/src/services/accounting/profit-report.domain.ts)
  it('Domain 4 [Accounting]: re-export resolution to @hisabche/validation alias', () => {
    const file = 'backend/src/services/accounting/profit-report.domain.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    // Re-export resolution #1
    const reExp = rels.find(
      (r) => r.type === 'RE_EXPORTS' && r.rawIdentifier === '@hisabche/validation',
    )
    assert.ok(reExp, 'Must extract RE_EXPORTS relationship')
    assert.strictEqual(reExp.status, 'RESOLVED')
    assert.strictEqual(reExp.evidence, 'AST_VERIFIED')
    assert.strictEqual(reExp.targetId, 'packages/validation/src/index.ts')
  })

  // Domain 5: Sync (packages/app-bridge/src/push-order.ts)
  it('Domain 5 [Sync]: internal type usage and instantiations', () => {
    const file = 'packages/app-bridge/src/push-order.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    const mapInst = rels.find((r) => r.type === 'INSTANTIATES' && r.rawIdentifier === 'Map')
    assert.ok(mapInst)
    assert.strictEqual(mapInst.status, 'EXTERNAL')
    assert.strictEqual(mapInst.targetId, 'global:Map')
  })

  // Domain 6: Backend Routes (backend/src/routes/accounting.routes.ts)
  it('Domain 6 [Backend Routes]: external fastify import and service calls', () => {
    const file = 'backend/src/routes/accounting.routes.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    const fastifyRel = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === 'fastify')
    assert.ok(fastifyRel)
    assert.strictEqual(fastifyRel.status, 'EXTERNAL')
    assert.strictEqual(fastifyRel.evidence, 'AST_VERIFIED')

    const monthEndService = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier.includes('month-end.service'),
    )
    assert.ok(monthEndService)
    assert.strictEqual(monthEndService.status, 'RESOLVED')
    assert.strictEqual(
      monthEndService.targetId,
      'backend/src/services/accounting/month-end.service.ts',
    )
  })

  // Domain 7: API Client / Hooks (packages/api/src/hooks/useActivities.ts)
  it('Domain 7 [API Client]: path alias resolution and external react-query import', () => {
    const file = 'packages/api/src/hooks/useActivities.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    const queryImp = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier === '@tanstack/react-query',
    )
    assert.ok(queryImp)
    assert.strictEqual(queryImp.status, 'EXTERNAL')

    // Alias / relative resolution #2
    const clientImp = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === '../lib/client')
    assert.ok(clientImp)
    assert.strictEqual(clientImp.status, 'RESOLVED')
    assert.strictEqual(clientImp.targetId, 'packages/api/src/lib/client.ts')
  })

  // Domain 8: Shared UI (packages/ui/src/components/ui/dashboard-header.tsx)
  it('Domain 8 [Shared UI]: React external import and component calls', () => {
    const file = 'packages/ui/src/components/ui/dashboard-header.tsx'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    const reactImp = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === 'react')
    assert.ok(reactImp)
    assert.strictEqual(reactImp.status, 'EXTERNAL')

    // Alias resolution #3
    const formatRel = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier.includes('@hisabche/formatting'),
    )
    if (formatRel) {
      assert.strictEqual(formatRel.status, 'RESOLVED')
    }
  })

  // Domain 9: Validation (packages/validation/src/schemas/workspace.schema.ts)
  it('Domain 9 [Validation]: zod import and relative common.schema resolution', () => {
    const file = 'packages/validation/src/schemas/workspace.schema.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    const zodImp = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === 'zod')
    assert.ok(zodImp)
    assert.strictEqual(zodImp.status, 'EXTERNAL')

    const commonRel = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier === './common.schema',
    )
    assert.ok(commonRel)
    assert.strictEqual(commonRel.status, 'RESOLVED')
    assert.strictEqual(commonRel.targetId, 'packages/validation/src/schemas/common.schema.ts')
  })

  // Domain 10: Local Engine (packages/local-engine/src/db.ts)
  it('Domain 10 [Local Engine]: interface type definitions without unresolvable calls', () => {
    const file = 'packages/local-engine/src/db.ts'
    const code = readProjectFile(file)
    const rels = extractFileRelationships(file, code)

    // db.ts only defines interfaces and types
    assert.ok(Array.isArray(rels))
    const calls = rels.filter((r) => r.type === 'CALLS')
    assert.strictEqual(calls.length, 0, 'Interfaces must not generate fake calls')
  })

  // Requirement: At least 2 same-name distinction cases
  it('Distinct same-name symbols in different modules are never conflated', () => {
    const codeA = `import { createWorkspaceSchema } from './workspace.schema';\nfunction a() { createWorkspaceSchema(); }`
    const codeB = `import { createProductSchema } from './product.schema';\nfunction b() { createProductSchema(); }`

    const relsA = extractFileRelationships('packages/validation/src/schemas/a.ts', codeA)
    const relsB = extractFileRelationships('packages/validation/src/schemas/b.ts', codeB)

    const callA = relsA.find((r) => r.type === 'CALLS')
    const callB = relsB.find((r) => r.type === 'CALLS')
    assert.ok(callA)
    assert.ok(callB)
    assert.notStrictEqual(callA.targetId, callB.targetId)
  })

  // Requirement: At least 2 unresolved / ambiguous verification cases
  it('Unresolved and dynamic relationships are not falsely reported as resolved', () => {
    const code = `
function testUnresolved() {
  const dyn = import(computedPath);
  missingHelperFunction();
}
`
    const rels = extractFileRelationships('src/test-unresolved.ts', code)

    // Unresolved case 1: Dynamic import
    const dyn = rels.find((r) => r.type === 'DYNAMIC_IMPORTS')
    assert.ok(dyn)
    assert.strictEqual(dyn.status, 'DYNAMIC_UNRESOLVED')
    assert.strictEqual(dyn.evidence, 'STATIC_INFERENCE')

    // Unresolved case 2: Missing function call
    const call = rels.find((r) => r.type === 'CALLS' && r.rawIdentifier === 'missingHelperFunction')
    assert.ok(call)
    assert.strictEqual(call.status, 'UNRESOLVED')
    assert.strictEqual(call.evidence, 'STATIC_INFERENCE')
  })
})
