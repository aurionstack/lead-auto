// ============================================================
// lib/hunter.ts
// ============================================================
import { DiscoveredEmail } from './types';

export function getHunterApiKey(tenantKey?: string | null): string | null {
  if (tenantKey) return tenantKey;
  
  // Find all env vars starting with HUNTER_API_KEY
  const keys = Object.keys(process.env)
    .filter(k => k.startsWith('HUNTER_API_KEY'))
    .map(k => process.env[k])
    .filter(Boolean) as string[];

  if (keys.length === 0) return null;

  // Randomly rotate
  const randomIndex = Math.floor(Math.random() * keys.length);
  return keys[randomIndex];
}

export async function findEmailWithHunter(domain: string, hunterApiKey?: string | null): Promise<DiscoveredEmail[]> {
  if (!hunterApiKey) return [];

  try {
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${hunterApiKey}`);

    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`[lib/hunter] Hunter API key rate limited (429).`);
      }
      console.error(`[lib/hunter] Hunter API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const emails: DiscoveredEmail[] = [];
    
    if (data.data && data.data.emails && data.data.emails.length > 0) {
      for (const emailObj of data.data.emails) {
        if (emailObj.value) {
          emails.push({
            email: emailObj.value,
            source: 'hunter',
            name: emailObj.first_name ? `${emailObj.first_name} ${emailObj.last_name || ''}`.trim() : undefined,
            title: emailObj.position,
            confidence: emailObj.confidence > 80 ? 'high' : 'medium'
          });
        }
      }
    }

    return emails;
  } catch (err) {
    console.error('[lib/hunter] Error calling Hunter API:', err);
    return [];
  }
}

export async function verifyEmailWithHunter(email: string, hunterApiKey?: string | null) {
  if (!hunterApiKey) return { status: 'unverified' as const, verifiedAt: null };
  try {
    const response = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterApiKey}`);
    if (!response.ok) {
      console.error(`[lib/hunter] Email verifier error: ${response.status} ${response.statusText}`);
      return { status: 'unknown' as const, verifiedAt: new Date().toISOString() };
    }
    const payload = await response.json() as { data?: { status?: string; score?: number } };
    const allowed = ['valid', 'invalid', 'accept_all', 'webmail', 'disposable', 'unknown', 'blocked'] as const;
    const status = allowed.find((value) => value === payload.data?.status) ?? 'unknown';
    return { status, score: payload.data?.score, verifiedAt: new Date().toISOString() };
  } catch (error) {
    console.error('[lib/hunter] Email verifier request failed:', error);
    return { status: 'unknown' as const, verifiedAt: new Date().toISOString() };
  }
}
