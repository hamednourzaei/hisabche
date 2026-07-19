// ============================================
// backend/src/services/invoice.service.ts
// Hisabche v2.4 — FULLY OPTIMIZED
// FIXED: Promise.all + count: "estimated" + Sequence for invoice number
// ============================================

import { supabase } from "../db";
import { WorkflowService } from "../services/workflow.service";
import { CreateInvoice, UpdateInvoice, InvoiceFilters } from "@hisabche/validation";
import { DatabaseError, NotFoundError } from "../errors/database.error";
import { memoryCache } from "../utils/pagination";

// ============================================
// ✅ OPTIMIZED: فقط ستون‌های مورد نیاز
// ============================================

const INVOICE_LIST_COLUMNS = `
  id, 
  invoice_number, 
  type, 
  customer_id, 
  supplier_id,
  date, 
  due_date, 
  subtotal, 
  discount_total, 
  tax_total,
  total, 
  paid_amount, 
  currency, 
  payment_method, 
  status, 
  created_at,
  updated_at
`

const INVOICE_ITEMS_LIST_COLUMNS = `
  id, 
  invoice_id,
  product_id, 
  product_name, 
  quantity, 
  unit_price, 
  discount, 
  total_price
`

// ============================================

export class InvoiceService {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  // ─── List Invoices — OPTIMIZED ───
  async list(userId: string, filters: InvoiceFilters) {
    const {
      search, type, status, customerId, supplierId,
      currency, dateFrom, dateTo, minTotal, maxTotal,
      limit = 20, cursor, sortBy = "created_at", sortDirection = "desc"
    } = filters;

    // ✅ کش با userId
    const cacheKey = `invoices:${userId}:${JSON.stringify(filters)}`;
    const cached = await memoryCache.get(cacheKey);
    if (cached) return cached;

    const maxLimit = Math.min(limit, 100);
    const fetchLimit = maxLimit + 1;

    let query = supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        type,
        customer_id,
        supplier_id,
        date,
        due_date,
        subtotal,
        discount_total,
        tax_total,
        total,
        paid_amount,
        currency,
        payment_method,
        status,
        created_at,
        updated_at
      `)
      .eq("user_id", userId)
      .order(sortBy, { ascending: sortDirection === "asc" })
      .limit(fetchLimit);

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

    if (cursor) {
      if (sortDirection === "desc") {
        query = query.lt(sortBy, cursor);
      } else {
        query = query.gt(sortBy, cursor);
      }
    }

    // ✅ FIX: دو کوئری موازی + count: "estimated"
    const [queryResult, countResult] = await Promise.all([
      query,
      supabase
        .from("invoices")
        .select("id", { count: "estimated", head: true })
        .eq("user_id", userId),
    ]);

    const { data, error } = queryResult;
    if (error) throw new DatabaseError("Failed to fetch invoices", error);

    const hasMore = (data?.length || 0) > maxLimit;
    const items = hasMore ? data.slice(0, maxLimit) : data;
    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]?.id : null;

    const result = {
      invoices: items || [],
      nextCursor,
      hasMore,
      total: countResult.count || 0,
      limit: maxLimit,
    };

    await memoryCache.set(cacheKey, result, 60);
    return result;
  }

  // ─── Get Invoice By ID ───
  async getById(id: string, userId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        type,
        customer_id,
        supplier_id,
        date,
        due_date,
        subtotal,
        discount_total,
        tax_total,
        total,
        paid_amount,
        currency,
        payment_method,
        status,
        notes,
        reference,
        user_id,
        created_at,
        updated_at,
        invoice_items (
          id,
          invoice_id,
          product_id,
          product_name,
          quantity,
          unit_price,
          discount,
          total_price,
          notes
        )
      `)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new NotFoundError("Invoice");
    }

    return data;
  }

  // ─── Create Invoice ───
  async create(userId: string, data: CreateInvoice) {
    // ✅ FIX: استفاده از Sequence یا timestamp-based
    const invoiceNumber = await this.generateInvoiceNumber();

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        type: data.type,
        date: data.date || new Date().toISOString(),
        due_date: data.dueDate || null,
        customer_id: data.customerId || null,
        supplier_id: data.supplierId || null,
        subtotal: data.subtotal || 0,
        discount_total: data.discountTotal || 0,
        discount_type: data.discountType || "fixed",
        tax_rate: data.taxRate || 0,
        tax_total: data.taxTotal || 0,
        total: data.total || 0,
        paid_amount: data.paidAmount || 0,
        payment_method: data.paymentMethod || "cash",
        currency: data.currency || "AFN",
        status: data.paidAmount && data.total && data.paidAmount >= data.total ? "completed" : "pending",
        notes: data.notes || "",
        reference: data.reference || "",
        user_id: userId,
      })
      .select(INVOICE_LIST_COLUMNS)
      .single();

    if (invoiceError || !invoice) throw new DatabaseError("Failed to create invoice", invoiceError);

    if (data.items?.length) {
      const items = data.items.map((item) => ({
        invoice_id: invoice.id,
        product_id: item.productId,
        product_name: item.productName || "",
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount || 0,
        total_price: item.totalPrice || item.quantity * item.unitPrice,
        notes: item.notes || "",
        user_id: userId,
      }));

      const { error: itemsError } = await supabase.from("invoice_items").insert(items);
      if (itemsError) {
        await supabase.from("invoices").delete().eq("id", invoice.id);
        throw new DatabaseError("Failed to create invoice items", itemsError);
      }

      if (data.type === "sale") {
        await this.batchUpdateStock(data.items, userId);
      }
    }

    this.invalidateUserCache(userId);

    this.createAccountingEntries(userId, invoice.id, { ...data, invoiceNumber, total: data.total || 0 })
      .catch(err => console.error('Accounting entry failed:', err));

    this.tryStartWorkflow(userId, invoice.id, Number(data.total || 0))
      .catch(err => console.error('Workflow failed:', err));

    return this.getById(invoice.id, userId);
  }

  // ─── Update Invoice ───
  async update(id: string, userId: string, data: UpdateInvoice) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.status !== undefined) updates.status = data.status;
    if (data.paidAmount !== undefined) updates.paid_amount = data.paidAmount;
    if (data.total !== undefined) updates.total = data.total;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.reference !== undefined) updates.reference = data.reference;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select(INVOICE_LIST_COLUMNS)
      .single();

    if (error) throw new DatabaseError("Failed to update invoice", error);
    if (!invoice) throw new NotFoundError("Invoice");

    this.invalidateUserCache(userId);
    return invoice;
  }

  // ─── Delete Invoice ───
  async delete(id: string, userId: string): Promise<void> {
    await supabase.from("invoice_items").delete().eq("invoice_id", id);
    const { error } = await supabase.from("invoices").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new DatabaseError("Failed to delete invoice", error);
    this.invalidateUserCache(userId);
  }

  // ─── Cache Invalidation ───
  private invalidateUserCache(userId: string) {
    memoryCache.invalidate(`dashboard:v2:${userId}`);
    memoryCache.invalidate(`sales:${userId}`);
    memoryCache.invalidate(`insights:${userId}`);
    memoryCache.invalidate(`invoices:${userId}`);
    memoryCache.invalidate(`customers:${userId}`);
    memoryCache.invalidate(`products:${userId}`);
  }

  // ─── Get Summary ───
  async getSummary(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: invoices } = await supabase
      .from("invoices")
      .select("total, paid_amount, status, created_at")
      .eq("user_id", userId);

    const { data: products } = await supabase
      .from("products")
      .select("quantity, min_stock_level")
      .eq("user_id", userId);

    const todaySales = (invoices || [])
      .filter(i => i.created_at >= today.toISOString() && i.created_at < tomorrow.toISOString())
      .reduce((sum: number, i: any) => sum + (i.total || 0), 0);

    const totalDebt = (invoices || [])
      .filter(i => i.status !== "paid")
      .reduce((sum: number, i: any) => sum + Math.max(0, (i.total || 0) - (i.paid_amount || 0)), 0);

    const lowStockCount = (products || [])
      .filter((p: any) => (p.min_stock_level || 0) > 0 && (p.quantity || 0) <= (p.min_stock_level || 0))
      .length;

    return { todaySales, totalDebt, lowStockCount };
  }

  // ─── Private: Batch Update Stock ───
  private async batchUpdateStock(items: any[], userId: string) {
    if (!items || items.length === 0) return;

    const productIds = items
      .filter(item => item.productId)
      .map(item => item.productId);

    if (productIds.length === 0) return;

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, quantity')
      .in('id', productIds);

    if (productsError) {
      throw new DatabaseError("Failed to fetch products for stock update", productsError);
    }

    const productMap = new Map();
    for (const product of products) {
      productMap.set(product.id, product.quantity);
    }

    const updatePromises = items
      .filter(item => item.productId && productMap.has(item.productId))
      .map(async (item) => {
        const currentQuantity = productMap.get(item.productId) || 0;
        const newQuantity = Math.max(0, currentQuantity - item.quantity);
        await supabase
          .from('products')
          .update({ quantity: newQuantity })
          .eq('id', item.productId);
      });

    await Promise.all(updatePromises);

    const movements = items
      .filter(item => item.productId)
      .map(item => ({
        product_id: item.productId,
        type: "sale",
        quantity: -item.quantity,
        reference_type: "invoice",
        user_id: userId,
      }));

    if (movements.length > 0) {
      await supabase.from('stock_movements').insert(movements);
    }
  }

  // ─── Private: Accounting Entries ───
  private async createAccountingEntries(userId: string, invoiceId: string, data: { type: string; total: number; items?: any[]; invoiceNumber?: string; date?: string }): Promise<void> {
    try {
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, type")
        .in("code", ["1200", "4000", "5000", "1000"])
        .eq("user_id", userId);

      if (!accounts || accounts.length < 4) return;

      const accountMap: Record<string, string> = {};
      for (const acc of accounts) accountMap[acc.code] = acc.id;

      const receivableId = accountMap["1200"];
      const revenueId = accountMap["4000"];
      const cogsId = accountMap["5000"];
      const inventoryId = accountMap["1000"];

      if (!receivableId || !revenueId || !cogsId || !inventoryId) return;

      const { data: journalEntry, error: journalError } = await supabase
        .from("journal_entries")
        .insert({
          date: data.date ? data.date.split("T")[0] : new Date().toISOString().split("T")[0],
          description: `فاکتور فروش ${data.invoiceNumber || invoiceId.substring(0, 8)}`,
          reference: invoiceId,
          user_id: userId,
        })
        .select()
        .single();

      if (journalError || !journalEntry) return;

      const journalLines: any[] = [
        { journal_id: journalEntry.id, account_id: receivableId, debit: data.total, credit: 0, user_id: userId },
        { journal_id: journalEntry.id, account_id: revenueId, debit: 0, credit: data.total, user_id: userId },
      ];

      if (data.type === "sale" && data.items?.length) {
        const productIds = data.items.map(item => item.productId);
        const { data: products } = await supabase
          .from("products")
          .select("id, buy_price")
          .in("id", productIds);

        const productPriceMap = new Map();
        for (const product of products || []) {
          productPriceMap.set(product.id, product.buy_price || 0);
        }

        for (const item of data.items) {
          const itemCost = (productPriceMap.get(item.productId) || 0) * item.quantity;
          journalLines.push(
            { journal_id: journalEntry.id, account_id: cogsId, debit: itemCost, credit: 0, user_id: userId },
            { journal_id: journalEntry.id, account_id: inventoryId, debit: 0, credit: itemCost, user_id: userId }
          );
        }
      }

      const { error: linesError } = await supabase.from("journal_lines").insert(journalLines);
      if (linesError) {
        await supabase.from("journal_entries").delete().eq("id", journalEntry.id);
      }
    } catch (err) {
      console.error("❌ Error in createAccountingEntries:", err);
    }
  }

  // ─── Private: Generate Invoice Number — FIXED ───
  // ✅ استفاده از timestamp-based به جای COUNT (بدون race condition)
  private async generateInvoiceNumber(): Promise<string> {
    try {
      // تلاش برای استفاده از Sequence (اگر وجود داشته باشد)
      const { data, error } = await supabase.rpc('get_next_invoice_number');
      if (!error && data) {
        return `INV-${String(data).padStart(6, '0')}`;
      }
    } catch {
      // Fallback: اگر RPC موجود نبود، از timestamp استفاده کن
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `INV-${timestamp}-${random}`;
    }
    // Fallback نهایی
    return `INV-${Date.now().toString(36).toUpperCase()}`;
  }

  // ─── Private: Start Workflow ───
  private async tryStartWorkflow(userId: string, invoiceId: string, total: number): Promise<void> {
    try {
      const { data: workflows } = await supabase
        .from("workflows")
        .select("id")
        .eq("entity_type", "invoice")
        .eq("is_active", true)
        .is("deleted_at", null)
        .limit(1);

      const workflow = workflows?.[0];
      if (!workflow) return;

      const { data: membership } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", userId)
        .limit(1)
        .single();

      const workspaceId = membership?.workspace_id;
      if (!workspaceId) return;

      await this.workflowService.startWorkflow(workspaceId, {
        workflow_id: workflow.id,
        entity_type: "invoice",
        entity_id: invoiceId,
      });
    } catch {
      /* silent — never block invoice creation */
    }
  }
}

export default InvoiceService;