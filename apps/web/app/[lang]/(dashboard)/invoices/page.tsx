import { InvoicesContainer, InvoicesSkeleton } from "@hisabche/ui";
import { Suspense } from "react";

const titles: Record<string, string> = {
  "fa": "فاکتورها",
  "af": "فاکتورها",
  "en": "Invoices",
};

const descriptions: Record<string, string> = {
  "fa": "مدیریت فاکتورها، فروش، پرداخت‌ها و بدهی مشتریان در حسابچه. صدور فاکتور آنلاین و آفلاین.",
  "af": "مدیریت فاکتورها، فروشات، پرداخت‌ها و قرض مشتریان در حسابچه. صدور فاکتور آنلاین و آفلاین.",
  "en": "Manage invoices, sales, payments and customer debts in Hisabche. Online and offline invoicing.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "فاکتور",
    "صدور فاکتور",
    "فاکتور فروش",
    "مدیریت فاکتور",
    "پرداخت",
    "بدهی مشتری",
    "فاکتور آنلاین",
    "فاکتور آفلاین",
    "حسابچه",
    "صورتحساب",
  ],
  "af": [
    "فاکتور",
    "صدور فاکتور",
    "فاکتور فروش",
    "مدیریت فاکتور",
    "پرداخت",
    "قرض مشتری",
    "فاکتور آنلاین",
    "فاکتور آفلاین",
    "حسابچه",
    "صورتحساب",
  ],
  "en": [
    "invoice",
    "create invoice",
    "sales invoice",
    "invoice management",
    "payment",
    "customer debt",
    "online invoice",
    "offline invoice",
    "hisabche",
    "bill",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    description: descriptions[lang] || descriptions["fa"],
    keywords: keywords[lang] || keywords["fa"],
    robots: { index: false, follow: false },
  };
}

export default function InvoicesPage() {
  return (
    <main className="section">
      <Suspense fallback={<InvoicesSkeleton />}>
        <InvoicesContainer />
      </Suspense>
    </main>
  );
}