"use client";

import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useCreateCustomer, useCreateInvoice } from "@hisabche/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../dialog";
import { ProductPicker } from "../product-picker";
import { PhoneInput } from "../phone-input";
import { MoneyInput } from "../money-input";
import { useSyncStore, useBackupStore } from "@hisabche/store";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  RefreshCw,
  User,
  Package,
  DollarSign,
  Check,
  Loader2,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   AddCustomerModal v4 — PhoneInput International
   ═══════════════════════════════════════════════════════════════════════════ */

type ProductOption = NonNullable<
  Parameters<typeof ProductPicker>[0]["value"]
>;

const toNum = (v: string): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (v: number): string => v.toLocaleString("fa-AF");

const customerSchema = z.object({
  name: z.string().min(1, "customer.nameRequired"),
  phone: z.string().optional().or(z.literal("")),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

interface AddCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

const inputBase =
  "w-full rounded-xl ps-9 pe-3 py-2.5 text-sm border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:outline-none focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)] transition-colors duration-200 motion-reduce:transition-none";
const outlineBtn =
  "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors duration-150 motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed";
const primaryBtn =
  "inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-bold text-white bg-[hsl(var(--color-primary))] shadow-sm shadow-[hsl(var(--color-primary)/0.15)] transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none";

export function AddCustomerModal({
  open,
  onClose,
  onCreated,
}: AddCustomerModalProps) {
  const { t } = useTranslation();
  const createCustomer = useCreateCustomer();
  const createInvoice = useCreateInvoice();
  const { setSaveStatus } = useSyncStore();
  const { addAuditEntry } = useBackupStore();

  const [withDebt, setWithDebt] = useState(false);
  const [product, setProduct] = useState<ProductOption | null>(null);
  const [qty, setQty] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [phoneValue, setPhoneValue] = useState("");

  const total = useMemo(
    () => toNum(unitPrice) * Math.max(1, toNum(qty)),
    [unitPrice, qty],
  );

  const pending = createCustomer.isPending || createInvoice.isPending;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", phone: "" },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

  const close = useCallback(() => {
    reset();
    setWithDebt(false);
    setProduct(null);
    setQty("1");
    setUnitPrice("");
    setError(null);
    setPhoneValue("");
    onClose();
  }, [reset, onClose]);

  const onSubmit = async (data: CustomerFormValues) => {
    setError(null);
    setSaveStatus("saving");

    try {
      const customer = await createCustomer.mutateAsync({
        type: 'cash',
        fullName: data.name,
        phone: phoneValue || undefined,
        openingBalance: 0,
        isActive: true,
      });

      addAuditEntry({
        action: "create",
        entity: "customer",
        entityId: customer.id || "",
        details: `${t("customers.newCustomerDetails", "مشتری جدید")}: ${data.name}`,
      });

      if (withDebt && product && total > 0) {
        await createInvoice.mutateAsync({
          type: "sale",
          date: new Date().toISOString(),
          subtotal: total,
          discountTotal: 0,
          discountType: "fixed",
          taxRate: 0,
          taxTotal: 0,
          total,
          paidAmount: 0,
          paymentMethod: "credit",
          currency: "AFN",
          customerId: customer.id,
          items: [
            {
              productId: product.id,
              productName: product.name,
              quantity: toNum(qty),
              unitPrice: toNum(unitPrice),
              discount: 0,
              totalPrice: total,
            },
          ],
        });
      }

      setSaveStatus("saved");
      setShowSaved(true);
      setTimeout(() => {
        setSaveStatus("idle");
        setShowSaved(false);
      }, 2000);

      onCreated?.();
      close();
    } catch {
      setSaveStatus("error");
      setError(t("common.saveError", "خطا در ذخیره اطلاعات"));
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  const retrySubmit = () => {
    handleSubmit(onSubmit)();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && close()}>
      <DialogContent className="max-w-md">
        {showSaved && (
          <div
            role="status"
            aria-live="polite"
            className="absolute top-3 end-3 flex items-center gap-2 text-sm text-[hsl(var(--color-success))]"
          >
            <Check className="size-4" aria-hidden="true" />
            <span>{t("common.saved", "ذخیره شد ✅")}</span>
          </div>
        )}

        <DialogHeader>
          <DialogTitle>
            {t("customers.addCustomer", "افزودن مشتری جدید")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div>
            <div className="relative">
              <User
                className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
                aria-hidden="true"
              />
              <input
                {...register("name")}
                placeholder={t("customers.form.namePlaceholder", "نام کامل")}
                autoFocus
                className={cn(inputBase, errors.name && "border-[hsl(var(--color-destructive))]")}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-[hsl(var(--color-destructive))]" role="alert">
                {t(errors.name.message || "نام الزامی است")}
              </p>
            )}
          </div>

          {/* 🆕 Phone — International */}
          <div>
            <PhoneInput
              value={phoneValue}
              onChange={setPhoneValue}
              placeholder={t("customers.form.phonePlaceholder", "شماره تماس")}
              defaultCountry="+98"
            />
          </div>

          {/* Debt toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWithDebt(false)}
              className={cn(
                "flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200 motion-reduce:transition-none",
                !withDebt
                  ? "bg-[hsl(var(--color-primary))] text-white shadow-sm"
                  : outlineBtn,
              )}
            >
              {t("customers.form.newCustomer", "مشتری بدون بدهی")}
            </button>
            <button
              type="button"
              onClick={() => setWithDebt(true)}
              className={cn(
                "flex-1 rounded-full px-4 py-2.5 text-sm font-bold transition-all duration-200 motion-reduce:transition-none",
                withDebt
                  ? "bg-[hsl(var(--color-destructive))] text-white shadow-sm"
                  : outlineBtn,
              )}
            >
              {t("customers.form.hasDebt", "مشتری دارای بدهی")}
            </button>
          </div>

          {/* Debt details */}
          {withDebt && (
            <div className="space-y-3 rounded-xl border border-[hsl(var(--border-default))] bg-[hsl(var(--surface-base))] p-4">
              <ProductPicker
                value={product}
                onChange={setProduct}
                placeholder={t("customers.form.whichProduct", "انتخاب محصول")}
              />

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <DollarSign
                    className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
                    aria-hidden="true"
                  />
                  <MoneyInput
                    value={unitPrice}
                    onChange={(raw) => setUnitPrice(raw)}
                    placeholder={t("customers.form.unitPrice", "قیمت واحد")}
                    className={cn(inputBase, "h-auto")}
                  />
                </div>
                <div className="relative">
                  <Package
                    className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    placeholder={t("customers.form.qty", "تعداد")}
                    className={inputBase}
                  />
                </div>
              </div>

              {total > 0 && (
                <p className="text-center text-lg font-bold tabular-nums text-[hsl(var(--color-primary))]">
                  {t("customers.form.total", "مجموع")}: {fmt(total)} AFN
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-xl border border-[hsl(var(--color-destructive)/0.2)] bg-[hsl(var(--color-destructive)/0.1)] p-3 text-sm text-[hsl(var(--color-destructive))]"
              role="alert"
            >
              <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
              <p className="flex-1">{error}</p>
              <button
                type="button"
                onClick={retrySubmit}
                className="inline-flex items-center justify-center rounded-full p-1.5 text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.15)] transition-colors duration-150"
              >
                <RefreshCw className="size-3" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={close}
              className={cn(outlineBtn, "w-full")}
            >
              {t("common.cancel", "انصراف")}
            </button>
            <button
              type="submit"
              disabled={pending}
              className={cn(primaryBtn, "w-full")}
            >
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {t("common.save", "ذخیره")}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}