import { SyncCenterContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "مرکز همگام‌سازی",
  "fa-AF": "مرکز همگام‌سازی",
  "en": "Sync Center",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مدیریت همگام‌سازی آفلاین، صف عملیات و وضعیت اتصال در حسابچه. داده‌های شما همیشه به‌روز و امن.",
  "fa-AF": "مدیریت همگام‌سازی آفلاین، صف عملیات و وضعیت اتصال در حسابچه. داده‌های شما همیشه به‌روز و امن.",
  "en": "Manage offline sync, operation queue and connection status in Hisabche. Your data always up-to-date and secure.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "همگام‌سازی",
    "همگام‌سازی آفلاین",
    "صف عملیات",
    "اتصال اینترنت",
    "آفلاین",
    "سنک",
    "ذخیره ابری",
    "بکاپ",
    "حسابچه",
    "داده امن",
  ],
  "fa-AF": [
    "همگام‌سازی",
    "همگام‌سازی آفلاین",
    "صف عملیات",
    "اتصال انترنت",
    "آفلاین",
    "سنک",
    "ذخیره ابری",
    "بکاپ",
    "حسابچه",
    "داده امن",
  ],
  "en": [
    "sync",
    "offline sync",
    "operation queue",
    "internet connection",
    "offline",
    "sync center",
    "cloud storage",
    "backup",
    "hisabche",
    "secure data",
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
      <SyncCenterContainer />
    </main>
  );
}