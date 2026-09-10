// ============================================================
// proxy.ts
//
// NEXT.JS EDGE PROXY — Session Gate for /dashboard
// (renamed from middleware.ts — Next.js 16.2+ convention)
// ============================================================
//
// Intercepts every request to /dashboard/* and:
//   - Reads the session cookie set by /api/auth/login
//   - Redirects to /login if cookie is absent or invalid
//   - Passes through if session is valid
//
// Runs on Vercel's Edge Runtime (not Node.js) — no file I/O,
// no Node.js-specific APIs. Cookie reading via NextRequest is fine.
//
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const SESSION_COOKIE_NAME = 'lead_sys_session';

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Only gate /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);
    let isAuthenticated = false;

    if (sessionCookie?.value) {
      try {
        const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-for-dev-only');
        await jwtVerify(sessionCookie.value, secret);
        isAuthenticated = true;
      } catch (err) {
        console.error('[proxy] Invalid session JWT');
      }
    }

    if (!isAuthenticated) {
      // Redirect to login, preserving the originally requested URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

// Only intercept /dashboard routes — not API routes or static assets.
export const config = {
  paths: ['/dashboard/:path*'],
};
