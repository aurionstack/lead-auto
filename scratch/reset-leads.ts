import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return;

  console.log('Resetting Car Dealer leads to unscored state...');

  const response = await fetch(`${supabaseUrl}/rest/v1/leads?category=ilike.*car%20dealer*`, {
    method: 'PATCH',
    headers: {
      'apikey': serviceKey as string,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      opportunity_score: null,
      email: null,
      ai_reasoning: null,
      drafted_pitch: null,
      drafted_email_pitch: null,
      status: 'new'
    })
  });

  if (!response.ok) {
    console.error('Failed to reset leads:', await response.text());
    return;
  }

  const updatedLeads = await response.json();
  console.log(`Successfully reset ${updatedLeads.length} leads back to the queue!`);
}

run();
