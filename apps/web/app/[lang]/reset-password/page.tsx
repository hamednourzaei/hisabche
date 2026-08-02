// apps/web/app/[lang]/reset-password/page.tsx
import { ResetPasswordClient } from "./ResetPasswordClient";

const titles: Record<string, string> = {
  "fa": "بازنشانی رمز عبور",
  "af": "بازنشانی پسورد",
  "en": "Reset Password",
};

const descriptions: Record<string, string> = {
  "fa": "رمز عبور جدید خود را وارد کنید",
  "af": "پسورد جدید خود را وارد کنید",
  "en": "Enter your new password",
};

const keywords: Record<string, string[]> = {
  "fa": ["بازنشانی رمز عبور", "رمز جدید", "حسابچه"],
  "af": ["بازنشانی پسورد", "پسورد جدید", "حسابچه"],
  "en": ["reset password", "new password", "hisabche"],
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

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}