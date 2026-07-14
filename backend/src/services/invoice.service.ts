// ============================================
// backend/src/services/invoice.service.ts
// Hisabche v1.1 — With Workflow auto-trigger + Notification + Accounting
// Performance Optimized v2.0 — Explicit Column Selection
// ============================================

import { supabase } from "../db";
import { WorkflowService } from "./workflow.service";
import { CreateInvoice, UpdateInvoice, InvoiceFilters } from "@hisabche/validation";
import { DatabaseError, NotFoundError } from "../errors/database.error";

// ============================================
// ✅ Column Selection Constants — SaaS Performance
// ============================================

// لیست فاکتورها: فقط ستون‌های ضروری برای نمایش در جدول
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
  created_at
`

// آیتم‌های فاکتور در لیست: فقط ستون‌های ضروری
const INVOICE_ITEMS_LIST_COLUMNS = `
  id,
  product_id,
  product_name,
  quantity,
  unit_price,
  discount,
  total_price
`

// جزئیات کامل فاکتور (برای صفحه جزئیات)
const INVOICE_DETAIL_COLUMNS = `
  *,
  invoice_items(*)
`

// ============================================

export class InvoiceService {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  // ──────────────────────────────────────────
  // List Invoices — بهینه‌شده
  // ──────────────────────────────────────────
  async list(userId: string, filters: InvoiceFilters) {
    const {
      search,
      type,
      status,
      customerId,
      supplierId,
      currency,
      dateFrom,
      dateTo,
      minTotal,
      maxTotal,
      page,
      limit,
      sortBy,
      sortDirection,
    } = filters;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("invoices")
      .select(
        `${INVOICE_LIST_COLUMNS}, invoice_items(${INVOICE_ITEMS_LIST_COLUMNS})`,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order(sortBy || "created_at", { ascending: sortDirection === "asc" })
      .range(from, to);

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

    return {
      invoices: data || [],
      total: count || 0,
      page,
      limit,
      summary: await this.getSummary(userId),
    };
  }

  // ──────────────────────────────────────────
  // Get Invoice By ID — جزئیات کامل
  // ──────────────────────────────────────────
  async getById(id: string, userId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select(INVOICE_DETAIL_COLUMNS)
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) throw new NotFoundError("Invoice");
    return data;
  }

  // ──────────────────────────────────────────
  // Create Invoice — با workflow و accounting
  // ──────────────────────────────────────────
  async create(userId: string, data: CreateInvoice) {
    const invoiceNumber = await this.generateInvoiceNumber(userId);

    // ─── ۱. ایجاد فاکتور ─────────────────────
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
        status:
          data.paidAmount && data.total && data.paidAmount >= data.total
            ? "completed"
            : "pending",
        notes: data.notes || "",
        reference: data.reference || "",
        user_id: userId,
      })
      .select(INVOICE_LIST_COLUMNS)
      .single();

    if (invoiceError || !invoice)
      throw new DatabaseError("Failed to create invoice", invoiceError);

    // ─── ۲. ایجاد آیتم‌های فاکتور ─────────────
    if (data.items?.length) {
      const items = data.items.map((item) => ({
        invoice_id: invoice.id,
        product_id: item.productId,
        product_name: item.productName || "",
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount || 0,
        total_price:
          item.totalPrice || item.quantity * item.unitPrice,
        notes: item.notes || "",
        user_id: userId,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(items);

      if (itemsError) {
        // Rollback: حذف فاکتور اگر آیتم‌ها fail شوند
        await supabase.from("invoices").delete().eq("id", invoice.id);
        throw new DatabaseError(
          "Failed to create invoice items",
          itemsError
        );
      }

      // ─── ۳. به‌روزرسانی موجودی ──────────────
      if (data.type === "sale") {
        for (const item of data.items) {
          if (item.productId) {
            await this.updateStock(
              item.productId,
              item.quantity,
              userId
            );
          }
        }
      }
    }

    // ─── ۴. ثبت تراکنش مالی ─────────────────
    if (
      data.customerId &&
      (data.paidAmount || 0) < (data.total || 0)
    ) {
      await supabase.from("transactions").insert({
        customer_id: data.customerId,
        type: "sale",
        amount: (data.total || 0) - (data.paidAmount || 0),
        currency: data.currency || "AFN",
        description: `Invoice ${invoiceNumber}`,
        reference: invoice.id,
        date: new Date().toISOString(),
        user_id: userId,
      });
    }

    // ══════════════════════════════════════════
    // ✅ NEW — ۵. ثبت‌های حسابداری (Journal Entries)
    // ══════════════════════════════════════════
    await this.createAccountingEntries(userId, invoice.id, {
      ...data,
      invoiceNumber,
      total: data.total || 0,
    });

    // ─── ۶. ورک‌فلو و اعلان ──────────────────
    await this.tryStartWorkflow(
      userId,
      invoice.id,
      Number(data.total || 0)
    );

    return this.getById(invoice.id, userId);
  }

  // ──────────────────────────────────────────
  // Update Invoice
  // ──────────────────────────────────────────
  async update(id: string, userId: string, data: UpdateInvoice) {
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (data.status !== undefined) updates.status = data.status;
    if (data.paidAmount !== undefined)
      updates.paid_amount = data.paidAmount;
    if (data.total !== undefined) updates.total = data.total;
    if (data.notes !== undefined) updates.notes = data.notes;
    if (data.reference !== undefined)
      updates.reference = data.reference;

    const { data: invoice, error } = await supabase
      .from("invoices")
      .update(updates)
      .eq("id", id)
      .eq("user_id", userId)
      .select(INVOICE_LIST_COLUMNS)
      .single();

    if (error)
      throw new DatabaseError("Failed to update invoice", error);
    if (!invoice) throw new NotFoundError("Invoice");

    return invoice;
  }

  // ──────────────────────────────────────────
  // Delete Invoice
  // ──────────────────────────────────────────
  async delete(id: string, userId: string): Promise<void> {
    // حذف آیتم‌های فاکتور
    await supabase.from("invoice_items").delete().eq("invoice_id", id);

    // حذف فاکتور
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error)
      throw new DatabaseError("Failed to delete invoice", error);
  }

  // ──────────────────────────────────────────
  // Get Summary — Dashboard Stats
  // ──────────────────────────────────────────
  async getSummary(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // فروش امروز
    const { data: salesData } = await supabase
      .from("invoices")
      .select("total")
      .eq("user_id", userId)
      .gte("created_at", today.toISOString())
      .lt("created_at", tomorrow.toISOString());

    const todaySales =
      salesData?.reduce((s, i) => s + (i.total || 0), 0) || 0;

    // کل بدهی
    const { data: debtData } = await supabase
      .from("invoices")
      .select("total, paid_amount")
      .eq("user_id", userId)
      .neq("status", "paid");

    const totalDebt =
      debtData?.reduce(
        (s, i) =>
          s + Math.max(0, (i.total || 0) - (i.paid_amount || 0)),
        0
      ) || 0;

    // موجودی کم
    const { data: stockData } = await supabase
      .from("products")
      .select("quantity, min_stock_level")
      .eq("user_id", userId);

    const lowStockCount =
      stockData?.filter(
        (p) =>
          (p.min_stock_level || 0) > 0 &&
          (p.quantity || 0) <= (p.min_stock_level || 0)
      ).length || 0;

    return { todaySales, totalDebt, lowStockCount };
  }

  // ══════════════════════════════════════════
  // ✅ NEW — متد ثبت‌های حسابداری
  // ══════════════════════════════════════════
  private async createAccountingEntries(
    userId: string,
    invoiceId: string,
    data: {
      type: string;
      total: number;
      items?: any[];
      invoiceNumber?: string;
      date?: string;
    }
  ): Promise<void> {
    try {
      // ۱. دریافت شناسه حساب‌ها
      const { data: accounts } = await supabase
        .from("accounts")
        .select("id, code, type")
        .in("code", ["1200", "4000", "5000", "1000"])
        .eq("user_id", userId);

      if (!accounts || accounts.length < 4) {
        console.warn(
          "⚠️ حساب‌های حسابداری کامل نیستند. لطفاً حساب‌های ۱۲۰۰، ۴۰۰۰، ۵۰۰۰ و ۱۰۰۰ را ایجاد کنید."
        );
        return;
      }

      const accountMap: Record<string, string> = {};
      for (const acc of accounts) {
        accountMap[acc.code] = acc.id;
      }

      const receivableId = accountMap["1200"]; // حساب دریافتنی
      const revenueId = accountMap["4000"]; // حساب فروش
      const cogsId = accountMap["5000"]; // هزینه کالای فروش رفته
      const inventoryId = accountMap["1000"]; // موجودی کالا

      if (!receivableId || !revenueId || !cogsId || !inventoryId) {
        console.warn(
          "⚠️ یکی از حساب‌های حسابداری یافت نشد."
        );
        return;
      }

      // ۲. ایجاد سند حسابداری (Journal Entry)
      const { data: journalEntry, error: journalError } =
        await supabase
          .from("journal_entries")
          .insert({
            date: data.date
              ? data.date.split("T")[0]
              : new Date().toISOString().split("T")[0],
            description: `فاکتور فروش ${
              data.invoiceNumber || invoiceId.substring(0, 8)
            }`,
            reference: invoiceId,
            user_id: userId,
          })
          .select()
          .single();

      if (journalError || !journalEntry) {
        console.error(
          "❌ Failed to create journal entry:",
          journalError
        );
        return;
      }

      // ۳. ثبت خطوط حسابداری
      const journalLines: any[] = [
        // بدهکار: حساب دریافتنی
        {
          journal_id: journalEntry.id,
          account_id: receivableId,
          debit: data.total,
          credit: 0,
          user_id: userId,
        },
        // بستانکار: حساب فروش
        {
          journal_id: journalEntry.id,
          account_id: revenueId,
          debit: 0,
          credit: data.total,
          user_id: userId,
        },
      ];

      // ۴. اگر نوع فروش باشد، ثبت هزینه کالای فروش رفته و کاهش موجودی
      if (data.type === "sale" && data.items?.length) {
        let totalCogs = 0;
        for (const item of data.items) {
          // دریافت قیمت تمام شده محصول
          const { data: product } = await supabase
            .from("products")
            .select("buy_price")
            .eq("id", item.productId)
            .single();

          const costPrice = product?.buy_price || 0;
          const itemCost = costPrice * item.quantity;
          totalCogs += itemCost;

          // ثبت هزینه کالای فروش رفته
          journalLines.push({
            journal_id: journalEntry.id,
            account_id: cogsId,
            debit: itemCost,
            credit: 0,
            user_id: userId,
          });

          // ثبت کاهش موجودی
          journalLines.push({
            journal_id: journalEntry.id,
            account_id: inventoryId,
            debit: 0,
            credit: itemCost,
            user_id: userId,
          });
        }
      }

      // ۵. درج خطوط حسابداری
      const { error: linesError } = await supabase
        .from("journal_lines")
        .insert(journalLines);

      if (linesError) {
        // Rollback: حذف سند حسابداری
        await supabase
          .from("journal_entries")
          .delete()
          .eq("id", journalEntry.id);
        console.error(
          "❌ Failed to create journal lines:",
          linesError
        );
      } else {
        console.log(
          `✅ Journal entries created for invoice ${invoiceId}`
        );
      }
    } catch (err) {
      console.error("❌ Error in createAccountingEntries:", err);
      // خطا را نادیده می‌گیریم تا ایجاد فاکتور متوقف نشود
    }
  }

  // ──────────────────────────────────────────
  // Generate Invoice Number — بهینه‌شده
  // ──────────────────────────────────────────
  private async generateInvoiceNumber(
    userId: string
  ): Promise<string> {
    const { count } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    return `INV-${((count || 0) + 1)
      .toString()
      .padStart(6, "0")}`;
  }

  // ──────────────────────────────────────────
  // Update Stock — بهینه‌شده
  // ──────────────────────────────────────────
  private async updateStock(
    productId: string,
    quantity: number,
    userId: string
  ): Promise<void> {
    const { data: product, error } = await supabase
      .from("products")
      .select("quantity, buy_price")
      .eq("id", productId)
      .single();

    if (error || !product)
      throw new DatabaseError("Product not found", error);

    await supabase
      .from("products")
      .update({
        quantity: Math.max(0, product.quantity - quantity),
      })
      .eq("id", productId);

    await supabase.from("stock_movements").insert({
      product_id: productId,
      type: "sale",
      quantity: -quantity,
      reference_type: "invoice",
      user_id: userId,
    });
  }

  // ──────────────────────────────────────────
  // Start Workflow & Send Notification
  // ──────────────────────────────────────────
  private async tryStartWorkflow(
    userId: string,
    invoiceId: string,
    total: number
  ): Promise<void> {
    try {
      // 1. Start workflow
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

      // 2. Send notification
      await supabase.from("notifications").insert({
        workspace_id: workspaceId,
        user_id: userId,
        title: "فاکتور جدید ثبت شد",
        body: `فاکتور #${invoiceId.substring(
          0,
          8
        )} به مبلغ ${total.toLocaleString()} افغانی ثبت شد و نیاز به تأیید دارد.`,
        type: "approval_required",
        action_url: `/invoices/${invoiceId}`,
        entity_type: "invoice",
        entity_id: invoiceId,
      });
    } catch {
      /* silent — never block invoice creation */
    }
  }
}

export default InvoiceService;