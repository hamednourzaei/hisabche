// apps/web/app/[lang]/(dashboard)/purchasing/page.tsx
import { PurchasingContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "خرید",
  "fa-AF": "خرید",
  "en": "Purchasing",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["خرید", "سفارش خرید", "تأمین‌کننده"],
  "fa-AF": ["خرید", "سفارش خرید", "تأمین‌کننده"],
  "en": ["purchasing", "purchase orders", "suppliers"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function PurchasingPage() {
  return <PurchasingContainer />;
}
