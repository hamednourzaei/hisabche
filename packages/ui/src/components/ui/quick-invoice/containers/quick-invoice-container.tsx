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
import { useTranslation } from "react-i18next";
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
  const { t: tOriginal } = useTranslation();
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
  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 0),
        0
      ),
    [items]
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

  const paidAmount = useMemo(
    () => (paymentType === "cash" ? total : parseFloat(paidNow) || 0),
    [paymentType, total, paidNow]
  );

  // ✅ safeT wrapper
  const safeT = useCallback(
    (key: string, fallback?: string): string => {
      const result = tOriginal(key);
      return result && result !== key ? result : (fallback ?? key);
    },
    [tOriginal]
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
        subtotal: total,
        discountTotal: 0,
        discountType: "fixed",
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
            productId: item.product.id,
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
      total={total}
      productName={productName}
      paidAmount={paidAmount}
      createdInvoiceId={createdInvoiceId}
      isPending={createInvoice.isPending}
      onAddItem={addItem}
      onRemoveItem={removeItem}
      onUpdateItemQuantity={updateItemQuantity}
      onUpdateItemPrice={updateItemPrice}
      onSelectCustomer={setSelectedCustomer}
      onPaymentTypeChange={setPaymentType}
      onPaidNowChange={setPaidNow}
      onSetStep={setStep}
      onCreate={handleCreate}
      onDismissCelebration={dismissCelebration}
      onViewInvoice={handleViewInvoice}
      onViewAllInvoices={handleViewAllInvoices}
    />
  );
});

QuickInvoiceContainer.displayName = "QuickInvoiceContainer";