import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const SECRET = process.env.JWT_SECRET ?? 'changeme';

export interface TokenPayload {
  user_id: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function getAuthUser(req: NextRequest): TokenPayload | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return verifyToken(auth.slice(7));
}

// --- Şifre sıfırlama (OTP doğrulandıktan sonra kullanılan kısa ömürlü token) ---
// OTP doğrulanınca üretilir; yalnızca yeni şifre belirleme adımını yetkilendirir.
// `purpose` ile normal oturum token'larından ayrışır (oturum token'ı ile şifre
// sıfırlanamaz, reset token'ı ile API'ye erişilemez).

interface ResetTokenPayload {
  user_id: number;
  purpose: 'pwreset';
}

export function signResetToken(user_id: number): string {
  return jwt.sign({ user_id, purpose: 'pwreset' } satisfies ResetTokenPayload, SECRET, {
    expiresIn: '10m',
  });
}

export function verifyResetToken(token: string): { user_id: number } | null {
  try {
    const payload = jwt.verify(token, SECRET) as ResetTokenPayload;
    if (payload.purpose !== 'pwreset') return null;
    return { user_id: payload.user_id };
  } catch {
    return null;
  }
}
