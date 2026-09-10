// ============================================================
// lib/hunter.ts
// ============================================================
import { DiscoveredEmail } from './types';

export async function findEmailWithHunter(domain: string): Promise<DiscoveredEmail[]> {
  // Collect all API keys from environment variables (e.g., HUNTER_API_KEY, HUNTER_API_KEY_1, HUNTER_API_KEY_2)
  const apiKeys = Object.keys(process.env)
    .filter(key => key.startsWith('HUNTER_API_KEY') && process.env[key] && process.env[key] !== 'paste_your_hunter_api_key_here')
    .map(key => process.env[key] as string);

  if (apiKeys.length === 0) return [];

  // Shuffle the keys to distribute load across all available keys
  const shuffledKeys = apiKeys.sort(() => 0.5 - Math.random());

  for (let i = 0; i < shuffledKeys.length; i++) {
    const apiKey = shuffledKeys[i];

    try {
      const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}`);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`[lib/hunter] Hunter API key rate limited (429). Switching to next key... (${i + 1}/${shuffledKeys.length})`);
          continue; // Try the next key
        }
        console.error(`[lib/hunter] Hunter API error: ${response.status} ${response.statusText}`);
        return []; // Other errors (like 400 or 401) abort immediately
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

      // Success, return emails immediately
      return emails;
    } catch (err) {
      console.error('[lib/hunter] Error calling Hunter API:', err);
      // Try next key if network error
      continue;
    }
  }

  console.error('[lib/hunter] All Hunter API keys exhausted or failed.');
  return [];
}
