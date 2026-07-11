// apps/web/app/[lang]/forgot-password/page.tsx
import { ForgotPasswordClient } from "./ForgotPasswordClient";

const titles: Record<string, string> = {
  "fa-IR": "فراموشی رمز عبور",
  "fa-AF": "فراموشی پسورد",
  "en": "Forgot Password",
};

const descriptions: Record<string, string> = {
  "fa-IR": "ایمیل خود را وارد کنید تا لینک بازنشانی رمز عبور برای شما ارسال شود",
  "fa-AF": "ایمیل خود را وارد کنید تا لینک بازنشانی پسورد برای شما ارسال شود",
  "en": "Enter your email to receive a password reset link",
};

const keywords: Record<string, string[]> = {
  "fa-IR": ["فراموشی رمز عبور", "بازنشانی رمز", "ایمیل بازیابی", "حسابچه"],
  "fa-AF": ["فراموشی پسورد", "بازنشانی پسورد", "ایمیل بازیابی", "حسابچه"],
  "en": ["forgot password", "reset password", "recovery email", "hisabche"],
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

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}