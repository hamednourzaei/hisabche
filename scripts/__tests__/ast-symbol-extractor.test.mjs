import { test, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  extractSymbolsFromSource,
  normalizePath,
  computeSha256,
  inferPackageName,
} from '../lib/ast-symbol-extractor.mjs'

describe('AST Symbol Extractor — Unit Test Suite (20 Fixtures)', () => {
  // 1. Named function
  it('Fixture 1: Named function extraction', () => {
    const code = `
/**
 * Calculates sum
 */
export function add(a: number, b: number): number {
  return a + b;
}
`
    const symbols = extractSymbolsFromSource('src/math.ts', code, { packageName: '@hisabche/math' })
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'add')
    assert.strictEqual(sym.kind, 'function')
    assert.strictEqual(sym.signature, 'export function add(a: number, b: number): number')
    assert.strictEqual(sym.signatureStatus, 'resolved')
    assert.strictEqual(sym.exported, true)
    assert.deepStrictEqual(sym.exportPaths, ['named'])
    assert.strictEqual(sym.startLine, 5)
    assert.strictEqual(sym.endLine, 7)
    assert.strictEqual(sym.doc, 'Calculates sum')
    assert.strictEqual(sym.overloadGroup, null)
  })

  // 2. Async function
  it('Fixture 2: Async function extraction', () => {
    const code = `
export async function fetchData(url: string): Promise<Response> {
  return fetch(url);
}
`
    const symbols = extractSymbolsFromSource('src/net.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'fetchData')
    assert.strictEqual(sym.kind, 'async_function')
    assert.strictEqual(
      sym.signature,
      'export async function fetchData(url: string): Promise<Response>',
    )
    assert.strictEqual(sym.signatureStatus, 'resolved')
  })

  // 3. Arrow function
  it('Fixture 3: Arrow function extraction', () => {
    const code = `
export const multiply = (x: number, y: number): number => {
  return x * y;
};
`
    const symbols = extractSymbolsFromSource('src/calc.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'multiply')
    assert.strictEqual(sym.kind, 'arrow_function')
    assert.strictEqual(sym.signature, 'const multiply = (x: number, y: number): number => { ... }')
    assert.strictEqual(sym.signatureStatus, 'resolved')
    assert.strictEqual(sym.exported, true)
  })

  // 4. Generic function
  it('Fixture 4: Generic function extraction', () => {
    const code = `
export function identity<T extends object>(arg: T): T {
  return arg;
}
`
    const symbols = extractSymbolsFromSource('src/generics.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'identity')
    assert.strictEqual(sym.signature, 'export function identity<T extends object>(arg: T): T')
    assert.strictEqual(sym.signatureStatus, 'resolved')
  })

  // 5. Function overloads
  it('Fixture 5: Function overloads linking', () => {
    const code = `
export function formatValue(val: string): string;
export function formatValue(val: number): string;
export function formatValue(val: string | number): string {
  return String(val);
}
`
    const symbols = extractSymbolsFromSource('src/overload.ts', code, {
      packageName: '@hisabche/formatting',
    })
    assert.strictEqual(symbols.length, 3)
    const [ov1, ov2, impl] = symbols
    assert.strictEqual(ov1.name, 'formatValue')
    assert.strictEqual(ov2.name, 'formatValue')
    assert.strictEqual(impl.name, 'formatValue')

    // Disambiguated IDs
    assert.strictEqual(ov1.id, '@hisabche/formatting/src/overload.ts#formatValue')
    assert.strictEqual(ov2.id, '@hisabche/formatting/src/overload.ts#formatValue#2')
    assert.strictEqual(impl.id, '@hisabche/formatting/src/overload.ts#formatValue#3')

    // Overload group linkage
    const expectedGroup = '@hisabche/formatting/src/overload.ts#formatValue#overloads'
    assert.strictEqual(ov1.overloadGroup, expectedGroup)
    assert.strictEqual(ov2.overloadGroup, expectedGroup)
    assert.strictEqual(impl.overloadGroup, expectedGroup)
  })

  // 6. Class methods
  it('Fixture 6: Class methods extraction', () => {
    const code = `
export class UserService {
  async getUser(id: string): Promise<User> {
    return { id };
  }
}
`
    const symbols = extractSymbolsFromSource('src/user.service.ts', code)
    assert.strictEqual(symbols.length, 2)
    const cls = symbols.find((s) => s.kind === 'class')
    const method = symbols.find((s) => s.kind === 'method')
    assert.ok(cls)
    assert.ok(method)
    assert.strictEqual(method.name, 'UserService.getUser')
    assert.strictEqual(method.signature, 'async getUser(id: string): Promise<User>')
    assert.strictEqual(method.signatureStatus, 'resolved')
  })

  // 7. Constructor
  it('Fixture 7: Class constructor extraction', () => {
    const code = `
export class Database {
  constructor(private url: string) {}
}
`
    const symbols = extractSymbolsFromSource('src/db.ts', code)
    const ctor = symbols.find((s) => s.kind === 'constructor')
    assert.ok(ctor)
    assert.strictEqual(ctor.name, 'Database.constructor')
    assert.strictEqual(ctor.signature, 'constructor(private url: string)')
  })

  // 8. Interface
  it('Fixture 8: Interface declaration extraction', () => {
    const code = `
export interface TenancyContext {
  workspaceId: string;
  role: string;
}
`
    const symbols = extractSymbolsFromSource('src/tenancy.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.kind, 'interface')
    assert.strictEqual(sym.name, 'TenancyContext')
    assert.strictEqual(sym.signature, 'interface TenancyContext { ... }')
    assert.strictEqual(sym.signatureStatus, 'resolved')
  })

  // 9. Type alias
  it('Fixture 9: Type alias declaration extraction', () => {
    const code = `
export type InvoiceStatus = 'draft' | 'posted' | 'cancelled';
`
    const symbols = extractSymbolsFromSource('src/invoice.types.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.kind, 'type_alias')
    assert.strictEqual(sym.name, 'InvoiceStatus')
    assert.strictEqual(sym.signature, "type InvoiceStatus = 'draft' | 'posted' | 'cancelled'")
    assert.strictEqual(sym.signatureStatus, 'resolved')
  })

  // 10. Enum
  it('Fixture 10: Enum declaration extraction', () => {
    const code = `
export enum OrderState {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
}
`
    const symbols = extractSymbolsFromSource('src/order.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.kind, 'enum')
    assert.strictEqual(sym.name, 'OrderState')
    assert.strictEqual(sym.signature, 'enum OrderState { PENDING, COMPLETED }')
  })

  // 11. Default export
  it('Fixture 11: Default export extraction', () => {
    const code = `
export default function mainApp() {
  return true;
}
`
    const symbols = extractSymbolsFromSource('src/app.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'mainApp')
    assert.strictEqual(sym.exported, true)
    assert.ok(sym.exportPaths.includes('default'))
  })

  // 12. Named export
  it('Fixture 12: Named export statement linking', () => {
    const code = `
function internalWorker(task: string): void {}
export { internalWorker as workerTask };
`
    const symbols = extractSymbolsFromSource('src/worker.ts', code)
    const sym = symbols.find((s) => s.name === 'internalWorker')
    assert.ok(sym)
    assert.strictEqual(sym.exported, true)
    assert.ok(sym.exportPaths.includes('named:workerTask'))
  })

  // 13. Re-export
  it('Fixture 13: Re-export from another module', () => {
    const code = `
export { queryClient } from './query-client';
`
    const symbols = extractSymbolsFromSource('src/index.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.kind, 're_export')
    assert.strictEqual(sym.name, 'queryClient')
    assert.strictEqual(sym.signature, "export { queryClient } from './query-client'")
  })

  // 14. Barrel export
  it('Fixture 14: Barrel export (* from module)', () => {
    const code = `
export * from './schemas';
`
    const symbols = extractSymbolsFromSource('src/index.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.kind, 're_export')
    assert.strictEqual(sym.name, '*')
    assert.strictEqual(sym.signature, "export * from './schemas'")
  })

  // 15. React component
  it('Fixture 15: React component extraction', () => {
    const code = `
export function DashboardHeader({ title }: { title: string }) {
  return <div className="header"><h1>{title}</h1></div>;
}
`
    const symbols = extractSymbolsFromSource('src/DashboardHeader.tsx', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'DashboardHeader')
    assert.strictEqual(sym.kind, 'react_component')
    assert.strictEqual(
      sym.signature,
      'export function DashboardHeader({ title }: { title: string })',
    )
  })

  // 16. React hook
  it('Fixture 16: React hook extraction', () => {
    const code = `
export const useAuthUser = () => {
  return { user: null };
};
`
    const symbols = extractSymbolsFromSource('src/useAuthUser.ts', code)
    assert.strictEqual(symbols.length, 1)
    const sym = symbols[0]
    assert.strictEqual(sym.name, 'useAuthUser')
    assert.strictEqual(sym.kind, 'react_hook')
  })

  // 17. Same-name symbols in different files
  it('Fixture 17: Same-name symbols in different files have distinct IDs', () => {
    const codeA = `export const config = { env: 'prod' };`
    const codeB = `export const config = { env: 'staging' };`
    const symsA = extractSymbolsFromSource('apps/web/src/config.ts', codeA, {
      packageName: '@hisabche/web',
    })
    const symsB = extractSymbolsFromSource('apps/desktop/src/config.ts', codeB, {
      packageName: '@hisabche/desktop',
    })

    assert.strictEqual(symsA[0].name, 'config')
    assert.strictEqual(symsB[0].name, 'config')
    assert.strictEqual(symsA[0].id, '@hisabche/web/apps/web/src/config.ts#config')
    assert.strictEqual(symsB[0].id, '@hisabche/desktop/apps/desktop/src/config.ts#config')
    assert.notStrictEqual(symsA[0].id, symsB[0].id)
  })

  // 18. Same-name symbols in different packages
  it('Fixture 18: Same-name symbols in different packages have distinct IDs', () => {
    const code = `export interface Context { id: string; }`
    const symPkg1 = extractSymbolsFromSource('packages/api/src/context.ts', code, {
      packageName: '@hisabche/api',
    })
    const symPkg2 = extractSymbolsFromSource('backend/src/context.ts', code, {
      packageName: '@hisabche/backend',
    })

    assert.strictEqual(symPkg1[0].id, '@hisabche/api/packages/api/src/context.ts#Context')
    assert.strictEqual(symPkg2[0].id, '@hisabche/backend/backend/src/context.ts#Context')
    assert.notStrictEqual(symPkg1[0].id, symPkg2[0].id)
  })

  // 19. Path aliases / package inference
  it('Fixture 19: Automatic package inference from paths', () => {
    assert.strictEqual(
      inferPackageName('packages/local-engine/src/db.ts'),
      '@hisabche/local-engine',
    )
    assert.strictEqual(inferPackageName('apps/web/src/app.tsx'), '@hisabche/web')
    assert.strictEqual(inferPackageName('backend/src/routes/invoices.ts'), '@hisabche/backend')
  })

  // 20. CRLF and LF source files produce identical hashes
  it('Fixture 20: CRLF vs LF line endings produce identical normalized hashes', () => {
    const lfCode = 'export function normalize(): void {\n  return;\n}\n'
    const crlfCode = 'export function normalize(): void {\r\n  return;\r\n}\r\n'

    const symsLF = extractSymbolsFromSource('src/norm.ts', lfCode)
    const symsCRLF = extractSymbolsFromSource('src/norm.ts', crlfCode)

    assert.strictEqual(symsLF[0].sourceHash, symsCRLF[0].sourceHash)
    assert.strictEqual(symsLF[0].fileHash, symsCRLF[0].fileHash)
  })
})
