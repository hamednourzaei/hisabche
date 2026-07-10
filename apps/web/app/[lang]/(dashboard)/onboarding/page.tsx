// apps/web/app/[lang]/(dashboard)/onboarding/page.tsx
import { OnboardingContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "راه‌اندازی",
  "fa-AF": "راه‌اندازی",
  "en": "Onboarding",
};

const descriptions: Record<string, string> = {
  "fa-IR": "راه‌اندازی سریع حسابچه برای کسب‌وکار شما. تنظیم نام تجاری، ارز، انبار و اطلاعات اولیه در چند دقیقه.",
  "fa-AF": "راه‌اندازی سریع حسابچه برای تجارت شما. تنظیم نام تجاری، ارز، گدام و اطلاعات اولیه در چند دقیقه.",
  "en": "Quick Hisabche setup for your business. Set up business name, currency, warehouse and basic info in minutes.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "راه‌اندازی",
    "شروع کار",
    "تنظیمات اولیه",
    "ایجاد حساب",
    "کسب‌وکار جدید",
    "ثبت‌نام",
    "پیکربندی",
    "حسابچه",
    "شروع سریع",
    "تنظیم فروشگاه",
  ],
  "fa-AF": [
    "راه‌اندازی",
    "شروع کار",
    "تنظیمات اولیه",
    "ایجاد حساب",
    "تجارت جدید",
    "ثبت‌نام",
    "پیکربندی",
    "حسابچه",
    "شروع سریع",
    "تنظیم دوکان",
  ],
  "en": [
    "onboarding",
    "get started",
    "initial setup",
    "create account",
    "new business",
    "signup",
    "configuration",
    "hisabche",
    "quick start",
    "store setup",
  ],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa-IR"],
    description: descriptions[lang] || descriptions["fa-IR"],
    keywords: keywords[lang] || keywords["fa-IR"],
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return (
    <main className="section">
      <OnboardingContainer />
    </main>
  );
}