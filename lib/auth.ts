import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'lead_sys_session';

function sessionSecret(): Uint8Array | null {
  const value = process.env.SESSION_SECRET || process.env.CRON_SECRET;
  return value ? new TextEncoder().encode(value) : null;
}

export async function verifySessionToken(token?: string): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || !token) return false;

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
      issuer: 'lead-system',
      audience: 'dashboard',
    });
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function hasDashboardSession(): Promise<boolean> {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export function isBearerAuthorized(request: Request, secret?: string): boolean {
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}
