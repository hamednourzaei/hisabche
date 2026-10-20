import { describe, expect, it, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  checkActionAvailability,
  useActionAvailability,
  registerEntitlementContextProvider,
} from '../use-action-availability'
import { setAppEdition } from '@hisabche/api'

describe('useActionAvailability & checkActionAvailability', () => {
  beforeEach(() => {
    registerEntitlementContextProvider(null)
    setAppEdition('cloud')
  })

  describe('Offline Edition (edition: local)', () => {
    beforeEach(() => {
      setAppEdition('offline')
    })

    it('returns requiresOnline: true for server-execution C-class features', () => {
      const serverFeatures = [
        'ai.assistant',
        'dashboard.ai_insight',
        'dashboard.manufacturing_card',
        'invoice.recurring',
        'invoice.approval',
        'manufacturing.bom',
        'manufacturing.produce',
        'manufacturing.work_orders',
        'manufacturing.runs',
        'manufacturing.report',
        'customer.documents',
        'customer.portal_link',
        'governance.permission_matrix',
        'hr.attendance_devices',
        'hr.attendance_links',
        'team.members',
        'settings.business_stamp',
        'sync.push_pull',
        'sync.overview',
        'sync.conflicts',
        'approvals.workflows',
        'analysis.benchmark',
        'developer.keys',
        'marketplace.apps',
        'storefront.public',
        'billing.portal',
        'ocr.receipt',
        'bank.import',
      ] as const

      for (const feat of serverFeatures) {
        const result = checkActionAvailability(feat)
        expect(result.available, `${feat} should not be available offline`).toBe(false)
        expect(result.requiresOnline, `${feat} should require online`).toBe(true)
        expect(result.reason).toBe('offline_edition')
        expect(result.verdict.kind).toBe('REQUIRES_ONLINE')
      }
    })

    it('returns available: true for local-execution features in offline edition', () => {
      const localFeatures = [
        'invoice.list',
        'invoice.detail',
        'invoice.create',
        'invoice.edit',
        'invoice.delete',
        'invoice.print',
        'product.list',
        'product.detail',
        'product.upsert',
        'customer.list',
        'customer.detail',
        'customer.upsert',
        'accounting.chart',
        'accounting.journal',
        'till.session',
        'till.order',
        'employee.list',
      ] as const

      for (const feat of localFeatures) {
        const result = checkActionAvailability(feat)
        expect(result.available, `${feat} should be available locally`).toBe(true)
        expect(result.requiresOnline, `${feat} should not require online`).toBe(false)
        expect(result.reason).toBe('available')
        expect(result.verdict.kind).toBe('AVAILABLE')
      }
    })

    it('handles hybrid features correctly: local part available, server part requires online', () => {
      // 1. data.backup
      const backupLocal = checkActionAvailability('data.backup', { part: 'local' })
      expect(backupLocal.available).toBe(true)
      expect(backupLocal.requiresOnline).toBe(false)

      const backupServer = checkActionAvailability('data.backup', { part: 'server' })
      expect(backupServer.available).toBe(false)
      expect(backupServer.requiresOnline).toBe(true)

      // 2. product.images
      const imagesLocal = checkActionAvailability('product.images', { part: 'local' })
      expect(imagesLocal.available).toBe(true)
      expect(imagesLocal.requiresOnline).toBe(false)

      const imagesServer = checkActionAvailability('product.images', { part: 'server' })
      expect(imagesServer.available).toBe(false)
      expect(imagesServer.requiresOnline).toBe(true)

      // 3. inventory.costing_method
      const costingLocal = checkActionAvailability('inventory.costing_method', { part: 'local' })
      expect(costingLocal.available).toBe(true)

      const costingServer = checkActionAvailability('inventory.costing_method', { part: 'server' })
      expect(costingServer.available).toBe(false)
      expect(costingServer.requiresOnline).toBe(true)
    })
  })

  describe('Cloud Edition (edition: cloud)', () => {
    beforeEach(() => {
      setAppEdition('cloud')
    })

    it('returns available: true and requiresOnline: false for features in the active plan', () => {
      const cloudFeatures = [
        'ai.assistant',
        'dashboard.ai_insight',
        'dashboard.manufacturing_card',
        'invoice.recurring',
        'manufacturing.bom',
        'manufacturing.produce',
        'customer.documents',
        'governance.permission_matrix',
        'team.members',
        'settings.business_stamp',
        'sync.push_pull',
        'billing.portal',
      ] as const

      for (const feat of cloudFeatures) {
        const result = checkActionAvailability(feat)
        expect(result.available, `${feat} should be available in cloud`).toBe(true)
        expect(result.requiresOnline, `${feat} should not require online`).toBe(false)
        expect(result.verdict.kind).toBe('AVAILABLE')
      }
    })
  })

  describe('React Hook useActionAvailability', () => {
    it('memoizes evaluation and updates upon input changes', () => {
      setAppEdition('offline')
      const { result, rerender } = renderHook(
        ({ feat }: { feat: 'ai.assistant' | 'invoice.create' }) => useActionAvailability(feat),
        { initialProps: { feat: 'ai.assistant' } },
      )

      expect(result.current.requiresOnline).toBe(true)
      expect(result.current.available).toBe(false)

      rerender({ feat: 'invoice.create' })
      expect(result.current.requiresOnline).toBe(false)
      expect(result.current.available).toBe(true)
    })
  })

  describe('Seam for Agent E (Entitlement Context Provider)', () => {
    it('applies registered live entitlement context', () => {
      setAppEdition('cloud')
      // Simulate Agent E registering a context provider where plan is FREE
      registerEntitlementContextProvider(() => ({
        state: 'FREE_EXHAUSTED',
        plan: 'FREE',
        usageExhausted: true,
      }))

      // Regular write feature should be EXHAUSTED
      const invoiceCreate = checkActionAvailability('invoice.create')
      expect(invoiceCreate.available).toBe(false)
      expect(invoiceCreate.verdict.kind).toBe('EXHAUSTED')
      expect(invoiceCreate.reason).toBe('exhausted')

      // Always allowed feature (principle 6: reading / export / print) stays available!
      const invoiceDetail = checkActionAvailability('invoice.detail')
      expect(invoiceDetail.available).toBe(true)
      expect(invoiceDetail.verdict.kind).toBe('AVAILABLE')
    })
  })
})
