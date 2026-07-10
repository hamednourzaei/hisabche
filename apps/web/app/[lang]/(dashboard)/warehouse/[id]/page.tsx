import { ProductDetailContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa-IR": "جزئیات محصول",
  "fa-AF": "جزئیات جنس",
  "en": "Product Details",
};

const descriptions: Record<string, string> = {
  "fa-IR": "مشاهده و ویرایش جزئیات محصول، موجودی، قیمت و اطلاعات کالا در حسابچه.",
  "fa-AF": "مشاهده و ویرایش جزئیات جنس، موجودی، قیمت و اطلاعات کالا در حسابچه.",
  "en": "View and edit product details, stock, price and item information in Hisabche.",
};

const keywords: Record<string, string[]> = {
  "fa-IR": [
    "جزئیات محصول",
    "ویرایش کالا",
    "قیمت محصول",
    "موجودی کالا",
    "اطلاعات محصول",
    "مدیریت کالا",
    "بارکد",
    "حسابچه",
    "انبارداری",
    "SKU",
  ],
  "fa-AF": [
    "جزئیات جنس",
    "ویرایش جنس",
    "قیمت جنس",
    "موجودی جنس",
    "اطلاعات جنس",
    "مدیریت جنس",
    "بارکد",
    "حسابچه",
    "گدامداری",
    "SKU",
  ],
  "en": [
    "product details",
    "edit item",
    "product price",
    "product stock",
    "product info",
    "item management",
    "barcode",
    "hisabche",
    "inventory",
    "SKU",
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
      <ProductDetailContainer />
    </main>
  );
}