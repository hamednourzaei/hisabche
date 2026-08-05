// apps/web/proxy.ts
import createMiddleware from 'next-intl/middleware';
import type { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './app/[lang]/i18n-config';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  // ✅ همه‌ی زبان‌ها پیشوند می‌گیرند (fa هم /fa). قبلاً fa به‌عنوان زبان
  // پیش‌فرض بدون پیشوند سرو می‌شد و URL هنگام تعویض به فارسی تغییر
  // محسوسی نداشت.
  localePrefix: 'always',
  localeDetection: true,
}) as unknown as (req: NextRequest) => NextResponse;

export default function middleware(req: NextRequest): ReturnType<typeof intlMiddleware> {
  return intlMiddleware(req);
}

export const config = {
  // ✅ FIX: قبلاً فقط یک لیست ثابت از فایل‌های استاتیک (favicon، manifest و..)
  // exclude می‌شد؛ هر فایل دیگری مستقیم زیر public/ (مثل dashboard-desktop.png،
  // dashboard-mobile.png) توسط این middleware به‌عنوان یک "صفحه" در نظر گرفته
  // می‌شد و ریدایرکت ۳۰۷ به /af/dashboard-desktop.png می‌خورد — که چون
  // فایل‌های public همیشه فقط از ریشه سرو می‌شوند نه زیر پیشوند locale، ۴۰۴
  // می‌داد. حالا هر مسیری که یک پسوند فایل استاتیک دارد (نقطه + حروف) به‌طور
  // کلی از این middleware مستثنا می‌شود.
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)',
  ],
};