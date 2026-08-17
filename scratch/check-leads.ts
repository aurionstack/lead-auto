import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

interface DBLead {
  business_name: string;
  email: string | null;
  opportunity_score: number | null;
  category: string;
  scrape_job_id: string;
}

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) return;

  const response = await fetch(`${supabaseUrl}/rest/v1/leads?select=business_name,email,opportunity_score,category,scrape_job_id&limit=50`, {
    headers: {
      'apikey': serviceKey as string,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  });

  const leads: DBLead[] = await response.json();
  const categories = [...new Set(leads.map((l: DBLead) => l.category))];
  console.log('Available Categories:', categories);
  
  const carDealers = leads.filter((l: DBLead) => l.category && l.category.toLowerCase().includes('car dealer'));
  console.log(`Found ${carDealers.length} Car Dealer leads.`);
  let emailsFound = 0;
  
  carDealers.forEach((l: DBLead) => {
    if (l.email) emailsFound++;
    console.log(`- ${l.business_name.padEnd(35)} | Score: ${String(l.opportunity_score).padEnd(4)} | Email: ${l.email || 'None'}`);
  });
  
  console.log(`\nTotal verified emails discovered: ${emailsFound} / ${carDealers.length}`);
}

run();
