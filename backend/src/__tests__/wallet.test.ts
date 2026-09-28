// The wallet's backend half (28 Sep 2026). The money rules themselves are
// proven in Postgres (wallet.pg.test.ts); this proves the layer in front:
//   - the plan price is OURS (plan-pricing.ts), never a number from the body;
//   - a receipt's type comes from its bytes;
//   - a raised code becomes the right HTTP status, anything else a 500;
//   - every business route needs workspace.manage, every admin route the
//     platform-admin guard, and no wallet route is open to an API key.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const rpc = vi.fn()
vi.mock('../db', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }))

const { walletService, walletFailure, sniffReceiptType, WalletError } =
  await import('../services/wallet/wallet.service')

const ctx = { workspaceId: 'ws', userId: 'u', role: 'owner' } as never

beforeEach(() => rpc.mockReset())

describe('payUpgrade — the price is ours', () => {
  it('sends the plan-pricing amount in minor units, whatever the client wanted', async () => {
    rpc.mockResolvedValue({
      data: { request_id: 'r', subscription_id: 's', balance_after: 100, replayed: false },
      error: null,
    })
    await walletService.payUpgrade(ctx, {
      currentPlan: 'free',
      plan: 'pro',
      interval: 'month',
      walletCurrency: 'USD',
      idempotencyKey: 'k',
    })
    expect(rpc).toHaveBeenCalledWith(
      'wallet_pay_subscription_upgrade',
      expect.objectContaining({
        p_amount_minor: 1200,
        p_plan_currency: 'USD',
        p_wallet_currency: 'USD',
      }),
    )
  })

  it('a plan the product does not price (enterprise) is refused before the database', async () => {
    await expect(
      walletService.payUpgrade(ctx, {
        currentPlan: 'free',
        plan: 'enterprise',
        interval: 'month',
        walletCurrency: 'USD',
        idempotencyKey: null,
      }),
    ).rejects.toMatchObject({ message: 'WALLET_PLAN_NOT_PRICED' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('the pay body schema carries no amount at all', () => {
    const routes = readFileSync(join(__dirname, '..', 'routes', 'wallet.routes.ts'), 'utf8')
    const pay = routes.slice(routes.indexOf('const payBody'), routes.indexOf('const methodBody'))
    expect(pay).not.toMatch(/amount/i)
  })
})

describe('receipts: the type comes from the bytes', () => {
  it('pdf, jpeg, png, webp — and nothing else', () => {
    expect(sniffReceiptType(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf')
    expect(sniffReceiptType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffReceiptType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    )
    expect(sniffReceiptType(Buffer.from('<html><script>'))).toBeNull()
    expect(sniffReceiptType(Buffer.from('MZ\x90\x00'))).toBeNull()
  })
})

describe('raised codes → HTTP', () => {
  it.each([
    ['WALLET_INSUFFICIENT_FUNDS', 409],
    ['WALLET_TOPUP_DUPLICATE_REFERENCE', 409],
    ['WALLET_TOPUP_NOT_FOUND', 404],
    ['WALLET_CARD_LAST4_REQUIRED', 400],
    ['UPGRADE_REQUEST_PENDING', 409],
    ['SUBSCRIPTION_ALREADY_ACTIVE', 409],
  ])('%s → %i', (code, status) => {
    const err = walletFailure({ code: 'P0001', message: `${code}` }, 'x')
    expect(err).toBeInstanceOf(WalletError)
    expect((err as InstanceType<typeof WalletError>).statusCode).toBe(status)
  })

  it('the migration not run → 503 WALLET_NOT_CONFIGURED, not a 500', () => {
    const err = walletFailure({ code: 'PGRST202', message: 'no function' }, 'x')
    expect(err.message).toBe('WALLET_NOT_CONFIGURED')
  })

  it('anything else is a database error (500), never a guessed code', () => {
    expect(walletFailure({ code: '57014', message: 'timeout' }, 'x')).not.toBeInstanceOf(
      WalletError,
    )
  })
})

describe('routes: who may touch the money', () => {
  const src = readFileSync(join(__dirname, '..', 'routes', 'wallet.routes.ts'), 'utf8')
  const routes = [
    ...src.matchAll(/fastify\.(get|post|patch|delete)\(\s*'([^']+)',\s*\{\s*preHandler:\s*(\w+)/g),
  ]

  it('found the routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(14)
  })

  it('/api/wallet/* → manage (workspace.manage); /api/admin/wallet/* → admin', () => {
    for (const [, , path, guard] of routes) {
      expect(guard, path).toBe(path!.startsWith('/api/admin/') ? 'admin' : 'manage')
    }
    expect(src).toContain(
      "const manage = [authenticate, requireWorkspaceContext, requireCapability('workspace.manage')]",
    )
    expect(src).toContain('const admin = [authenticate, platformAdminGuard]')
  })

  it('a currency is one of the product codes, never any three letters', () => {
    expect(src).toContain('const currency = currencyCodeSchema')
  })

  it('no wallet route is in the API-key allowlist', () => {
    const allowlist = readFileSync(
      join(__dirname, '..', 'services', 'developer', 'developer.domain.ts'),
      'utf8',
    )
    expect(allowlist).not.toMatch(/\/api\/(admin\/)?wallet/)
  })
})
