import { NextRequest, NextResponse } from 'next/server';
import { createPublicKey, type JsonWebKey } from 'crypto';
import jwt from 'jsonwebtoken';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import { signToken } from '@/lib/server-auth';

const APPLE_KEYS_URL = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_AUDIENCE = process.env.APPLE_BUNDLE_ID ?? 'com.outflow.app';

interface AppleJwk {
  kty: string;
  kid: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleClaims {
  sub: string;
  email?: string;
}

interface UserRow extends RowDataPacket {
  id: number;
  email: string | null;
  name: string | null;
}

async function verifyAppleToken(identityToken: string): Promise<AppleClaims> {
  const [headerB64] = identityToken.split('.');
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString()) as { kid: string };

  const res = await fetch(APPLE_KEYS_URL);
  const { keys }: { keys: AppleJwk[] } = await res.json();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Apple key not found');

  // format:'jwk' verildiğinde `key` Node crypto'nun JsonWebKey'i olmalı (index signature'lı);
  // AppleJwk alanları çalışma anında uyumlu, tip için unknown üzerinden daraltıyoruz.
  const publicKey = createPublicKey({ key: jwk as unknown as JsonWebKey, format: 'jwk' });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  return jwt.verify(identityToken, pem, {
    algorithms: ['RS256'],
    issuer: APPLE_ISSUER,
    audience: APPLE_AUDIENCE,
  }) as AppleClaims;
}

export async function POST(req: NextRequest) {
  try {
    const { identity_token, full_name } = await req.json() as {
      identity_token: string;
      full_name?: { givenName?: string; familyName?: string } | null;
    };

    if (!identity_token) {
      return NextResponse.json({ success: false, message: 'identity_token gerekli' }, { status: 400 });
    }

    let claims: AppleClaims;
    try {
      claims = await verifyAppleToken(identity_token);
    } catch {
      return NextResponse.json({ success: false, message: 'Geçersiz Apple token' }, { status: 401 });
    }

    const appleId = claims.sub;

    // Önce apple_id ile ara
    const [byAppleId] = await pool.query<UserRow[]>(
      'SELECT id, email, name FROM users WHERE apple_id = ?',
      [appleId],
    );
    if (byAppleId.length > 0) {
      const user = byAppleId[0];
      const token = signToken({ user_id: user.id });
      return NextResponse.json({
        success: true,
        data: { token, user: { id: user.id, email: user.email, name: user.name } },
      });
    }

    // Aynı email ile kayıtlı kullanıcı varsa apple_id bağla
    const appleEmail = claims.email?.toLowerCase() ?? null;
    if (appleEmail) {
      const [byEmail] = await pool.query<UserRow[]>(
        'SELECT id, email, name FROM users WHERE email = ?',
        [appleEmail],
      );
      if (byEmail.length > 0) {
        const user = byEmail[0];
        await pool.query('UPDATE users SET apple_id = ? WHERE id = ?', [appleId, user.id]);
        const token = signToken({ user_id: user.id });
        return NextResponse.json({
          success: true,
          data: { token, user: { id: user.id, email: user.email, name: user.name } },
        });
      }
    }

    // Yeni kullanıcı oluştur — Apple yalnızca ilk girişte full_name gönderir
    const givenName = full_name?.givenName ?? '';
    const familyName = full_name?.familyName ?? '';
    const name = [givenName, familyName].filter(Boolean).join(' ') || null;

    const [result] = await pool.query<ResultSetHeader>(
      'INSERT INTO users (email, name, apple_id) VALUES (?, ?, ?)',
      [appleEmail, name, appleId],
    );

    const token = signToken({ user_id: result.insertId });
    return NextResponse.json(
      { success: true, data: { token, user: { id: result.insertId, email: appleEmail, name } } },
      { status: 201 },
    );
  } catch (err) {
    console.error('[auth/apple]', err);
    return NextResponse.json({ success: false, message: 'Sunucu hatası' }, { status: 500 });
  }
}
