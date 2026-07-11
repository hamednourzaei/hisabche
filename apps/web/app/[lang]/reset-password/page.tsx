// apps/web/app/[lang]/reset-password/page.tsx
import { ResetPasswordClient } from "./ResetPasswordClient";

const titles: Record<string, string> = {
  "fa-IR": "بازنشانی رمز عبور",
  "fa-AF": "بازنشانی پسورد",
  "en": "Reset Password",
};

const descriptions: Record<string, string> = {
  "fa-IR": "رمز عبور جدید خود را وارد کنید",
  "fa-AF": "پسورد جدید خود را وارد کنید",
  "en": "Enter your new password",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["بازنشانی رمز عبور", "رمز جدید", "حسابچه"],
  "fa-AF": ["بازنشانی پسورد", "پسورد جدید", "حسابچه"],
  "en": ["reset password", "new password", "hisabche"],
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

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}