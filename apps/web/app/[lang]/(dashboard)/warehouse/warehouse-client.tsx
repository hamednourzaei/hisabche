// apps/web/app/[lang]/(dashboard)/warehouse/warehouse-client.tsx
"use client";

import { warehouseContainer, warehouseSkeleton } from "@hisabche/ui";
import { Suspense } from "react";

export function WarehouseClient() {
  return (
    <Suspense fallback={warehouseSkeleton()}>
      {warehouseContainer()}
    </Suspense>
  );
}