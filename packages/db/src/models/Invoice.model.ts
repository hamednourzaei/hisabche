import { Model } from '@nozbe/watermelondb'
import { field, date, readonly, children } from '@nozbe/watermelondb/decorators'

export default class Invoice extends Model {
  static table = 'invoices'

  @field('invoice_number') invoiceNumber!: string
  @field('type') type!: string
  @field('customer_id') customerId!: string
  @field('supplier_id') supplierId!: string | undefined
  @field('date') date!: number
  @field('due_date') dueDate!: number | undefined
  @field('subtotal') subtotal!: number
  @field('discount_total') discountTotal!: number
  @field('tax_total') taxTotal!: number
  @field('total') total!: number
  @field('paid_amount') paidAmount!: number
  @field('currency') currency!: string
  @field('payment_method') paymentMethod!: string
  @field('status') status!: string
  @field('notes') notes!: string | undefined
  @field('synced_at') syncedAt!: number | undefined
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date

  @children('invoice_items') items: any
}