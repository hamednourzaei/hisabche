// apps/web/app/(dashboard)/permissions/page.tsx
import { Metadata } from "next";
import { PermissionsContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "نقش‌ها و دسترسی‌ها",
};

export default function PermissionsPage() {
  return <PermissionsContainer />;
}