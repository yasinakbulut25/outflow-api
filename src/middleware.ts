import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// API'ye CORS başlıkları ekler ve preflight (OPTIONS) isteklerini karşılar.
// React Native native istemci CORS uygulamaz; bu katman web/test istemcileri içindir.
const ORIGIN = process.env.CORS_ORIGIN ?? '*';

function withCors(res: NextResponse): NextResponse {
  res.headers.set('Access-Control-Allow-Origin', ORIGIN);
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Max-Age', '86400');
  return res;
}

export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return withCors(new NextResponse(null, { status: 204 }));
  }
  return withCors(NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
