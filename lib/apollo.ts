// ============================================================
// lib/apollo.ts
// ============================================================

export interface DiscoveredEmail {
  email: string;
  source: string;
  confidence?: string;
  name?: string;
  title?: string;
}

export async function findEmailWithApollo(domain: string): Promise<DiscoveredEmail[]> {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey || apiKey === 'paste_your_apollo_api_key_here') return [];

  try {
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_organization_domains: domain,
        page: 1,
        person_titles: ['CEO', 'Founder', 'Owner', 'President', 'Director', 'Manager', 'Partner'],
      }),
    });

    if (!response.ok) {
      console.error(`[lib/apollo] Apollo API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const emails: DiscoveredEmail[] = [];
    
    if (data.people && data.people.length > 0) {
      for (const person of data.people) {
        if (person.email) {
          emails.push({
            email: person.email,
            source: 'apollo',
            name: person.name,
            title: person.title,
            confidence: person.email_status === 'verified' ? 'high' : 'medium'
          });
        }
      }
    }

    return emails;
  } catch (err) {
    console.error('[lib/apollo] Error calling Apollo API:', err);
    return [];
  }
}
