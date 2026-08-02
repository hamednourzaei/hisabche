import DashboardLayout from "./dashboard-layout";

const descriptions: Record<string, string> = {
  "fa": "سیستم مدیریت فروش، انبار و حسابداری آنلاین برای کسب‌وکارهای کوچک و متوسط",
  "af": "سیستم مدیریت فروش، گدام و حسابداری آنلاین برای تجارت‌های کوچک و متوسط",
  "en": "Online sales, inventory and accounting management system for small and medium businesses",
};

const keywords: Record<string, string[]> = {
  "fa": ["داشبورد", "مدیریت", "فروش", "انبار", "حسابداری", "کسب‌وکار", "حسابچه"],
  "af": ["داشبورد", "مدیریت", "فروش", "گدام", "حسابداری", "تجارت", "حسابچه"],
  "en": ["dashboard", "management", "sales", "inventory", "accounting", "business", "hisabche"],
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return {
    title: {
      default: lang === "en" ? "Dashboard" : lang === "af" ? "داشبورد" : "داشبورد",
      template: lang === "en" ? "%s | Hisabche" : "%s | حسابچه",
    },
    description: descriptions[lang] || descriptions["fa"],
    keywords: keywords[lang] || keywords["fa"],
  };
}


export default async function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}