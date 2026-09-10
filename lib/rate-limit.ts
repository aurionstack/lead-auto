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
  const now = Date.now();
  
  // Try to fetch existing record
  const { data: entry } = await supabaseAdmin
    .from('rate_limits')
    .select('*')
    .eq('ip', ip)
    .single();

  if (!entry) {
    // First failed attempt
    await supabaseAdmin
      .from('rate_limits')
      .insert({ ip, attempts: 1, first_attempt_at: new Date(now).toISOString() });

    return {
      limited: false,
      remaining: MAX_ATTEMPTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  const firstAttemptAt = new Date(entry.first_attempt_at).getTime();

  // Check if window has expired
  if (now - firstAttemptAt > WINDOW_MS) {
    await supabaseAdmin
      .from('rate_limits')
      .update({ attempts: 1, first_attempt_at: new Date(now).toISOString() })
      .eq('ip', ip);

    return {
      limited: false,
      remaining: MAX_ATTEMPTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  // Increment attempts
  const newAttempts = entry.attempts + 1;
  await supabaseAdmin
    .from('rate_limits')
    .update({ attempts: newAttempts })
    .eq('ip', ip);

  const limited = newAttempts >= MAX_ATTEMPTS;
  const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
  const resetAt = firstAttemptAt + WINDOW_MS;

  return { limited, remaining, resetAt };
}

/**
 * Checks if an IP is currently rate-limited.
 */
export async function isRateLimited(ip: string): Promise<{
  limited: boolean;
  resetAt: number;
}> {
  const now = Date.now();
  
  const { data: entry } = await supabaseAdmin
    .from('rate_limits')
    .select('*')
    .eq('ip', ip)
    .single();

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
