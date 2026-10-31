import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractFileRelationships } from '../lib/ast-relationship-extractor.mjs'

describe('AST Relationship Extractor — Unit Test Suite', () => {
  // 1. Module Relationships (IMPORTS, RE_EXPORTS, DYNAMIC_IMPORTS)
  it('extracts direct and named imports with AST_VERIFIED evidence', () => {
    const code = `
import { createInvoice } from '@hisabche/local-engine';
import express from 'express';
`
    const rels = extractFileRelationships('apps/web/page.ts', code)
    const localEngineImport = rels.find(
      (r) => r.type === 'IMPORTS' && r.rawIdentifier === '@hisabche/local-engine',
    )
    assert.ok(localEngineImport)
    assert.strictEqual(localEngineImport.status, 'RESOLVED')
    assert.strictEqual(localEngineImport.evidence, 'AST_VERIFIED')

    const expressImport = rels.find((r) => r.type === 'IMPORTS' && r.rawIdentifier === 'express')
    assert.ok(expressImport)
    assert.strictEqual(expressImport.status, 'EXTERNAL')
  })

  it('extracts re-export relationships', () => {
    const code = `
export { formatMoney } from './formatting';
`
    const rels = extractFileRelationships('packages/formatting/src/index.ts', code)
    const reExp = rels.find((r) => r.type === 'RE_EXPORTS')
    assert.ok(reExp)
    assert.strictEqual(reExp.evidence, 'AST_VERIFIED')
  })

  it('extracts dynamic imports (both static string and dynamic expression)', () => {
    const code = `
async function load() {
  const mod = await import('@hisabche/validation');
  const dyn = await import(dynamicPath);
}
`
    const rels = extractFileRelationships('src/loader.ts', code)
    const staticImp = rels.find((r) => r.type === 'DYNAMIC_IMPORTS' && r.status === 'RESOLVED')
    assert.ok(staticImp)

    const dynImp = rels.find(
      (r) => r.type === 'DYNAMIC_IMPORTS' && r.status === 'DYNAMIC_UNRESOLVED',
    )
    assert.ok(dynImp)
    assert.strictEqual(dynImp.evidence, 'STATIC_INFERENCE')
  })

  // 2. Symbol CALLS
  it('extracts direct call to imported symbol and resolves target', () => {
    const code = `
import { calculateTotal } from '@hisabche/validation';

export function checkout(items: any[]) {
  return calculateTotal(items);
}
`
    const rels = extractFileRelationships('apps/web/src/cart.ts', code)
    const callRel = rels.find((r) => r.type === 'CALLS' && r.rawIdentifier === 'calculateTotal')
    assert.ok(callRel)
    assert.strictEqual(callRel.status, 'RESOLVED')
    assert.strictEqual(callRel.evidence, 'AST_VERIFIED')
    assert.ok(callRel.targetId.includes('calculateTotal'))
  })

  it('extracts method calls on this inside class', () => {
    const code = `
export class OrderService {
  validate() { return true; }
  process() {
    this.validate();
  }
}
`
    const localSymbols = [
      {
        id: '@hisabche/order/src/order.ts#OrderService',
        name: 'OrderService',
        kind: 'class',
        startLine: 2,
        endLine: 7,
      },
      {
        id: '@hisabche/order/src/order.ts#OrderService.process',
        name: 'OrderService.process',
        kind: 'method',
        startLine: 4,
        endLine: 6,
      },
    ]
    const rels = extractFileRelationships('src/order.ts', code, { fileSymbols: localSymbols })
    const methodCall = rels.find((r) => r.type === 'CALLS' && r.rawIdentifier === 'this.validate')
    assert.ok(methodCall)
    assert.strictEqual(methodCall.status, 'RESOLVED')
    assert.strictEqual(methodCall.evidence, 'AST_VERIFIED')
    assert.ok(methodCall.targetId.includes('OrderService.validate'))
  })

  // 3. Class Heritage (EXTENDS, IMPLEMENTS)
  it('extracts EXTENDS and IMPLEMENTS relationships', () => {
    const code = `
import { BaseEntity } from './base';
import { Serializable } from './interfaces';

export class User extends BaseEntity implements Serializable {
  id = '1';
}
`
    const rels = extractFileRelationships('src/user.ts', code)
    const ext = rels.find((r) => r.type === 'EXTENDS')
    assert.ok(ext)
    assert.strictEqual(ext.rawIdentifier, 'BaseEntity')

    const imp = rels.find((r) => r.type === 'IMPLEMENTS')
    assert.ok(imp)
    assert.strictEqual(imp.rawIdentifier, 'Serializable')
  })

  // 4. Instantiation (INSTANTIATES)
  it('extracts constructor instantiation with new', () => {
    const code = `
import { PaymentsRepository } from '@hisabche/backend';

export function makeRepo() {
  return new PaymentsRepository();
}
`
    const rels = extractFileRelationships('src/factory.ts', code)
    const inst = rels.find((r) => r.type === 'INSTANTIATES')
    assert.ok(inst)
    assert.strictEqual(inst.rawIdentifier, 'PaymentsRepository')
    assert.strictEqual(inst.status, 'RESOLVED')
    assert.strictEqual(inst.evidence, 'AST_VERIFIED')
  })

  // 5. Type References (USES_TYPE)
  it('extracts USES_TYPE for typed parameters', () => {
    const code = `
import { TenancyContext } from '@hisabche/auth';

export function runTask(ctx: TenancyContext) {
  return ctx;
}
`
    const rels = extractFileRelationships('src/task.ts', code)
    const typeRel = rels.find((r) => r.type === 'USES_TYPE')
    assert.ok(typeRel)
    assert.strictEqual(typeRel.rawIdentifier, 'TenancyContext')
  })

  // 6. Test File Relationships (TESTS)
  it('extracts TESTS relationship in test files referencing production symbols', () => {
    const code = `
import { createInvoice } from '@hisabche/local-engine';

test('creates invoice', () => {
  const inv = createInvoice({});
});
`
    const rels = extractFileRelationships(
      'packages/local-engine/src/__tests__/invoice.test.ts',
      code,
    )
    const testRel = rels.find((r) => r.type === 'TESTS')
    assert.ok(testRel, 'TESTS relationship should be extracted')
    assert.strictEqual(testRel.evidence, 'AST_VERIFIED')
    assert.strictEqual(testRel.status, 'RESOLVED')
    assert.ok(testRel.targetId.includes('createInvoice'))
  })

  // 7. Same-name symbols in different files do not get conflated
  it('same-name symbols in different files have separate targetIds', () => {
    const codeA = `
import { createInvoice } from '@hisabche/local-engine';
export function runA() { createInvoice(); }
`
    const codeB = `
import { createInvoice } from '@hisabche/validation';
export function runB() { createInvoice(); }
`
    const relsA = extractFileRelationships('src/a.ts', codeA)
    const relsB = extractFileRelationships('src/b.ts', codeB)

    const callA = relsA.find((r) => r.type === 'CALLS' && r.rawIdentifier === 'createInvoice')
    const callB = relsB.find((r) => r.type === 'CALLS' && r.rawIdentifier === 'createInvoice')
    assert.ok(callA)
    assert.ok(callB)
    assert.notStrictEqual(callA.targetId, callB.targetId)
  })

  // 8. Unresolved function calls
  it('marks unimported unknown calls as UNRESOLVED with STATIC_INFERENCE', () => {
    const code = `
export function compute() {
  return unknownExternalHelper(42);
}
`
    const rels = extractFileRelationships('src/calc.ts', code)
    const unres = rels.find(
      (r) => r.type === 'CALLS' && r.rawIdentifier === 'unknownExternalHelper',
    )
    assert.ok(unres)
    assert.strictEqual(unres.status, 'UNRESOLVED')
    assert.strictEqual(unres.evidence, 'STATIC_INFERENCE')
  })
})
