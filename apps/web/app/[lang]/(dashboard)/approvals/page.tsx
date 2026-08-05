import { ApprovalsContainer } from "@hisabche/ui";
import { Suspense } from "react";

const titles: Record<string, string> = {
  "fa": "در انتظار تأیید شما",
  "af": "در انتظار تأیید شما",
  "en": "Awaiting Your Approval",
};

const descriptions: Record<string, string> = {
  "fa": "درخواست‌های تأیید، بودجه‌های شرکت و عملیات‌های تکرارپذیر سیستم مدیریت برای تأیید لازم از سوی مدیریت.",
  "af": "درخواست‌های تأیید، بودجه‌های شرکت و عملیات‌های تکرارپذیر سیستم مدیریت برای تأیید لازم از سوی مدیریت.",
  "en": "Approval requests, company budgets and workflow actions of management system for approval by management.",
};

const keywords: Record<string, string[]> = {
  "fa": [
    "تأیید", "درخواست", "فرآیند تأیید", "workflow", "مدیریت",
    "تاییدنامه", "دایره کار", "درخواست‌های شرکت", "پرداخت بودجه"
  ],
  "af": [
    "تأیید", "درخواست", "فرآیند تأیید", "workflow", "مدیریت",
    "تاییدنامه", "دایره کار", "درخواست‌های شرکت", "پرداخت بودجه"
  ],
  "en": [
    "approval", "request", "approval workflow", "workflow", "management",
    "approval process", "workflow", "company requests", "budget approval"
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

export default function ApprovalsPage() {
  return (
    <main className="section">
      <Suspense fallback={<div>در حال بارگذاری...</div>}>
        <ApprovalsContainer />
      </Suspense>
    </main>
  );
}