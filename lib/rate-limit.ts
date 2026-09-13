// ============================================================
// src/lib/rate-limit.ts
// Supabase-backed rate limiter for distributed serverless environments.
//
// PARAMETERS:
//   - MAX_ATTEMPTS: 5 failed attempts triggers lockout
//   - WINDOW_MS: 15-minute sliding window
// ============================================================

import { supabaseAdmin } from './supabase';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Records a failed login attempt for the given IP.
 */
export async function recordFailedAttempt(ip: string): Promise<{
  limited: boolean;
  remaining: number;
  resetAt: number;
}> {
  const { data, error } = await supabaseAdmin.rpc('record_login_failure', {
    client_ip: ip,
    max_attempts: MAX_ATTEMPTS,
    window_seconds: WINDOW_MS / 1000,
  });
  if (error || !data?.[0]) throw error || new Error('Rate limiter returned no result');

  const attempts = data[0].current_attempts as number;
  const windowStartedAt = new Date(data[0].window_started_at).getTime();
  return {
    limited: attempts >= MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - attempts),
    resetAt: windowStartedAt + WINDOW_MS,
  };
}

/**
 * Checks if an IP is currently rate-limited.
 */
export async function isRateLimited(ip: string): Promise<{
  limited: boolean;
  resetAt: number;
}> {
  const now = Date.now();
  
  const { data: entry, error } = await supabaseAdmin
    .from('rate_limits')
    .select('*')
    .eq('ip', ip)
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  if (!entry) {
    return { limited: false, resetAt: 0 };
  }

  const firstAttemptAt = new Date(entry.first_attempt_at).getTime();

  // Window expired
  if (now - firstAttemptAt > WINDOW_MS) {
    await supabaseAdmin.from('rate_limits').delete().eq('ip', ip);
    return { limited: false, resetAt: 0 };
  }

  const limited = entry.attempts >= MAX_ATTEMPTS;
  const resetAt = firstAttemptAt + WINDOW_MS;

  return { limited, resetAt };
}

/**
 * Clears the rate-limit entry for an IP on successful login.
 */
export async function clearAttempts(ip: string): Promise<void> {
  await supabaseAdmin.from('rate_limits').delete().eq('ip', ip);
}
