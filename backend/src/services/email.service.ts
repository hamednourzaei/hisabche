// backend/src/services/email.service.ts
import { Resend } from 'resend';

console.log('[EMAIL] Initializing Resend...');
console.log('[EMAIL] API_KEY exists:', !!process.env.RESEND_API_KEY);
console.log('[EMAIL] API_KEY prefix:', (process.env.RESEND_API_KEY || 'NONE').substring(0, 5));
console.log('[EMAIL] API_KEY length:', (process.env.RESEND_API_KEY || '').length);

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'noreply@hisabche.com';
const FROM_NAME = 'Hisabche';

const titles: Record<string, string> = {
  'fa-IR': 'بازنشانی رمز عبور - حسابچه',
  'fa-AF': 'بازنشانی پسورد - حسابچه',
  'en': 'Reset Your Password - Hisabche',
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export const emailService = {
  async send({ to, subject, html }: SendEmailParams) {
    console.log('[EMAIL] ====== SEND START ======');
    console.log('[EMAIL] To:', to);
    console.log('[EMAIL] From:', `${FROM_NAME} <${FROM_EMAIL}>`);
    console.log('[EMAIL] Subject:', subject);
    console.log('[EMAIL] HTML length:', html.length);

    try {
      const { data, error } = await resend.emails.send({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to,
        subject,
        html,
      });

      if (error) {
        console.error('[EMAIL] ❌ Resend error:', JSON.stringify(error, null, 2));
        console.error('[EMAIL] Error name:', error.name);
        console.error('[EMAIL] Error message:', error.message);
        return { success: false, error };
      }

      console.log('[EMAIL] ✅ Sent! ID:', data?.id);
      console.log('[EMAIL] ====== SEND END ======');
      return { success: true, id: data?.id };
    } catch (err: any) {
      console.error('[EMAIL] ❌ Exception:', err?.message || err);
      console.error('[EMAIL] Stack:', err?.stack);
      return { success: false, error: err };
    }
  },

  async sendResetPassword(to: string, resetLink: string, lang: string = 'fa-IR') {
    console.log('[EMAIL] sendResetPassword called');
    console.log('[EMAIL] To:', to);
    console.log('[EMAIL] Reset link:', resetLink);
    console.log('[EMAIL] Lang:', lang);

    const html = getResetPasswordTemplate(resetLink, lang);
    const subject = titles[lang] ?? titles['en']!;

    return this.send({ to, subject, html });
  },
};

function getResetPasswordTemplate(resetLink: string, lang: string): string {
  const isEnglish = lang === 'en';
  const dir = isEnglish ? 'ltr' : 'rtl';
  const font = isEnglish ? 'Inter, Arial, sans-serif' : 'Vazirmatn, Tahoma, sans-serif';

  const texts: Record<string, any> = {
    'fa-IR': {
      title: 'بازنشانی رمز عبور',
      hello: 'سلام،',
      message: 'درخواست بازنشانی رمز عبور برای حساب شما ثبت شده است. برای تغییر رمز روی دکمه زیر کلیک کنید:',
      button: 'بازنشانی رمز عبور',
      expire: 'این لینک تا ۱ ساعت معتبر است.',
      ignore: 'اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.',
      footer: 'حسابچه — سیستم مدیریت کسب‌وکار',
    },
    'fa-AF': {
      title: 'بازنشانی پسورد',
      hello: 'سلام،',
      message: 'درخواست بازنشانی پسورد برای حساب شما ثبت شده است. برای تغییر پسورد روی دکمه زیر کلیک کنید:',
      button: 'بازنشانی پسورد',
      expire: 'این لینک تا ۱ ساعت معتبر است.',
      ignore: 'اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.',
      footer: 'حسابچه — سیستم مدیریت تجارت',
    },
    'en': {
      title: 'Reset Your Password',
      hello: 'Hello,',
      message: 'A password reset request has been made for your account. Click the button below to reset your password:',
      button: 'Reset Password',
      expire: 'This link is valid for 1 hour.',
      ignore: 'If you did not request this, please ignore this email.',
      footer: 'Hisabche — Business Management System',
    },
  };

  const t = texts[lang] || texts['en'];

  return `
<!DOCTYPE html>
<html dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: ${font}; }
    .container { max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #12C8A0, #0EA5E9); padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; }
    .body { padding: 32px 24px; color: #1a1a2e; font-size: 14px; line-height: 1.8; }
    .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #12C8A0, #0EA5E9); color: #ffffff; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 14px; margin: 20px 0; }
    .expire { font-size: 12px; color: #888; margin-top: 16px; }
    .footer { padding: 20px 24px; background: #fafafa; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; }
    a { color: #12C8A0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${t.title}</h1>
    </div>
    <div class="body">
      <p>${t.hello}</p>
      <p>${t.message}</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">${t.button}</a>
      </div>
      <p class="expire">⏰ ${t.expire}</p>
      <p style="font-size: 12px; color: #888;">${t.ignore}</p>
    </div>
    <div class="footer">
      <p>${t.footer}</p>
      <p>hisabche.com</p>
    </div>
  </div>
</body>
</html>`;
}