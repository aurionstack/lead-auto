// ============================================================
// lib/hunter.ts
// ============================================================
import { DiscoveredEmail } from './apollo';

export async function findEmailWithHunter(domain: string): Promise<DiscoveredEmail[]> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || apiKey === 'paste_your_hunter_api_key_here') return [];

  try {
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}`);

    if (!response.ok) {
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
