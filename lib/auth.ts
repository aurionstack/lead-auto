import { cookies } from 'next/headers';
import { createClient } from './supabase-server';

export const SESSION_COOKIE_NAME = 'lead_sys_session';

export async function hasDashboardSession(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

export async function getDashboardUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}

export function isBearerAuthorized(request: Request, secret?: string): boolean {
  return Boolean(secret && request.headers.get('authorization') === `Bearer ${secret}`);
}
