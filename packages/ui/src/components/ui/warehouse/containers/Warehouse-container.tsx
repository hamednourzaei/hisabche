// packages/ui/src/components/ui/warehouse/containers/Warehouse-container.tsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useWarehouse } from "../../../../hooks/warehouse/use-warehouse";
import { WarehouseView } from "../warehouse-view";
import { AddProductModal } from "../../add-product-modal";
import { fmt } from "../../../../lib/warehouse/warehouse-format";

const CURRENCIES = [
  { code: "AFN", label: "افغانی", rate: 1 },
  { code: "USD", label: "دالر", rate: 0.014 },
  { code: "IRR", label: "پومان", rate: 0.85 },
];

export function warehouseContainer() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    products,
    total,
    totalValue,
    lowStock,
    outOfStock,
    isLoading,
    stockStatus,
    stockLabel,
    handleDelete,
  } = useWarehouse(search);

  const onDelete = useCallback(
    async (product: { id: string; name?: string }) => {
      setDeletingId(product.id);
      await handleDelete(product);
      setDeletingId(null);
    },
    [handleDelete]
  );

  const safeT = useMemo(
    () => (key: string, fallback?: string) => {
      const v = t(key);
      return v !== key ? v : (fallback ?? key);
    },
    [t]
  );

  const handleNavigate = useCallback(
    (id: string) => router.push(`/warehouse/${id}`),
    [router]
  );

  const handleOpenAddModal = useCallback(() => setShowAddModal(true), []);
  const handleCloseAddModal = useCallback(() => setShowAddModal(false), []);

  const viewProps = {
    t: safeT,
    fmt,
    search,
    onSearchChange: setSearch,
    onOpenAddModal: handleOpenAddModal,
    deletingId,
    products,
    total,
    isLoading,
    totalValue,
    lowStock,
    outOfStock,
    currencies: CURRENCIES,
    onNavigate: handleNavigate,
    onDelete,
    stockStatus,
    stockLabel,
  };

  return (
    <>
      <AddProductModal
        open={showAddModal}
        onClose={handleCloseAddModal}
        onCreated={() => {}}
      />
      <WarehouseView {...viewProps} />
    </>
  );
}