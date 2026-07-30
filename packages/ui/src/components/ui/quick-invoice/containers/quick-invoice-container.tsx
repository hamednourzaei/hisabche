// packages/ui/src/components/ui/quick-invoice/containers/quick-invoice-container.tsx
"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  memo,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreateInvoice } from "@hisabche/api";
import {
  useOnboardingStore,
  usePreferencesStore,
  useSyncStore,
  useBackupStore,
} from "@hisabche/store";
import { QuickInvoicePage } from "../quick-invoice-page";
import type { QuickInvoicePageProps, InvoiceLineItem } from "../quick-invoice-page";

/* ═══════════════════════════════════════════════════════════════════════════
   QuickInvoiceContainer v2 — Memoized · Performance Optimized
   ✅ memo · useCallback · useMemo · safeT
   ═══════════════════════════════════════════════════════════════════════════ */

export const QuickInvoiceContainer = memo(function QuickInvoiceContainer() {
  const t = useTranslations();
  const router = useRouter();
  const createInvoice = useCreateInvoice();
  const { markInvoiceCreated } = useOnboardingStore();
  const preferences = usePreferencesStore();
  const { setSaveStatus } = useSyncStore();
  const { addAuditEntry } = useBackupStore();

  const [step, setStep] = useState<QuickInvoicePageProps["step"]>("product");
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] =
    useState<QuickInvoicePageProps["selectedCustomer"]>(null);
  const [paymentType, setPaymentType] =
    useState<QuickInvoicePageProps["paymentType"]>("cash");
  const [paidNow, setPaidNow] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState<"fixed" | "percentage">("fixed");
  const [isPaid, setIsPaid] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, [startTime]);

  // ✅ useMemo برای محاسبات
  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0),
        0
      ),
    [items]
  );

  const discountAmount = useMemo(() => {
    const v = parseFloat(discountValue) || 0;
    if (v <= 0) return 0;
    return discountType === "percentage" ? (subtotal * v) / 100 : v;
  }, [discountValue, discountType, subtotal]);

  const total = useMemo(
    () => Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100),
    [subtotal, discountAmount]
  );

  const productName = useMemo(
    () => items.map((item) => item.product.name).join("، "),
    [items]
  );

  const addItem = useCallback((product: QuickInvoicePageProps["items"][number]["product"]) => {
    setItems((prev) => {
      if (prev.some((item) => item.product.id === product.id)) return prev;
      return [
        ...prev,
        {
          key: product.id,
          product,
          quantity: "1",
          price: product.sellPrice.toString(),
        },
      ];
    });
  }, []);

  // ✅ آیتم با نام دلخواه (بدون محصول واقعی از انبار) — مثلاً حق‌الزحمه خدمات
  // product.id خالی می‌ماند تا در handleCreate با undefined جایگزین شود و
  // به‌جای شناسه‌ی جعلی محصول، productId اصلاً ارسال نشود (مغایرت FK نداشته باشیم).
  const addCustomItem = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setItems((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}`,
        product: { id: "", name: trimmed, sellPrice: 0, unit: "" },
        quantity: "1",
        price: "0",
      },
    ]);
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const updateItemQuantity = useCallback((key: string, quantity: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity } : item))
    );
  }, []);

  const updateItemPrice = useCallback((key: string, price: string) => {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, price } : item))
    );
  }, []);

  // ✅ سویچ «تسویه شده» صریح — مستقل از نوع پرداخت (نقد/نسیه)، کاربر می‌تواند
  // برای هر دو حالت وضعیت پرداخت را دستی مشخص کند
  const paidAmount = useMemo(
    () => (isPaid ? total : parseFloat(paidNow) || 0),
    [isPaid, total, paidNow]
  );

  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const v = t(key as Parameters<typeof t>[0]);
      return v && v !== key ? v : (fallback ?? key);
    },
    [t]
  );

  const elapsedFormatted = useMemo(
    () =>
      elapsed < 60
        ? `${elapsed}s`
        : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`,
    [elapsed]
  );

  const dismissCelebration = useCallback(() => {
    setShowCelebration(false);
    router.push(
      createdInvoiceId
        ? `/invoices/${createdInvoiceId}`
        : "/invoices"
    );
  }, [createdInvoiceId, router]);

  const handleCreate = useCallback(async () => {
    if (items.length === 0) return;

    setSaveStatus("saving");

    try {
      const newInvoice = await createInvoice.mutateAsync({
        type: "sale",
        date: new Date().toISOString(),
        subtotal,
        discountTotal: discountAmount,
        discountType,
        taxRate: preferences.lastTaxRate ?? 0,
        taxTotal: 0,
        total,
        paidAmount,
        paymentMethod: paymentType === "cash" ? "cash" : "credit",
        currency: (preferences.lastCurrency as "AFN" | "USD" | "PKR" | "IRR") ?? "AFN",
        customerId: selectedCustomer?.id || undefined,
        items: items.map((item) => {
          const quantity = parseInt(item.quantity) || 1;
          const unitPrice = parseFloat(item.price) || 0;
          return {
            // آیتم با نام دلخواه، product.id خالی است — productId ارسال نمی‌شود
            ...(item.product.id && { productId: item.product.id }),
            productName: item.product.name,
            quantity,
            unitPrice,
            discount: 0,
            totalPrice: quantity * unitPrice,
          };
        }),
      });

      for (const item of items) {
        preferences.addRecentProduct(item.product.name);
        preferences.addFrequentProduct(item.product.name);
      }
      if (selectedCustomer) {
        preferences.setLastCustomer(selectedCustomer.name, selectedCustomer.id);
      }
      markInvoiceCreated();

      addAuditEntry({
        action: "create",
        entity: "invoice",
        entityId: newInvoice.id || "",
        details: `فاکتور جدید: ${productName} — ${total.toLocaleString()} AFN ${paymentType === "cash" ? "نقد" : "نسیه"}`,
      });

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);

      setCreatedInvoiceId(newInvoice.id ?? null);
      setShowCelebration(true);
      setStep("done");
    } catch (error) {
      setSaveStatus("idle");
      console.error("Failed to create invoice:", error);
    }
  }, [
    items,
    subtotal,
    discountAmount,
    discountType,
    total,
    paidAmount,
    paymentType,
    selectedCustomer,
    preferences,
    createInvoice,
    markInvoiceCreated,
    setSaveStatus,
    addAuditEntry,
    productName,
  ]);

  const handleViewInvoice = useCallback(
    () => router.push(`/invoices/${createdInvoiceId}`),
    [createdInvoiceId, router]
  );

  const handleViewAllInvoices = useCallback(
    () => router.push("/invoices"),
    [router]
  );

  return (
    <QuickInvoicePage
      t={safeT}
      elapsedFormatted={elapsedFormatted}
      showSaved={false}
      showCelebration={showCelebration}
      step={step}
      items={items}
      selectedCustomer={selectedCustomer}
      paymentType={paymentType}
      paidNow={paidNow}
      subtotal={subtotal}
      discountValue={discountValue}
      discountType={discountType}
      total={total}
      productName={productName}
      paidAmount={paidAmount}
      isPaid={isPaid}
      createdInvoiceId={createdInvoiceId}
      isPending={createInvoice.isPending}
      onAddItem={addItem}
      onAddCustomItem={addCustomItem}
      onRemoveItem={removeItem}
      onUpdateItemQuantity={updateItemQuantity}
      onUpdateItemPrice={updateItemPrice}
      onSelectCustomer={setSelectedCustomer}
      onPaymentTypeChange={setPaymentType}
      onPaidNowChange={setPaidNow}
      onDiscountValueChange={setDiscountValue}
      onDiscountTypeChange={setDiscountType}
      onIsPaidChange={setIsPaid}
      onSetStep={setStep}
      onConfirmCreate={handleCreate}
      onDismissCelebration={dismissCelebration}
      onViewInvoice={handleViewInvoice}
      onViewAllInvoices={handleViewAllInvoices}
    />
  );
});

QuickInvoiceContainer.displayName = "QuickInvoiceContainer";