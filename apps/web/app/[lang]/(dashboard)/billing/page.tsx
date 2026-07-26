// apps/web/app/[lang]/(dashboard)/billing/page.tsx
import { BillingContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "پلن و اشتراک",
  "fa-AF": "پلن و اشتراک",
  "en": "Plan & Billing",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["پلن", "اشتراک", "صورت‌حساب اشتراک", "ارتقا"],
  "fa-AF": ["پلن", "اشتراک", "صورت‌حساب اشتراک", "ارتقا"],
  "en": ["plan", "subscription", "billing", "upgrade"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
  };
}

export default function BillingPage() {
  return <BillingContainer />;
}
