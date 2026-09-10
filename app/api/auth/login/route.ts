// ============================================================
// src/app/api/auth/login/route.ts
//
// PASSWORD GATE — Dashboard Authentication Endpoint
// ============================================================
//
// Security flow:
//   1. Check IP rate-limit BEFORE password comparison
//      (prevents timing attacks from revealing attempt count)
//   2. Compare submitted password against DASHBOARD_ADMIN_PASSWORD
//   3. On success: set secure HTTP-only session cookie + clear attempts
//   4. On failure: record attempt, return remaining count
//   5. On lockout: return 429 with reset timestamp
//
// Cookie security flags:
//   - httpOnly: true   → JS cannot read it (XSS protection)
//   - secure: true     → HTTPS only in production
//   - sameSite: strict → CSRF protection
//   - path: /          → Valid for all routes
//
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isRateLimited, recordFailedAttempt, clearAttempts } from '@/lib/rate-limit';
import { SignJWT } from 'jose';
import crypto from 'crypto';

// Session cookie name — used by middleware to gate /dashboard
export const SESSION_COOKIE_NAME = 'lead_sys_session';

// Session token — now a JWT instead of a static string
// The token is signed using SESSION_SECRET.

// Cookie max-age: 8 hours (matches a typical work session)
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

function getClientIp(request: NextRequest): string {
  // Vercel forwards the real IP in x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  // Fallback for local development
  return request.headers.get('x-real-ip') ?? '127.0.0.1';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const adminPassword = process.env.DASHBOARD_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[auth/login] DASHBOARD_ADMIN_PASSWORD is not configured.');
    return NextResponse.json(
      { error: 'Server misconfiguration.' },
      { status: 500 }
    );
  }

  const clientIp = getClientIp(request);

  // ── 1. Pre-check rate limit before touching the password ──
  const { limited, resetAt } = await isRateLimited(clientIp);
  if (limited) {
    const resetInSeconds = Math.ceil((resetAt - Date.now()) / 1000);
    console.warn(`[auth/login] IP ${clientIp} is rate-limited. Reset in ${resetInSeconds}s.`);
    return NextResponse.json(
      {
        error: 'Too many failed attempts. Please try again later.',
        resetAt,
        resetInSeconds,
      },
      { status: 429 }
    );
  }

  // ── 2. Parse the submitted password ───────────────────────
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const submittedPassword = body?.password;
  if (!submittedPassword || typeof submittedPassword !== 'string') {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 });
  }

  // ── 3. Constant-time comparison to prevent timing attacks ──
  // Using a character-by-character loop isn't perfect in JS,
  // but avoids early exit on first mismatch.
  const isCorrect = timingSafeEqual(submittedPassword, adminPassword);

  if (!isCorrect) {
    // ── 4. Record failed attempt ─────────────────────────────
    const { limited: nowLimited, remaining, resetAt: newResetAt } = await recordFailedAttempt(clientIp);

    if (nowLimited) {
      const resetInSeconds = Math.ceil((newResetAt - Date.now()) / 1000);
      console.warn(`[auth/login] IP ${clientIp} is now rate-limited after too many failures.`);
      return NextResponse.json(
        {
          error: 'Too many failed attempts. You have been locked out.',
          resetAt: newResetAt,
          resetInSeconds,
        },
        { status: 429 }
      );
    }

    console.log(`[auth/login] Failed attempt from IP ${clientIp}. Remaining: ${remaining}`);
    return NextResponse.json(
      {
        error: 'Incorrect password.',
        remainingAttempts: remaining,
      },
      { status: 401 }
    );
  }

  // ── 5. Success — set session cookie and clear attempts ─────
  await clearAttempts(clientIp);
  console.log(`[auth/login] Successful login from IP ${clientIp}.`);

  const cookieStore = await cookies();
  
  const secret = new TextEncoder().encode(process.env.SESSION_SECRET || 'fallback-secret-for-dev-only');
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,                               // XSS protection
    secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    sameSite: 'strict',                           // CSRF protection
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(): Promise<NextResponse> {
  // Logout endpoint — clears the session cookie
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ success: true });
}

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) {
      crypto.timingSafeEqual(aBuf, aBuf); // dummy call
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}
