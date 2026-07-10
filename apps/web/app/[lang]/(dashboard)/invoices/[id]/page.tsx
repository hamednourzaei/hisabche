import { InvoiceDetailContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "جزئیات فاکتور",
  "fa-AF": "جزئیات فاکتور",
  "en": "Invoice Details",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مشاهده، ویرایش، چاپ و دانلود فاکتور در حسابچه. مدیریت اقلام، پرداخت‌ها و وضعیت فاکتور.",
  "fa-AF": "مشاهده، ویرایش، چاپ و دانلود فاکتور در حسابچه. مدیریت اقلام، پرداخت‌ها و وضعیت فاکتور.",
  "en": "View, edit, print and download invoice in Hisabche. Manage items, payments and invoice status.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "جزئیات فاکتور",
    "ویرایش فاکتور",
    "چاپ فاکتور",
    "دانلود PDF",
    "اقلام فاکتور",
    "پرداخت فاکتور",
    "وضعیت فاکتور",
    "حسابچه",
    "مشاهده فاکتور",
    "فاکتور فروش",
  ],
  "fa-AF": [
    "جزئیات فاکتور",
    "ویرایش فاکتور",
    "چاپ فاکتور",
    "دانلود PDF",
    "اقلام فاکتور",
    "پرداخت فاکتور",
    "وضعیت فاکتور",
    "حسابچه",
    "مشاهده فاکتور",
    "فاکتور فروش",
  ],
  "en": [
    "invoice details",
    "edit invoice",
    "print invoice",
    "download PDF",
    "invoice items",
    "invoice payment",
    "invoice status",
    "hisabche",
    "view invoice",
    "sales invoice",
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
      <InvoiceDetailContainer />
    </main>
  );
}