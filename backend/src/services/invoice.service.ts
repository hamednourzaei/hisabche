// ============================================
// backend/src/services/invoice.service.ts
// Hisabche v1.1 — With Workflow auto-trigger
// ============================================

import { supabase } from "../db";
import { WorkflowService } from "./workflow.service";
import { CreateInvoice, UpdateInvoice, InvoiceFilters } from "@hisabche/validation";
import { DatabaseError, NotFoundError } from "../errors/database.error";

export class InvoiceService {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  async list(userId: string, filters: InvoiceFilters) {
    const { search, type, status, customerId, supplierId, currency, dateFrom, dateTo, minTotal, maxTotal, page, limit, sortBy, sortDirection } = filters;
    const from = (page - 1) * limit, to = from + limit - 1;
    let query = supabase.from("invoices").select("*, invoice_items(*)", { count: "exact" }).eq("user_id", userId).order(sortBy || "created_at", { ascending: sortDirection === "asc" }).range(from, to);
    if (search) query = query.ilike("invoice_number", `%${search}%`);
    if (type) query = query.eq("type", type);
    if (status) query = query.eq("status", status);
    if (customerId) query = query.eq("customer_id", customerId);
    if (supplierId) query = query.eq("supplier_id", supplierId);
    if (currency) query = query.eq("currency", currency);
    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    if (minTotal !== undefined) query = query.gte("total", minTotal);
    if (maxTotal !== undefined) query = query.lte("total", maxTotal);
    const { data, error, count } = await query;
    if (error) throw new DatabaseError("Failed to fetch invoices", error);
    return { invoices: data || [], total: count || 0, page, limit, summary: await this.getSummary(userId) };
  }

  async getById(id: string, userId: string) {
    const { data, error } = await supabase.from("invoices").select("*, invoice_items(*)").eq("id", id).eq("user_id", userId).single();
    if (error || !data) throw new NotFoundError("Invoice");
    return data;
  }

  async create(userId: string, data: CreateInvoice) {
    const invoiceNumber = await this.generateInvoiceNumber(userId);
    const { data: invoice, error: invoiceError } = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber, type: data.type, date: data.date || new Date().toISOString(),
      due_date: data.dueDate || null, customer_id: data.customerId || null, supplier_id: data.supplierId || null,
      subtotal: data.subtotal || 0, discount_total: data.discountTotal || 0, discount_type: data.discountType || "fixed",
      tax_rate: data.taxRate || 0, tax_total: data.taxTotal || 0, total: data.total || 0,
      paid_amount: data.paidAmount || 0, payment_method: data.paymentMethod || "cash",
      currency: data.currency || "AFN", status: data.paidAmount >= data.total ? "completed" : "pending",
      notes: data.notes || "", reference: data.reference || "", user_id: userId,
    }).select().single();
    if (invoiceError || !invoice) throw new DatabaseError("Failed to create invoice", invoiceError);

    if (data.items?.length) {
      const items = data.items.map((item) => ({
        invoice_id: invoice.id, product_id: item.productId, product_name: item.productName,
        quantity: item.quantity, unit_price: item.unitPrice, discount: item.discount || 0,
        total_price: item.totalPrice, notes: item.notes || "", user_id: userId,
      }));
      const { error: itemsError } = await supabase.from("invoice_items").insert(items);
      if (itemsError) { await supabase.from("invoices").delete().eq("id", invoice.id); throw new DatabaseError("Failed to create invoice items", itemsError); }
      if (data.type === "sale") for (const item of data.items) if (item.productId) await this.updateStock(item.productId, item.quantity, userId);
    }

    if (data.customerId && data.paidAmount < data.total) {
      await supabase.from("transactions").insert({ customer_id: data.customerId, type: "sale", amount: data.total - data.paidAmount, currency: data.currency || "AFN", description: `Invoice ${invoiceNumber}`, reference: invoice.id, date: new Date().toISOString(), user_id: userId });
    }

    // ✅ همیشه workflow + notification
    await this.tryStartWorkflow(userId, invoice.id, Number(data.total || 0));

    return this.getById(invoice.id, userId);
  }

  async update(id: string, userId: string, data: UpdateInvoice) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status !== undefined) updates.status = data.status;
    if (data.paidAmount !== undefined) updates.paid_amount = data.paidAmount;
    if (data.total !== undefined) updates.total = data.total;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.reference !== undefined) updates.reference = data.reference;
    const { data: invoice, error } = await supabase.from("invoices").update(updates).eq("id", id).eq("user_id", userId).select().single();
    if (error) throw new DatabaseError("Failed to update invoice", error);
    if (!invoice) throw new NotFoundError("Invoice");
    return invoice;
  }

  async delete(id: string, userId: string): Promise<void> {
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new DatabaseError("Failed to delete invoice", error);
  }

  async getSummary(userId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const { data: salesData } = await supabase.from("invoices").select("total").eq("user_id", userId).gte("created_at", today.toISOString()).lt("created_at", tomorrow.toISOString());
    const todaySales = salesData?.reduce((s, i) => s + (i.total || 0), 0) || 0;
    const { data: debtData } = await supabase.from("invoices").select("total, paid_amount").eq("user_id", userId).neq("status", "paid");
    const totalDebt = debtData?.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paid_amount || 0)), 0) || 0;
    const { data: stockData } = await supabase.from("products").select("quantity, min_stock_level").eq("user_id", userId);
    const lowStockCount = stockData?.filter((p) => (p.min_stock_level || 0) > 0 && (p.quantity || 0) <= (p.min_stock_level || 0)).length || 0;
    return { todaySales, totalDebt, lowStockCount };
  }

  private async generateInvoiceNumber(userId: string): Promise<string> {
    const { count } = await supabase.from("invoices").select("*", { count: "exact", head: true }).eq("user_id", userId);
    return `INV-${((count || 0) + 1).toString().padStart(6, "0")}`;
  }

  private async updateStock(productId: string, quantity: number, userId: string): Promise<void> {
    const { data: product, error } = await supabase.from("products").select("quantity").eq("id", productId).single();
    if (error || !product) throw new DatabaseError("Product not found", error);
    await supabase.from("products").update({ quantity: Math.max(0, product.quantity - quantity) }).eq("id", productId);
    await supabase.from("stock_movements").insert({ product_id: productId, type: "sale", quantity: -quantity, reference_type: "invoice", user_id: userId });
  }

  private async tryStartWorkflow(userId: string, invoiceId: string, total: number): Promise<void> {
    try {
      const { data: workflows } = await supabase.from("workflows").select("id").eq("entity_type", "invoice").eq("is_active", true).is("deleted_at", null).limit(1);
      const workflow = workflows?.[0];
      if (!workflow) return;
      const { data: membership } = await supabase.from("workspace_members").select("workspace_id").eq("user_id", userId).limit(1).single();
      const workspaceId = membership?.workspace_id;
      if (!workspaceId) return;
      await this.workflowService.startWorkflow(workspaceId, { workflow_id: workflow.id, entity_type: "invoice", entity_id: invoiceId });
    } catch { /* silent */ }
  }
}

export default InvoiceService;