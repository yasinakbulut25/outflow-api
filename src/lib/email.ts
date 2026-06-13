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

/** Yeni kullanıcıya hoş geldin e-postası gönderir. `name` opsiyonel (görünen ad). */
export async function sendWelcomeEmail(to: string, name?: string): Promise<void> {
  const greetingName = name?.trim() ? name.trim() : 'merhaba';
  const subject = 'Outflow’a hoş geldin 👋';

  // Uygulamanın temel özellikleri — düz metin ve HTML sürümlerinde aynı içerik.
  const features: Array<{ icon: string; title: string; desc: string }> = [
    { icon: '💸', title: 'Harcama takibi', desc: 'Peşin ya da taksitli, çok kalemli alımlarını aya ve güne göre düzenli bir listede gör.' },
    { icon: '📅', title: 'Otomatik taksit planı', desc: 'Aylık taksit tutarın otomatik hesaplanır ve gelecek aylara dağıtılarak takvime işlenir.' },
    { icon: '🔁', title: 'Tekrarlayan ödemeler', desc: 'Kira, Netflix gibi sabit giderleri bir kez tanımla; her ay otomatik oluşturulsun.' },
    { icon: '💰', title: 'Gelir takibi', desc: 'Maaş gibi düzenli gelirlerini ve aya özel ek gelirlerini ekleyerek nakit akışını gör.' },
    { icon: '🐷', title: 'Birikimler', desc: 'Birikim kayıtlarını ayrı bir ekranda izle, hedefine ne kadar yaklaştığını takip et.' },
    { icon: '📊', title: 'Analitik', desc: 'Kategori dağılımı, aylık özet ve gelir / gider / net durumunu tek bakışta gör.' },
  ];

  const text =
    `Outflow'a hoş geldin!\n\n` +
    `Outflow, harcamalarını, gelirlerini ve birikimlerini tek yerden takip etmeni sağlayan kişisel bütçe uygulamasıdır.\n\n` +
    `Yapabileceklerin:\n` +
    features.map((f) => `• ${f.title}: ${f.desc}`).join('\n') +
    `\n\nHadi başlayalım — ilk harcamanı ekleyerek nakit akışını görmeye başla.\n` +
    `— Outflow ekibi`;

  const featureRows = features
    .map(
      (f) => `
      <tr>
        <td style="vertical-align:top;padding:10px 0;width:34px;font-size:20px;line-height:24px">${f.icon}</td>
        <td style="vertical-align:top;padding:10px 0">
          <div style="font-size:15px;font-weight:600;color:#0f172a;line-height:20px">${f.title}</div>
          <div style="font-size:13px;color:#64748b;line-height:19px;margin-top:2px">${f.desc}</div>
        </td>
      </tr>`
    )
    .join('');

  const html = `
  <div style="background:#f8fafc;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="480" style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden">
      <tr>
        <td style="padding:28px 32px 0">
          <div style="font-size:20px;font-weight:700;color:#059669;letter-spacing:-0.3px">Outflow</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px 4px">
          <h1 style="margin:0 0 6px;font-size:22px;line-height:28px;color:#0f172a">Hoş geldin, ${greetingName} 👋</h1>
          <p style="margin:0;font-size:14px;line-height:21px;color:#475569">
            Outflow ile harcamalarını, gelirlerini ve birikimlerini tek yerden takip et. İşte temel olarak yapabileceklerin:
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 32px 4px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            ${featureRows}
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 32px 8px">
          <a href="https://outflow.yasinakbulut.dev" style="display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:10px">Uygulamayı aç</a>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 32px 28px">
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:0 0 14px" />
          <p style="margin:0;font-size:12px;line-height:18px;color:#94a3b8">
            Bu e-postayı Outflow hesabı oluşturduğun için aldın. Bu işlemi sen yapmadıysan bu e-postayı yok sayabilirsin.
          </p>
        </td>
      </tr>
    </table>
  </div>`;

  await sendEmail({ to, subject, html, text });
}
