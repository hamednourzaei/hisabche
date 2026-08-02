// apps/web/app/[lang]/(dashboard)/billing/page.tsx
import { BillingContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "پلن و اشتراک",
  "af": "پلن و اشتراک",
  "en": "Plan & Billing",
};

const keywords: Record<string, string[]> = {
  "fa": ["پلن", "اشتراک", "صورت‌حساب اشتراک", "ارتقا"],
  "af": ["پلن", "اشتراک", "صورت‌حساب اشتراک", "ارتقا"],
  "en": ["plan", "subscription", "billing", "upgrade"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}

export default function BillingPage() {
  return <BillingContainer />;
}
