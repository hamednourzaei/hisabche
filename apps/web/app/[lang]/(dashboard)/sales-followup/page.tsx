import { SalesFollowupContainer } from "@hisabche/ui";
import { Suspense } from "react";

const titles: Record<string, string> = {
  "fa": "پیگیری فروش",
  "af": "پیگیری فروش",
  "en": "Sales Follow-up",
};

const descriptions: Record<string, string> = {
  "fa": "مدیریت پیگیری فروش، ارتباط با مشتریان، فرصت‌های فروش و مراحل بازاریابی در حسابچه.",
  "af": "مدیریت پیگیری فروش، ارتباط با مشتریان، فرصت‌های فروش و مراحل بازاریابی در حسابچه.",
  "en": "Manage sales follow-ups, customer relationships, sales opportunities and lead nurturing in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "پیگیری فروش",
    "ارتباط با مشتریان",
    "فرصت‌های فروش",
    "بازاریابی",
    "پیگیری سرنخ‌های فروش",
    "مدیریت سرنخ‌ها",
    "فروش آنلاین",
    "حسابچه",
    "پیگیری مشتریان",
    "ارتباط مشتری",
  ],
  "af": [
    "پیگیری فروش",
    "ارتباط با مشتریان",
    "فرصت‌های فروش",
    "بازاریابی",
    "پیگیری سرنخ‌های فروش",
    "مدیریت سرنخ‌ها",
    "فروش آنلاین",
    "حسابچه",
    "پیگیری مشتریان",
    "ارتباط مشتری",
  ],
  "en": [
    "sales follow-up",
    "customer relationship",
    "sales opportunities",
    "lead nurturing",
    "sales lead tracking",
    "lead management",
    "online sales",
    "hisabche",
    "customer tracking",
    "customer engagement",
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

export default function SalesFollowupPage() {
  return (
    <main className="section">
      <Suspense fallback={<div>در حال بارگذاری...</div>}>
        <SalesFollowupContainer />
      </Suspense>
    </main>
  );
}