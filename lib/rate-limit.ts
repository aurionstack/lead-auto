// ============================================================
// src/lib/rate-limit.ts
// In-memory IP-based rate limiter for the login endpoint.
//
// DESIGN NOTES:
//   - Works perfectly on a single server / Vercel instance.
//   - Resets on cold starts and deploys (acceptable for a
//     solo internal tool with negligible traffic).
//   - NOT suitable for high-traffic or multi-instance setups
//     where Vercel may spin up concurrent instances — each
//     instance maintains its own independent memory map.
//     For distributed rate-limiting, use Upstash Redis.
//
// PARAMETERS:
//   - MAX_ATTEMPTS: 5 failed attempts triggers lockout
//   - WINDOW_MS: 15-minute sliding window
// ============================================================

import type { RateLimitEntry } from './types';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes in milliseconds

// In-memory store: IP address → attempt tracking
const store = new Map<string, RateLimitEntry>();

/**
 * Records a failed login attempt for the given IP.
 * Returns whether the IP is now rate-limited and how many
 * attempts remain before lockout.
 */
export function recordFailedAttempt(ip: string): {
  limited: boolean;
  remaining: number;
  resetAt: number;
} {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry) {
    // First failed attempt from this IP
    store.set(ip, { attempts: 1, firstAttemptAt: now });
    return {
      limited: false,
      remaining: MAX_ATTEMPTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  // Check if the window has expired — reset if so
  if (now - entry.firstAttemptAt > WINDOW_MS) {
    store.set(ip, { attempts: 1, firstAttemptAt: now });
    return {
      limited: false,
      remaining: MAX_ATTEMPTS - 1,
      resetAt: now + WINDOW_MS,
    };
  }

  // Window is still active — increment
  const newAttempts = entry.attempts + 1;
  store.set(ip, { attempts: newAttempts, firstAttemptAt: entry.firstAttemptAt });

  const limited = newAttempts >= MAX_ATTEMPTS;
  const remaining = Math.max(0, MAX_ATTEMPTS - newAttempts);
  const resetAt = entry.firstAttemptAt + WINDOW_MS;

  return { limited, remaining, resetAt };
}

/**
 * Checks if an IP is currently rate-limited WITHOUT
 * incrementing the counter. Call this BEFORE checking
 * the password so we don't allow an extra attempt.
 */
export function isRateLimited(ip: string): {
  limited: boolean;
  resetAt: number;
} {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry) {
    return { limited: false, resetAt: 0 };
  }

  // Window expired — entry is stale, no longer limited
  if (now - entry.firstAttemptAt > WINDOW_MS) {
    store.delete(ip);
    return { limited: false, resetAt: 0 };
  }

  const limited = entry.attempts >= MAX_ATTEMPTS;
  const resetAt = entry.firstAttemptAt + WINDOW_MS;

  return { limited, resetAt };
}

/**
 * Clears the rate-limit entry for an IP on successful login.
 * Resets the counter so a legitimate user returning later
 * doesn't get stuck in a stale lockout.
 */
export function clearAttempts(ip: string): void {
  store.delete(ip);
}
