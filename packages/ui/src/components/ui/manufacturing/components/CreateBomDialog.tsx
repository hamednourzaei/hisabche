// packages/ui/src/components/ui/manufacturing/components/CreateBomDialog.tsx
"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CreateBomItemInput {
  rawMaterialId: string;
  quantity: number;
  unitCost: number;
}

export interface CreateBomInput {
  productId: string;
  version: number;
  isActive: boolean;
  items: CreateBomItemInput[];
}

interface ProductOption {
  id: string;
  name: string;
  unit?: string;
}

interface CreateBomDialogProps {
  t: (key: string, fallback?: string) => string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: CreateBomInput) => void;
  isSubmitting: boolean;
  products: ProductOption[];
}

interface DraftItem {
  key: string;
  rawMaterialId: string;
  quantity: string;
  unitCost: string;
}

let draftKeySeq = 0;
function makeDraftItem(): DraftItem {
  draftKeySeq += 1;
  return { key: `item-${draftKeySeq}`, rawMaterialId: "", quantity: "1", unitCost: "0" };
}

export const CreateBomDialog = memo(function CreateBomDialog({
  t,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  products,
}: CreateBomDialogProps) {
  const [productId, setProductId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([makeDraftItem()]);

  useEffect(() => {
    if (isOpen) {
      setProductId("");
      setItems([makeDraftItem()]);
    }
  }, [isOpen]);

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, makeDraftItem()]);
  }, []);

  const handleRemoveItem = useCallback((key: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.key !== key) : prev));
  }, []);

  const handleItemChange = useCallback(
    (key: string, field: keyof Omit<DraftItem, "key">, value: string) => {
      setItems((prev) => prev.map((it) => (it.key === key ? { ...it, [field]: value } : it)));
    },
    []
  );

  const validItems = items.filter((it) => it.rawMaterialId && Number(it.quantity) > 0);
  const canSubmit = !!productId && validItems.length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!productId || validItems.length === 0) return;
      onSubmit({
        productId,
        version: 1,
        isActive: true,
        items: validItems.map((it) => ({
          rawMaterialId: it.rawMaterialId,
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost) || 0,
        })),
      });
    },
    [productId, validItems, onSubmit]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 md:p-4 bg-black/40"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-bom-title"
        className={cn(
          "w-full max-w-lg rounded-xl md:rounded-2xl",
          "bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border-default))]",
          "shadow-2xl shadow-black/20 max-h-[90vh] overflow-y-auto"
        )}
      >
        <div className="flex items-center justify-between px-4 md:px-5 py-3 md:py-4 border-b border-[hsl(var(--border-default))]">
          <h2 id="create-bom-title" className="text-sm md:text-base font-semibold text-[hsl(var(--fg-primary))]">
            {t("manufacturing.boms.dialogTitle", "فرمول ساخت جدید")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[hsl(var(--fg-tertiary))] hover:bg-[hsl(var(--surface-muted))] hover:text-[hsl(var(--fg-primary))] transition-colors"
            aria-label={t("action.close", "بستن")}
          >
            <X className="size-4 md:size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 md:p-5 space-y-3 md:space-y-4">
          <div className="space-y-1 md:space-y-1.5">
            <label htmlFor="bom-product" className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]">
              {t("manufacturing.boms.selectProduct", "انتخاب محصول")}
            </label>
            <select
              id="bom-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full h-9 md:h-10 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-3 text-xs md:text-sm text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
            >
              <option value="">{t("manufacturing.boms.selectProductPlaceholder", "-- انتخاب محصول --")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm font-medium text-[hsl(var(--fg-secondary))]">
                {t("manufacturing.boms.items", "اقلام مواد اولیه")}
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] md:text-xs font-medium text-[hsl(var(--color-primary))] hover:bg-[hsl(var(--color-primary)/0.08)] transition-colors"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t("manufacturing.boms.addItem", "افزودن قلم")}
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-1.5 md:gap-2">
                  <select
                    value={item.rawMaterialId}
                    onChange={(e) => handleItemChange(item.key, "rawMaterialId", e.target.value)}
                    className="flex-1 min-w-0 h-9 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-2 text-xs text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  >
                    <option value="">{t("manufacturing.boms.rawMaterial", "ماده اولیه")}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.key, "quantity", e.target.value)}
                    placeholder={t("manufacturing.boms.quantity", "مقدار")}
                    className="w-16 md:w-20 h-9 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-2 text-xs text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={item.unitCost}
                    onChange={(e) => handleItemChange(item.key, "unitCost", e.target.value)}
                    placeholder={t("manufacturing.boms.unitCost", "بهای واحد")}
                    className="w-20 md:w-24 h-9 rounded-lg border border-[hsl(var(--border-default))] bg-transparent px-2 text-xs text-[hsl(var(--fg-primary))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--color-primary))]"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.key)}
                    disabled={items.length <= 1}
                    className="shrink-0 p-1.5 rounded-lg text-[hsl(var(--color-destructive))] hover:bg-[hsl(var(--color-destructive)/0.08)] disabled:opacity-30 transition-colors"
                    aria-label={t("action.delete", "حذف")}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium border border-[hsl(var(--border-default))] text-[hsl(var(--fg-secondary))] hover:bg-[hsl(var(--surface-muted))] transition-colors"
            >
              {t("action.cancel", "انصراف")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex-1 h-9 md:h-10 rounded-lg text-xs md:text-sm font-medium bg-[hsl(var(--color-primary))] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="size-3.5 md:size-4 animate-spin" aria-hidden="true" />}
              {t("action.create", "ایجاد")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
