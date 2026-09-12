import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function checkStatus() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { 'apikey': serviceKey as string, 'Authorization': `Bearer ${serviceKey}` };
  
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/outreach_queue?select=status`, { headers });
    const queueData = await res.json();
    
    if (queueData.error) {
      console.error('Error fetching queue:', queueData.error);
      return;
    }
    
    const counts = queueData.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('--- Outreach Queue Status ---');
    console.log(counts);
    
    if (counts['failed'] > 0) {
      console.log('\nFetching latest failure reason...');
      const failRes = await fetch(`${supabaseUrl}/rest/v1/outreach_queue?status=eq.failed&select=error_message&limit=1`, { headers });
      const failData = await failRes.json();
      console.log('Latest failure reason:', failData[0]?.error_message || 'None recorded');
    }
    
    const resLeads = await fetch(`${supabaseUrl}/rest/v1/leads?select=status`, { headers });
    const leadsData = await resLeads.json();
    const leadCounts = leadsData.reduce((acc: any, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('\n--- Leads Table Status ---');
    console.log(leadCounts);
    
  } catch (err) {
    console.error('Exception during check:', err);
  }
}
checkStatus();
