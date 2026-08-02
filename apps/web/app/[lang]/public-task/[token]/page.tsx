// apps/web/app/[lang]/public-task/[token]/page.tsx
// Public, unauthenticated task view — reached via the link the owner
// shares with an employee who has no site account. Intentionally
// outside the (dashboard) route group so it never hits the auth-gated
// layout. Modeled on public-invoice/[token]/page.tsx.

import { PublicTaskContainer } from "@hisabche/ui";

const titles: Record<string, string> = {
  "fa": "مشاهده وظیفه",
  "af": "مشاهده وظیفه",
  en: "View Task",
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
      <PublicTaskContainer token={token} />
    </main>
  );
}
