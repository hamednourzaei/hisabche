"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { DollarSign, Package, AlertTriangle, Loader2 } from "lucide-react";
import { useCreateProduct } from "@hisabche/api";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { useSyncStore, useBackupStore } from "@hisabche/store";

// ─── Schema ────────────────────────────────────────────────────────────────

const productSchema = z.object({
  name: z.string().min(1, "product.nameRequired"),
  quantity: z.number().min(0),
  buyPrice: z.number().min(0),
  sellPrice: z.number().min(0),
  unit: z.enum(["piece", "kg", "liter", "meter", "box"]),
  minStock: z.number().min(0),
});

type ProductFormValues = z.infer<typeof productSchema>;

// ─── Props ─────────────────────────────────────────────────────────────────

interface AddProductModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const UNIT_OPTIONS = [
  { value: "piece", labelKey: "warehouse.units.piece", fallback: "عدد" },
  { value: "kg", labelKey: "warehouse.units.kg", fallback: "کیلوگرم" },
  { value: "liter", labelKey: "warehouse.units.liter", fallback: "لیتر" },
  { value: "meter", labelKey: "warehouse.units.meter", fallback: "متر" },
  { value: "box", labelKey: "warehouse.units.box", fallback: "کارتن" },
] as const;

// ─── Component ─────────────────────────────────────────────────────────────

export function AddProductModal({
  open,
  onClose,
  onCreated,
}: AddProductModalProps) {
  const { t } = useTranslation();
  const createProduct = useCreateProduct();
  const { setSaveStatus } = useSyncStore();
  const { addAuditEntry } = useBackupStore();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting, errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      quantity: 0,
      buyPrice: 0,
      sellPrice: 0,
      unit: "piece",
      minStock: 5,
    },
  });

  const onSubmit = async (data: ProductFormValues) => {
    setSaveStatus("saving");
    try {
      const product = await createProduct.mutateAsync({
        name: data.name.trim(),
        quantity: data.quantity,
        buyPrice: data.buyPrice,
        sellPrice: data.sellPrice,
        unit: data.unit,
        minStockLevel: data.minStock,
        category: "general",
        isActive: true,
      });
      addAuditEntry({
        action: "create",
        entity: "product",
        entityId: product.id || "",
        details: `محصول جدید: ${data.name.trim()}`,
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
      reset();
      onCreated?.();
      onClose();
    } catch (error) {
      setSaveStatus("idle");
      console.error("Failed to create product:", error);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const getErrorMessage = (error: unknown): string | undefined => {
    if (error && typeof error === "object" && "message" in error) {
      return t((error as { message: string }).message);
    }
    return undefined;
  };

  const isPending = isSubmitting || createProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md !bg-[hsl(var(--surface-elevated))] !bg-opacity-90 !backdrop-blur-none border-[hsl(var(--border-default))]">
        {/* ── Save indicator ── */}
        {isPending && (
          <div className="absolute top-3 end-3 flex items-center gap-2 text-sm text-[hsl(var(--fg-secondary))]">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>{t("common.saving", "در حال ذخیره...")}</span>
          </div>
        )}

        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--fg-primary))]">
            {t("warehouse.addProductModal", "محصول جدید")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("warehouse.addProductDescription", "فرم ثبت محصول جدید")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* ── Name ── */}
          <div className="space-y-2">
            <Label htmlFor="product-name" className="text-[hsl(var(--fg-primary))]">
              {t("warehouse.productName", "نام محصول")}
              <span aria-hidden="true" className="text-[hsl(var(--color-destructive))] ms-1">*</span>
            </Label>
            <div className="relative">
              <Package className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
              <Input
                id="product-name"
                {...register("name")}
                placeholder={t("warehouse.productNamePlaceholder", "نام محصول را وارد کنید")}
                className="ps-9 bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
                autoFocus
              />
            </div>
            {errors.name && (
              <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                {t(errors.name.message || "نام محصول الزامی است")}
              </p>
            )}
          </div>

          {/* ── Quantity + Unit ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-quantity" className="text-[hsl(var(--fg-primary))]">
                {t("warehouse.initialStock", "موجودی اولیه")}
              </Label>
              <Input
                id="product-quantity"
                {...register("quantity", { valueAsNumber: true })}
                type="number"
                min={0}
                placeholder="0"
                className="bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
              />
              {errors.quantity && (
                <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                  {getErrorMessage(errors.quantity) || t("validation.min", "مقدار وارد شده معتبر نیست")}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-unit" className="text-[hsl(var(--fg-primary))]">
                {t("warehouse.unit", "واحد")}
              </Label>
              <Controller
                name="unit"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="product-unit" className="w-full">
                      <SelectValue placeholder={t("warehouse.unit", "واحد")} />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {t(opt.labelKey, opt.fallback)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          {/* ── Buy Price + Sell Price ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="product-buy-price" className="text-[hsl(var(--fg-primary))]">
                {t("warehouse.buyPrice", "قیمت خرید (AFN)")}
              </Label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
                <Input
                  id="product-buy-price"
                  {...register("buyPrice", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  className="ps-9 bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
                />
              </div>
              {errors.buyPrice && (
                <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                  {getErrorMessage(errors.buyPrice)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-sell-price" className="text-[hsl(var(--fg-primary))]">
                {t("warehouse.sellPrice", "قیمت فروش (AFN)")}
              </Label>
              <div className="relative">
                <DollarSign className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
                <Input
                  id="product-sell-price"
                  {...register("sellPrice", { valueAsNumber: true })}
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  className="ps-9 bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
                />
              </div>
              {errors.sellPrice && (
                <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                  {getErrorMessage(errors.sellPrice)}
                </p>
              )}
            </div>
          </div>

          {/* ── Min Stock ── */}
          <div className="space-y-2">
            <Label htmlFor="product-min-stock" className="text-[hsl(var(--fg-primary))]">
              {t("warehouse.minStock", "حداقل موجودی هشدار")}
            </Label>
            <div className="relative">
              <AlertTriangle className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-[hsl(var(--fg-tertiary))] pointer-events-none" aria-hidden="true" />
              <Input
                id="product-min-stock"
                {...register("minStock", { valueAsNumber: true })}
                type="number"
                min={0}
                placeholder="5"
                className="ps-9 bg-[hsl(var(--surface-base))] border-[hsl(var(--border-default))] text-[hsl(var(--fg-primary))] placeholder:text-[hsl(var(--fg-tertiary))] focus:border-[hsl(var(--color-primary)/0.5)] focus:ring-1 focus:ring-[hsl(var(--color-primary)/0.3)]"
              />
            </div>
            {errors.minStock && (
              <p className="text-sm text-[hsl(var(--color-destructive))]" role="alert">
                {getErrorMessage(errors.minStock)}
              </p>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleClose}
              disabled={isPending}
            >
              {t("action.cancel", "انصراف")}
            </Button>
            <Button
              type="submit"
              className="w-full"
              disabled={isPending}
            >
              {isPending && (
                <Loader2 className="size-4 me-2 animate-spin" aria-hidden="true" />
              )}
              {t("action.save", "ذخیره")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}