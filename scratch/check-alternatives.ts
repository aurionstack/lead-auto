import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/leads?select=business_name,email,alternative_emails&alternative_emails=not.is.null`, {
    headers: {
      'apikey': serviceKey as string,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  });

  const leads = await response.json();
  console.log(JSON.stringify(leads, null, 2));
}

run();
