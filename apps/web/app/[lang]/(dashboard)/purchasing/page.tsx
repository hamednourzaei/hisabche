// apps/web/app/[lang]/(dashboard)/purchasing/page.tsx
import { PurchasingContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "خرید",
  "af": "خرید",
  "en": "Purchasing",
};

const keywords: Record<string, string[]> = {
  "fa": ["خرید", "سفارش خرید", "تأمین‌کننده"],
  "af": ["خرید", "سفارش خرید", "تأمین‌کننده"],
  "en": ["purchasing", "purchase orders", "suppliers"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function PurchasingPage() {
  return <PurchasingContainer />;
}
