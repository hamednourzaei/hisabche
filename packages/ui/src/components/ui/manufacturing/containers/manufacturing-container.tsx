// packages/ui/src/components/ui/manufacturing/containers/manufacturing-container.tsx
"use client";

import { useState, useCallback, useMemo, memo } from "react";
import { useTranslations } from "next-intl";
import {
  useBOMs,
  useWorkOrders,
  useCompleteWorkOrder,
  useCreateBOM,
  useCreateWorkOrder,
  useProducts,
} from "@hisabche/api";
import { ManufacturingView, type ManufacturingTabId } from "../manufacturing-view";
import { CreateBomDialog, type CreateBomInput } from "../components/CreateBomDialog";
import { CreateWorkOrderDialog, type CreateWorkOrderInput } from "../components/CreateWorkOrderDialog";

/* ═══════════════════════════════════════════════════════════════════════════
   ManufacturingContainer — Memoized · Performance Optimized
   ✅ memo · useCallback · safeT wrapper
   ═══════════════════════════════════════════════════════════════════════════ */

export const ManufacturingContainer = memo(function ManufacturingContainer() {
  const t = useTranslations();



  const [activeTab, setActiveTab] = useState<ManufacturingTabId>("boms");
  const [isBomDialogOpen, setIsBomDialogOpen] = useState(false);
  const [isWorkOrderDialogOpen, setIsWorkOrderDialogOpen] = useState(false);

  const { data: boms, isLoading: isBomsLoading, error: bomsError } = useBOMs();
  const {
    data: workOrders,
    isLoading: isWorkOrdersLoading,
    error: workOrdersError,
  } = useWorkOrders();

  const { data: productsData } = useProducts({ limit: 200, isActive: true });

  const { mutate: completeWorkOrder, isPending, variables: completingId } = useCompleteWorkOrder();
  const { mutate: createBom, isPending: isCreatingBom } = useCreateBOM();
  const { mutate: createWorkOrder, isPending: isCreatingWorkOrder } = useCreateWorkOrder();

  const isLoading = activeTab === "boms" ? isBomsLoading : isWorkOrdersLoading;
  const error = activeTab === "boms" ? bomsError : workOrdersError;

  const productOptions = useMemo(
    () =>
      (productsData?.products ?? [])
        .filter((p): p is typeof p & { id: string } => !!p.id)
        .map((p) => ({ id: p.id, name: p.name, unit: p.unit })),
    [productsData]
  );

  const bomOptions = useMemo(
    () => (boms ?? []).map((b) => ({ id: b.id, productId: b.productId, version: b.version })),
    [boms]
  );

  const handleTabChange = useCallback((tab: ManufacturingTabId) => setActiveTab(tab), []);

  const handleCompleteWorkOrder = useCallback(
    (id: string) => completeWorkOrder(id),
    [completeWorkOrder]
  );

  const handleOpenCreateBom = useCallback(() => setIsBomDialogOpen(true), []);
  const handleCloseCreateBom = useCallback(() => setIsBomDialogOpen(false), []);
  const handleOpenCreateWorkOrder = useCallback(() => setIsWorkOrderDialogOpen(true), []);
  const handleCloseCreateWorkOrder = useCallback(() => setIsWorkOrderDialogOpen(false), []);

  const handleSubmitBom = useCallback(
    (input: CreateBomInput) => {
      createBom(input, {
        onSuccess: () => setIsBomDialogOpen(false),
      });
    },
    [createBom]
  );

  const handleSubmitWorkOrder = useCallback(
    (input: CreateWorkOrderInput) => {
      createWorkOrder(input, {
        onSuccess: () => setIsWorkOrderDialogOpen(false),
      });
    },
    [createWorkOrder]
  );

  return (
    <>
      <ManufacturingView
        t={t}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        boms={boms ?? []}
        workOrders={workOrders ?? []}
        isLoading={isLoading}
        error={error?.message || null}
        completingId={isPending ? completingId ?? null : null}
        onCompleteWorkOrder={handleCompleteWorkOrder}
        onOpenCreateBom={handleOpenCreateBom}
        onOpenCreateWorkOrder={handleOpenCreateWorkOrder}
      />

      <CreateBomDialog
        t={t}
        isOpen={isBomDialogOpen}
        onClose={handleCloseCreateBom}
        onSubmit={handleSubmitBom}
        isSubmitting={isCreatingBom}
        products={productOptions}
      />

      <CreateWorkOrderDialog
        t={t}
        isOpen={isWorkOrderDialogOpen}
        onClose={handleCloseCreateWorkOrder}
        onSubmit={handleSubmitWorkOrder}
        isSubmitting={isCreatingWorkOrder}
        products={productOptions}
        boms={bomOptions}
      />
    </>
  );
});

ManufacturingContainer.displayName = "ManufacturingContainer";
