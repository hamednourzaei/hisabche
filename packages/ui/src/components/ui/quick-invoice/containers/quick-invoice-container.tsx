// packages/ui/src/components/ui/quick-invoice/containers/quick-invoice-container.tsx
"use client";

import {
  useEffect,
  useRef,
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
import type { QuickInvoicePageProps } from "../quick-invoice-page";

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
  const inputRef = useRef<HTMLInputElement>(null!);

  const [step, setStep] = useState<QuickInvoicePageProps["step"]>("product");
  const [selectedProduct, setSelectedProduct] =
    useState<QuickInvoicePageProps["selectedProduct"]>(null);
  const [selectedCustomer, setSelectedCustomer] =
    useState<QuickInvoicePageProps["selectedCustomer"]>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [paymentType, setPaymentType] =
    useState<QuickInvoicePageProps["paymentType"]>("cash");
  const [paidNow, setPaidNow] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      1000
    );
    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    if (selectedProduct?.sellPrice) {
      setPrice(selectedProduct.sellPrice.toString());
    }
  }, [selectedProduct]);

  // ✅ useMemo برای محاسبات
  const total = useMemo(
    () => (parseFloat(price) || 0) * (parseInt(quantity) || 1),
    [price, quantity]
  );

  const productName = useMemo(
    () => selectedProduct?.name ?? "",
    [selectedProduct]
  );

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
    if (!selectedProduct || !price) return;

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
        items: [
          {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: parseInt(quantity),
            unitPrice: parseFloat(price),
            discount: 0,
            totalPrice: total,
          },
        ],
      });

      preferences.addRecentProduct(selectedProduct.name);
      preferences.addFrequentProduct(selectedProduct.name);
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
    selectedProduct,
    price,
    total,
    paidAmount,
    paymentType,
    quantity,
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
      selectedProduct={selectedProduct}
      selectedCustomer={selectedCustomer}
      price={price}
      quantity={quantity}
      paymentType={paymentType}
      paidNow={paidNow}
      total={total}
      productName={productName}
      paidAmount={paidAmount}
      createdInvoiceId={createdInvoiceId}
      isPending={createInvoice.isPending}
      inputRef={inputRef}
      onSelectProduct={setSelectedProduct}
      onSelectCustomer={setSelectedCustomer}
      onPriceChange={setPrice}
      onQuantityChange={setQuantity}
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