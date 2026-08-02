// apps/web/app/[lang]/public-invoice/[token]/page.tsx
// Public, unauthenticated, read-only invoice view — reached via the QR
// code / share link on invoice-document.tsx. Intentionally outside the
// (dashboard) route group so it never hits the auth-gated layout.

import { PublicInvoiceContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "مشاهده فاکتور",
  "af": "مشاهده فاکتور",
  en: "View Invoice",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return {
    title: titles[lang] || titles["fa"],
    robots: { index: false, follow: false },
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="section py-10">
      <PublicInvoiceContainer token={token} />
    </main>
  );
}
