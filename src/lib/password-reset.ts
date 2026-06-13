// password-reset.ts — OTP üretimi ve sıfırlama akışının ortak sabitleri/yardımcıları.
import { randomInt } from 'node:crypto';

/** Kodun geçerlilik süresi (dakika). */
export const OTP_TTL_MINUTES = 5;
/** İzin verilen maksimum yanlış doğrulama denemesi (aşılınca kod iptal). */
export const OTP_MAX_ATTEMPTS = 5;
/** Aynı e-postaya yeni kod istemek için bekleme (saniye) — spam/abuse'a karşı. */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

/** Kriptografik olarak güvenli 6 haneli kod ("000000"–"999999"). */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
