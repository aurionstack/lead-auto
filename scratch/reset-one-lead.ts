import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Resetting 1 lead to test deep scraping...');

  const response = await fetch(`${supabaseUrl}/rest/v1/leads?website=not.is.null&limit=1`, {
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
      status: 'new'
    })
  });

  const updatedLeads = await response.json();
  if (updatedLeads && updatedLeads.length > 0) {
    console.log(`Successfully reset lead: ${updatedLeads[0].business_name}`);
  } else {
    console.log('No leads found to reset.');
  }
}

run();
