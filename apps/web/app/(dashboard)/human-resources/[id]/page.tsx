// apps/web/app/(dashboard)/hr/[id]/page.tsx
import { Metadata } from "next";
import { EmployeeDetailContainer } from "@hisabche/ui";

export const metadata: Metadata = {
  title: "جزئیات کارمند",
};

export default function EmployeeDetailPage({ params }: { params: { id: string } }) {
  return <EmployeeDetailContainer id={params.id} />;
}