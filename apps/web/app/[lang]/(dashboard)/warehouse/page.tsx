// apps/web/app/[lang]/(dashboard)/warehouse/page.tsx
import { WarehouseClient } from "./warehouse-client";

const titles: Record<string, string> = { "fa-IR": "انبار", "fa-AF": "گدام", "en": "Warehouse" };
const descriptions: Record<string, string> = { "fa-IR": "مدیریت انبار و موجودی", "fa-AF": "مدیریت گدام و موجودی", "en": "Warehouse & inventory management" };
const keywords: Record<string, string[]> = { "fa-IR": ["انبار", "موجودی", "کالا"], "fa-AF": ["گدام", "موجودی", "جنس"], "en": ["warehouse", "inventory", "stock"] };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: titles[lang] || titles["fa-IR"], description: descriptions[lang] || descriptions["fa-IR"], keywords: keywords[lang] || keywords["fa-IR"] };
}

export default function WarehousePage() {
  return <WarehouseClient />;
}