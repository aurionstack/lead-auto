import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const headers = {
    'apikey': serviceKey as string,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  console.log('1. Suppressing all existing new leads...');
  await fetch(`${supabaseUrl}/rest/v1/leads?status=eq.new`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'suppressed' })
  });

  console.log('2. Inserting a dummy lead for testing...');
  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      business_name: 'Aurion Stack Test Business',
      website: 'https://aurionstack.dev',
      category: 'Software Agency',
      rating: 5.0,
      status: 'new'
    })
  });

  if (!insertResponse.ok) {
    console.error('Error inserting dummy lead:', await insertResponse.text());
    return;
  }

  const dummyLead = (await insertResponse.json())[0];
  console.log('Dummy lead inserted:', dummyLead.id);
  
  await fetch(`${supabaseUrl}/rest/v1/leads_enrichment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      lead_id: dummyLead.id,
      discovered_emails: [{ email: 'samir@aurionstack.dev', source: 'Manual Test' }]
    })
  });
    
  console.log('Test environment ready. Dummy lead has been setup with your email (samir@aurionstack.dev).');
}

run();
