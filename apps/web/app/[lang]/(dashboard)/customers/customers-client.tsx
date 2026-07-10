"use client"

import dynamic from "next/dynamic"
import { customersSkeleton } from "@hisabche/ui"

const CustomersPage = dynamic(
  () => import("@hisabche/ui").then((m) => m.customersPage),
  {
    loading: () => customersSkeleton(),
    ssr: false,
  }
)

// ✅ تغییر نام به PascalCase
export function CustomersClient() {
  return <CustomersPage />
}