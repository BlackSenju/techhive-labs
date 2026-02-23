/**
 * Next.js Middleware — Minimal for Labs.
 * Public routes: /api/contact (form), /api/stripe/webhook, /api/health, / (landing)
 * All other /api/* routes require Authorization header (checked in handlers).
 * No browser-based auth needed — Labs is API-first.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set(['/', '/api/contact', '/api/stripe/webhook', '/api/health']);
const PUBLIC_PREFIXES = ['/_next/', '/favicon'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths — always pass through
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // For /api/* routes, check Authorization header exists
  // Actual token validation happens in each handler via isAuthorized()
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, data: null, error: 'Unauthorized' },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
