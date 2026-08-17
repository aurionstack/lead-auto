import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const response = await fetch(`${supabaseUrl}/rest/v1/leads?select=business_name,email,alternative_emails&status=eq.new`, {
    headers: {
      'apikey': serviceKey as string,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  });

  let leads = await response.json();
  
  // If they are no longer 'new', they might have been marked differently, but the process-leads endpoint doesn't actually change the status away from 'new' yet, it just sets the score!
  // Let's just fetch all leads and see the stats.
  const responseAll = await fetch(`${supabaseUrl}/rest/v1/leads?select=business_name,email,alternative_emails,opportunity_score`, {
    headers: {
      'apikey': serviceKey as string,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  leads = await responseAll.json();
  
  let total = leads.length;
  let scored = leads.filter((l: any) => l.opportunity_score !== null).length;
  let withEmail = leads.filter((l: any) => l.email !== null).length;
  let withAlternatives = leads.filter((l: any) => l.alternative_emails && l.alternative_emails.length > 0).length;

  console.log(`--- SYSTEM BATCH RESULT ---`);
  console.log(`Total Leads in Database: ${total}`);
  console.log(`Successfully Scored by AI: ${scored}`);
  console.log(`Leads with Primary Verified Email: ${withEmail}`);
  console.log(`Leads with Fallback Alternative Emails: ${withAlternatives}`);
  console.log(`\nNotable examples with alternatives:`);
  
  leads.filter((l: any) => l.alternative_emails && l.alternative_emails.length > 0).slice(0, 5).forEach((l: any) => {
    console.log(`- ${l.business_name}`);
    console.log(`  Primary: ${l.email}`);
    console.log(`  Alternatives: ${l.alternative_emails.length} found`);
  });
}

run();
