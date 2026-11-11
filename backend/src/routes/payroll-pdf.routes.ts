// ============================================
// backend/src/routes/payroll-pdf.routes.ts
//
// V58 · P0-6b — GET /api/hr/payrolls/:id/payslip.pdf
//
// The payslip renders the payroll row AS THE LEDGER HOLDS IT, workspace-
// scoped like every other export: `.eq('workspace_id')` beside `.eq('id')`
// is the whole authorization model of this route. Rendered per request
// (no cache upload yet — a payslip is requested once a month, an invoice
// a hundred times a day).
// ============================================

import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { renderToBuffer } from '@react-pdf/renderer'
import { supabase } from '../db'
import { PayslipPDFDocument, type PayslipData } from '../pdf/PayslipPDFDocument'
import { authenticate } from '../middleware/auth.middleware'
import { requireWorkspaceContext } from '../middleware/workspace.middleware'
import { requireCapability } from '../middleware/authorize.middleware'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function uiLanguageFromHeader(header: string | string[] | undefined): 'fa' | 'af' | 'en' {
  const value = (Array.isArray(header) ? header[0] : header)?.toLowerCase() ?? ''
  if (value.startsWith('fa-af') || value.startsWith('af')) return 'af'
  if (value.startsWith('en')) return 'en'
  return 'fa'
}

function num(value: unknown): number {
  return Number(value) || 0
}

export async function payrollPdfRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/api/hr/payrolls/:id/payslip.pdf',
    {
      preHandler: [authenticate, requireWorkspaceContext, requireCapability('payroll.read')],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string }
      const { workspaceId } = request.tenancy

      if (!UUID_RE.test(id)) {
        return reply.code(400).send({ error: 'Invalid payroll id' })
      }

      // Workspace filter beside the id — the same rule the invoice PDF route
      // spells out: an export endpoint is exactly where an ownership check
      // gets skipped, so it is written here twice.
      const { data: row, error } = await supabase
        .from('payrolls')
        .select(
          'period_start, period_end, base_salary, overtime_hours, overtime_amount, bonuses, deductions, tax_amount, net_salary, currency, status, payment_date, notes, employee:employees(first_name, last_name)',
        )
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()

      if (error || !row) {
        return reply.code(404).send({ error: 'Payslip not found' })
      }

      // The embed is typed as a list by supabase-js even for a to-one FK;
      // PostgREST returns the object form here, but the first element is the
      // safe read for either shape.
      const employeeRaw = (
        row as {
          employee:
            | { first_name: string | null; last_name: string | null }
            | null
            | Array<{ first_name: string | null; last_name: string | null }>
        }
      ).employee
      const employee = Array.isArray(employeeRaw) ? (employeeRaw[0] ?? null) : employeeRaw

      // The workspace's own name on its own document — one small read, not a
      // denormalized copy that can drift from the workspace.
      const { data: wsRow } = await supabase
        .from('workspaces')
        .select('name')
        .eq('id', workspaceId)
        .maybeSingle()

      const payslip: PayslipData = {
        employeeName: [employee?.first_name, employee?.last_name].filter(Boolean).join(' ') || '—',
        periodStart: String(row.period_start ?? '').slice(0, 10),
        periodEnd: String(row.period_end ?? '').slice(0, 10),
        baseSalary: num(row.base_salary),
        overtimeHours: num(row.overtime_hours),
        overtimeAmount: num(row.overtime_amount),
        bonuses: num(row.bonuses),
        deductions: num(row.deductions),
        taxAmount: num(row.tax_amount),
        netSalary: num(row.net_salary),
        currency: String(row.currency ?? ''),
        status: (row.status as string | null) ?? null,
        paymentDate: row.payment_date ? String(row.payment_date).slice(0, 10) : null,
        notes: (row.notes as string | null) ?? null,
      }

      const lang = uiLanguageFromHeader(request.headers['accept-language'])

      try {
        const buffer = await renderToBuffer(
          PayslipPDFDocument({ payslip, lang, workspaceName: String(wsRow?.name ?? '') }),
        )
        reply.header('Content-Type', 'application/pdf')
        reply.header('Content-Disposition', `attachment; filename="Payslip-${id}.pdf"`)
        reply.header('Cache-Control', 'private, max-age=600')
        return reply.send(buffer)
      } catch (err) {
        fastify.log.error({ err, payrollId: id }, 'Payslip PDF generation failed')
        return reply.code(500).send({ error: 'PDF generation failed' })
      }
    },
  )
}
