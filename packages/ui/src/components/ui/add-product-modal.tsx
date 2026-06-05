"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "react-i18next"
import { DollarSign, Package, AlertTriangle } from "lucide-react"
import { useCreateProduct } from "@hisabche/api"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"
import { SaveIndicator } from "./save-indicator"
import { useSyncStore, useBackupStore } from "@hisabche/store"

// Product form validation schema
const productSchema = z.object({
  name: z.string().min(1, "product.nameRequired"),
  quantity: z.number().min(0).default(0),
  buyPrice: z.number().min(0).default(0),
  sellPrice: z.number().min(0).default(0),
  unit: z.enum(["piece", "kg", "liter", "meter", "box"]).default("piece"),
  minStock: z.number().min(0).default(5),
})

type ProductFormValues = z.infer<typeof productSchema>

interface AddProductModalProps {
  open: boolean
  onClose: () => void
  onCreated?: () => void
}

const UNIT_OPTIONS = [
  { value: "piece", labelKey: "godam.units.piece", fallback: "عدد" },
  { value: "kg", labelKey: "godam.units.kg", fallback: "کیلوگرم" },
  { value: "liter", labelKey: "godam.units.liter", fallback: "لیتر" },
  { value: "meter", labelKey: "godam.units.meter", fallback: "متر" },
  { value: "box", labelKey: "godam.units.box", fallback: "کارتن" },
] as const

export function AddProductModal({ open, onClose, onCreated }: AddProductModalProps) {
  const { t } = useTranslation()
  const createProduct = useCreateProduct()
  const { setSaveStatus } = useSyncStore()
  const { addAuditEntry } = useBackupStore()

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      quantity: 0,
      buyPrice: 0,
      sellPrice: 0,
      unit: "piece" as const,
      minStock: 5,
    },
  })

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting, errors } } = form

  const onSubmit = async (data: ProductFormValues) => {
    setSaveStatus("saving")

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
      })

      addAuditEntry({
        action: "create",
        entity: "product",
        entityId: product.id || "",
        details: `محصول جدید: ${data.name.trim()}`,
      })

      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)

      reset()
      onCreated?.()
      onClose()
    } catch (error) {
      setSaveStatus("idle")
      console.error("Failed to create product:", error)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const getErrorMessage = (error: any) => {
    if (error?.message) return t(error.message)
    if (error?.type === "min") return t("validation.min", "مقدار وارد شده معتبر نیست")
    return undefined
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <SaveIndicator show={isSubmitting} message={t("common.saving", "در حال ذخیره...")} />

        <DialogHeader>
          <DialogTitle>{t("godam.addProductModal", "محصول جدید")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Input
              {...register("name")}
              placeholder={`${t("godam.productName")} *`}
              leftIcon={<Package className="size-4" />}
              autoFocus
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">
                {t(errors.name.message as string || "نام محصول الزامی است")}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                {...register("quantity", { valueAsNumber: true })}
                type="number"
                placeholder={t("godam.initialStock", "موجودی اولیه")}
              />
              {errors.quantity && (
                <p className="mt-1 text-sm text-destructive">
                  {getErrorMessage(errors.quantity)}
                </p>
              )}
            </div>
            <div>
              <Label className="mb-2 block">{t("godam.unit")}</Label>
              <Select
                defaultValue="piece"
                onValueChange={(val) => setValue("unit", val as any)}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder={t("godam.unit")} />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey, opt.fallback)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                {...register("buyPrice", { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder={t("godam.buyPrice", "قیمت خرید (AFN)")}
                leftIcon={<DollarSign className="size-4" />}
              />
              {errors.buyPrice && (
                <p className="mt-1 text-sm text-destructive">
                  {getErrorMessage(errors.buyPrice)}
                </p>
              )}
            </div>
            <div>
              <Input
                {...register("sellPrice", { valueAsNumber: true })}
                type="number"
                step="0.01"
                placeholder={t("godam.sellPrice", "قیمت فروش (AFN)")}
                leftIcon={<DollarSign className="size-4" />}
              />
              {errors.sellPrice && (
                <p className="mt-1 text-sm text-destructive">
                  {getErrorMessage(errors.sellPrice)}
                </p>
              )}
            </div>
          </div>

          <div>
            <Input
              {...register("minStock", { valueAsNumber: true })}
              type="number"
              placeholder={t("godam.minStock", "حداقل موجودی هشدار")}
              leftIcon={<AlertTriangle className="size-4" />}
            />
            {errors.minStock && (
              <p className="mt-1 text-sm text-destructive">
                {getErrorMessage(errors.minStock)}
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="w-full" onClick={handleClose}>
              {t("action.cancel")}
            </Button>
            <Button type="submit" className="w-full" loading={isSubmitting || createProduct.isPending}>
              {t("action.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}