// apps/web/app/[lang]/(dashboard)/warehouse/page.tsx
"use client";

import { warehouseContainer, warehouseSkeleton } from "@hisabche/ui";
import { Suspense } from "react";

const titles: Record<string, string> = {
  "fa-IR": "انبار",
  "fa-AF": "گدام",
  "en": "Warehouse",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مدیریت انبار، موجودی کالا، ورود و خروج محصولات با حسابچه. کنترل کامل انبارداری آنلاین و آفلاین.",
  "fa-AF": "مدیریت گدام، موجودی جنس، ورود و خروج محصولات با حسابچه. کنترل کامل گدامداری آنلاین و آفلاین.",
  "en": "Inventory management, stock control, product tracking with Hisabche. Complete warehouse management online and offline.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "انبارداری",
    "مدیریت انبار",
    "موجودی کالا",
    "کنترل موجودی",
    "ورود و خروج کالا",
    "مدیریت محصولات",
    "انبار آنلاین",
    "نرم‌افزار انبار",
    "حسابچه",
    "موجودی لحظه‌ای",
  ],
  "fa-AF": [
    "گدامداری",
    "مدیریت گدام",
    "موجودی جنس",
    "کنترل موجودی",
    "ورود و خروج جنس",
    "مدیریت محصولات",
    "گدام آنلاین",
    "نرم‌افزار گدام",
    "حسابچه",
    "موجودی لحظه‌ای",
  ],
  "en": [
    "warehouse management",
    "inventory management",
    "stock control",
    "product tracking",
    "stock in out",
    "product management",
    "online warehouse",
    "warehouse software",
    "hisabche",
    "real-time inventory",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function WarehousePage() {
  return (
    <Suspense fallback={warehouseSkeleton()}>
      {warehouseContainer()}
    </Suspense>
  );
}