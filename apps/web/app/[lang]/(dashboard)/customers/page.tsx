import { CustomersClient } from "./customers-client";
const titles: Record<string, string> = { "fa": "مشتریان", "af": "مشتریان", "en": "Customers" };
const descriptions: Record<string, string> = { "fa": "مدیریت حساب مشتریان و بدهی‌ها", "af": "مدیریت حساب مشتریان و قرض‌ها", "en": "Manage customer accounts and debts" };
const keywords: Record<string, string[]> = { "fa": ["مشتریان", "بدهی", "طلب", "حساب"], "af": ["مشتریان", "قرض", "طلب", "حساب"], "en": ["customers", "debt", "credit", "accounts"] };

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  return { title: titles[lang] || titles["fa"], description: descriptions[lang] || descriptions["fa"], keywords: keywords[lang] || keywords["fa"], robots: { index: false, follow: false } };
}
export default function Page() { return <main className="section"><CustomersClient /></main>; }