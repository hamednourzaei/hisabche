// ============================================
// backend/src/routes/invoice-return.routes.ts
//
// Fastify Routes for Invoice Returns (Sales -> Invoices)
// ============================================

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import { requireCapability } from '../middleware/authorize.middleware'
import { holds } from '../services/authorization/authorization.domain'
import { ForbiddenError } from '../errors/auth.error'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { ValidationError } from '../errors/validation.error'
import {
  invoiceExchangeSchema,
  planReturnDisposition,
  routeReturnedSerial,
  routeReturnConditionDisposition,
  type ReturnCondition,
  type ReturnDeductionRequest,
} from '@hisabche/validation'
import { ledger } from '../services/accounting'
import { InvoiceService } from '../services/invoice.service'
import { InvoiceReturnService } from '../services/sales/invoice-return.service'
import { supabase } from '../db'
import { NotFoundError } from '../errors/database.error'
import { sendFailure } from '../errors/http-failure'
import { readClientRequestId, sendCreated } from '../utils/client-request'
import { invalidateMoneyCaches } from '../utils/money-cache'

export async function invoiceReturnRoutes(fastify: FastifyInstance) {
  const service = new InvoiceReturnService()
  const read = [authenticate, requireWorkspaceContext, requireCapability('invoice.read')]
  const write = [authenticate, requireWorkspaceContext, requireCapability('invoice.create')]
  // Paying money back to a customer is a payment, and is held to the payment rule.
  const refund = [authenticate, requireWorkspaceContext, requireCapability('payment.record')]

  fastify.get(
    '/api/invoices/:id/returns',
    { preHandler: read },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const workspaceId = request.tenancy.workspaceId
        const { id } = request.params as { id: string }
        const returns = await service.getReturns(workspaceId, id)
        return reply.send({ data: returns })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to fetch invoice returns')
      }
    },
  )

  fastify.post(
    '/api/invoices/:id/returns',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const workspaceId = request.tenancy.workspaceId
        const userId = request.tenancy.userId
        const { id } = request.params as { id: string }
        const clientRequestId = readClientRequestId(request)
        const body = request.body as {
          returnType: 'sale_return' | 'purchase_return'
          returnNumber: string
          returnDate: string
          reasonCode?: string | undefined
          notes?: string | undefined
          deductions?: ReturnDeductionRequest[] | undefined
          lines: Array<{
            originalLineId: string
            quantity?: number | undefined
            returnQuantity?: number | undefined
            restockChoice?: 'restock' | 'scrap' | undefined
            reasonCode?:
              | 'defective'
              | 'wrong_item'
              | 'customer_change_of_mind'
              | 'damaged_in_transit'
              | 'expired'
              | 'other'
              | undefined
            conditionCode?: ReturnCondition | undefined
            serialNumbers?: string[] | undefined
          }>
        }
        // A body with no list of lines must be refused here: it would otherwise reach the
        // service as a TypeError (a 500) — and the one return an invoice may have is not
        // to be spent on an empty document.
        if (!Array.isArray(body?.lines)) throw new ValidationError('RETURN_LINES_REQUIRED')
        // C5: RETURN and SCRAP are different events. A sound return goes back on the shelf with the permission a return
        // already has (invoice.create); only a line that WRITES GOODS OFF needs stock.adjust (manager by default, delegable
        // by the owner). A line that says neither is refused whole - nothing is defaulted.
        let disposition: ReturnType<typeof planReturnDisposition>
        try {
          disposition = planReturnDisposition({ returnType: body.returnType, lines: body.lines })
        } catch (cause) {
          throw new ValidationError(
            cause instanceof Error ? cause.message : 'RETURN_DISPOSITION_REQUIRED',
          )
        }
        if (disposition.needsStockAdjust && !holds(request.tenancy, 'stock.adjust')) {
          throw new ForbiddenError('RETURN_STOCK_DECISION_NOT_PERMITTED')
        }
        for (const line of body.lines) {
          const routed = routeReturnConditionDisposition({
            conditionCode: line.conditionCode,
            restockChoice: (line.restockChoice ?? 'restock') as 'restock' | 'scrap',
          })
          if (routed.requiresStockAdjust && !holds(request.tenancy, 'stock.adjust')) {
            throw new ForbiddenError('RETURN_STOCK_DECISION_NOT_PERMITTED')
          }
        }
        // RG-1: a scrapped line books its purchase cost as a LOSS (docs/invoice-return-06-scrap-loss-migration.sql). The
        // loss account is made on first use, like every other role; a workspace that cannot have it refuses the return.
        if (
          body.returnType === 'sale_return' &&
          body.lines.some((l) => l.restockChoice === 'scrap')
        ) {
          const ensured = await ledger.ensureAccountsForRoles(request.tenancy, [
            'inventory_loss',
            'cogs',
          ])
          if (ensured.missing.length > 0) {
            throw new ValidationError(`RETURN_ACCOUNTS_MISSING: ${ensured.missing.join(', ')}`)
          }
        }
        const ret = await service.createReturn(workspaceId, {
          originalInvoiceId: id,
          userId,
          clientRequestId,
          returnType: body.returnType,
          returnNumber: body.returnNumber,
          returnDate: body.returnDate,
          reasonCode: body.reasonCode,
          notes: body.notes,
          deductions: body.deductions,
          lines: body.lines.map((l) => ({
            originalLineId: l.originalLineId,
            returnQuantity: l.returnQuantity ?? l.quantity ?? 1,
            restockChoice: l.restockChoice as 'restock' | 'scrap',
            reasonCode: l.reasonCode ?? 'other',
            conditionCode: l.conditionCode,
          })),
        })
        // Route any named sold IMEIs / serial numbers using routeReturnedSerial alongside financial reversal.
        const linesWithSerials = body.lines.filter(
          (l) => Array.isArray(l.serialNumbers) && l.serialNumbers.length > 0,
        )
        if (linesWithSerials.length > 0) {
          for (const line of linesWithSerials) {
            const serialNumbers = line.serialNumbers ?? []
            const { data: matching } = await supabase
              .from('stock_serials')
              .select('id, product_id, serial_number, status, warehouse_id, invoice_id')
              .eq('workspace_id', workspaceId)
              .eq('invoice_id', id)
              .in('serial_number', serialNumbers)
            for (const row of matching ?? []) {
              const s = row as {
                id: string
                product_id: string
                serial_number: string
                status: 'sold'
                warehouse_id?: string | null
                invoice_id?: string | null
              }
              const routed = routeReturnedSerial(
                {
                  serialNumber: s.serial_number,
                  productId: s.product_id,
                  status: s.status,
                  warehouseId: s.warehouse_id ?? null,
                  soldInvoiceId: s.invoice_id ?? null,
                },
                (line.conditionCode ?? 'opened') as ReturnCondition,
              )
              const nextStatus = line.restockChoice === 'scrap' ? 'scrapped' : routed.status
              await supabase
                .from('stock_serials')
                .update({
                  status: nextStatus,
                  invoice_id: null,
                  sold_on: null,
                  reserved_for_customer_id: null,
                })
                .eq('workspace_id', workspaceId)
                .eq('id', s.id)
            }
          }
        }
        // A return changes the customer's statement and balance, the dashboard and
        // stock; a cached copy would keep showing the figures from before it
        // (BUG-008: it stayed «unpaid» for two minutes after a payment).
        await invalidateMoneyCaches(workspaceId)
        return sendCreated(reply, { data: ret })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to create invoice return')
      }
    },
  )

  // Money paid back against a return: its own event, recorded by the payment core.
  fastify.post(
    '/api/invoices/:id/returns/:returnId/refunds',
    { preHandler: refund },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const { id, returnId } = request.params as { id: string; returnId: string }
        const body = request.body as {
          amount?: number
          method?: 'cash' | 'bank'
          tillSessionId?: string | null
          entryDate?: string
        }
        const result = await service.refundReturn(request.tenancy, id, returnId, {
          amount: Number(body?.amount),
          method: body?.method as 'cash' | 'bank',
          tillSessionId: body?.tillSessionId ?? null,
          entryDate: body?.entryDate,
          clientRequestId: readClientRequestId(request),
        })
        await invalidateMoneyCaches(request.tenancy.workspaceId)
        return sendCreated(reply, { data: result })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to refund invoice return')
      }
    },
  )

  // Clothing / variant exchange against an original sale invoice:
  // routes each returned variant by condition (sellable_stock / quarantine / scrap)
  // through existing return stock movements and issues replacement invoice lines via InvoiceService.
  fastify.post(
    '/api/invoices/:id/exchange',
    { preHandler: write },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const workspaceId = request.tenancy.workspaceId
        const userId = request.tenancy.userId
        const { id } = request.params as { id: string }
        const clientRequestId = readClientRequestId(request)
        // 12 Nov 2026 (V60 audit): the body was a TypeScript cast — nothing checked it.
        const parsed = invoiceExchangeSchema.safeParse(request.body)
        if (!parsed.success) {
          const issue = parsed.error.errors[0]
          throw new ValidationError(
            issue?.message === 'EXCHANGE_PAYMENT_UNSTATED'
              ? 'EXCHANGE_PAYMENT_UNSTATED'
              : parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
          )
        }
        const body = parsed.data
        // A replacement sale without a retry key would be sold twice by a retried request.
        if (body.replacementItems.length > 0 && !clientRequestId) {
          throw new ValidationError('IDEMPOTENCY_KEY_REQUIRED')
        }

        const { data: originalInv, error: invErr } = await supabase
          .from('invoices')
          .select('id, workspace_id, customer_id, currency, warehouse_id, branch_id')
          .eq('id', id)
          .eq('workspace_id', workspaceId)
          .maybeSingle()
        if (invErr) throw invErr
        if (!originalInv) throw new NotFoundError('Invoice')

        const lineDecisions = body.returnedLines.map((l) => {
          const restockChoice = l.restockChoice ?? 'restock'
          const decision = routeReturnConditionDisposition({
            conditionCode: l.conditionCode,
            restockChoice,
          })
          if (decision.requiresStockAdjust && !holds(request.tenancy, 'stock.adjust')) {
            throw new ForbiddenError('RETURN_STOCK_DECISION_NOT_PERMITTED')
          }
          return { line: l, decision }
        })

        const returnResult = await service.createReturn(workspaceId, {
          originalInvoiceId: id,
          userId,
          clientRequestId,
          returnType: 'sale_return',
          returnNumber: body.returnNumber,
          returnDate: body.returnDate,
          reasonCode: body.reasonCode,
          notes:
            body.notes ??
            lineDecisions
              .filter((d) => d.decision.bucket === 'quarantine')
              .map((d) => `quarantine:${d.line.originalLineId}`)
              .join(', '),
          lines: lineDecisions.map(({ line, decision }) => ({
            originalLineId: line.originalLineId,
            returnQuantity: line.quantity,
            restockChoice: decision.restockChoice,
            reasonCode: body.reasonCode,
            conditionCode: line.conditionCode,
          })),
        })

        let replacementInvoice: unknown = null
        if (body.replacementItems.length > 0) {
          const parsedItems = body.replacementItems
          const invoiceService = new InvoiceService()
          replacementInvoice = await invoiceService.create(request.tenancy, {
            type: 'sale',
            date: body.returnDate,
            warehouseId: body.warehouseId ?? (originalInv.warehouse_id as string | undefined),
            customerId: (originalInv.customer_id as string | undefined) ?? undefined,
            currency: (originalInv.currency as string | undefined) ?? undefined,
            paymentMethod: body.paymentMethod,
            paidAmount: body.paidAmount,
            idempotencyKey: `${clientRequestId}:exchange-sale`,
            items: parsedItems,
          } as Parameters<InvoiceService['create']>[1])
        }

        await invalidateMoneyCaches(workspaceId)
        return sendCreated(reply, {
          data: {
            returnDocument: returnResult,
            replacementInvoice,
            dispositions: lineDecisions.map(({ line, decision }) => ({
              originalLineId: line.originalLineId,
              variantId: line.variantId ?? null,
              bucket: decision.bucket,
            })),
          },
        })
      } catch (err) {
        return sendFailure(reply, fastify.log, err, 'Failed to process variant exchange')
      }
    },
  )
}
