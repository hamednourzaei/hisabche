// apps/web/app/(dashboard)/audit/page.tsx
import { Metadata } from "next";
import { AuditContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "حسابرسی",
};

export default function AuditPage() {
  return <AuditContainer />;
}