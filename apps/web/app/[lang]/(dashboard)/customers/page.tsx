import { CustomersClient } from "./customers-client";
const titles: Record<string, string> = { "fa-IR": "مشتریان", "fa-AF": "مشتریان", "en": "Customers" };
const descriptions: Record<string, string> = { "fa-IR": "مدیریت حساب مشتریان و بدهی‌ها", "fa-AF": "مدیریت حساب مشتریان و قرض‌ها", "en": "Manage customer accounts and debts" };
const keywords: Record<string, string[]> = { "fa-IR": ["مشتریان", "بدهی", "طلب", "حساب"], "fa-AF": ["مشتریان", "قرض", "طلب", "حساب"], "en": ["customers", "debt", "credit", "accounts"] };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: titles[lang] || titles["fa-IR"], description: descriptions[lang] || descriptions["fa-IR"], keywords: keywords[lang] || keywords["fa-IR"], robots: { index: false, follow: false } };
}
export default function Page() { return <main className="section"><CustomersClient /></main>; }