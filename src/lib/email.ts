// email.ts — SMTP üzerinden e-posta gönderimi (nodemailer).
// SMTP_HOST/SMTP_USER/SMTP_PASS tanımlı değilse gönderim YAPILMAZ; kod yalnızca sunucu
// log'una yazılır (yerel geliştirme / sağlayıcı henüz ayarlanmamışken akışı bloklamamak için).
import nodemailer, { type Transporter } from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// 465 → implicit TLS (secure). 587/25 → STARTTLS (secure=false). Açıkça da geçilebilir.
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : SMTP_PORT === 465;
const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Outflow <outflow@yasinakbulut.dev>';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

// Transporter'ı tek sefer kur (modül seviyesinde önbelleğe al).
let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    // Geliştirme yedeği: gerçek gönderim yok, içerik log'a yazılır.
    console.warn(`[email] SMTP ayarları eksik — gönderim atlandı. Alıcı: ${to}\n${text}`);
    return;
  }

  await tx.sendMail({ from: EMAIL_FROM, to, subject, html, text });
}

/** Şifre sıfırlama OTP kodunu e-postayla gönderir. */
export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const subject = 'Outflow şifre sıfırlama kodu';
  const text =
    `Outflow şifre sıfırlama kodun: ${code}\n\n` +
    `Bu kod 5 dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Şifre sıfırlama</h2>
      <p style="margin:0 0 16px;color:#475569">Aşağıdaki kodu uygulamaya girerek şifreni sıfırlayabilirsin:</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;padding:16px;background:#f1f5f9;border-radius:12px">${code}</div>
      <p style="margin:16px 0 0;color:#64748b;font-size:13px">Bu kod <b>5 dakika</b> geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin.</p>
    </div>`;
  await sendEmail({ to, subject, html, text });
}
