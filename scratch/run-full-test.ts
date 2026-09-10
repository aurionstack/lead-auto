import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const cronSecret = process.env.CRON_SECRET;
  
  console.log('----------------------------------------------------');
  console.log('STEP 1: Triggering AI Generation & Queuing Engine (Looping to clear queue)');
  console.log('----------------------------------------------------');
  
  let processed = 2;
  while (processed === 2) {
    const res1 = await fetch('http://localhost:3000/api/cron/process-leads', {
      headers: { 'Authorization': `Bearer ${cronSecret}` }
    });
    
    const json1 = await res1.json();
    console.log('Response:', JSON.stringify(json1, null, 2));
    processed = json1.processed || 0;
  }

  console.log('\n----------------------------------------------------');
  console.log('STEP 2: Triggering Sending Engine');
  console.log('----------------------------------------------------');
  
  const res2 = await fetch('http://localhost:3000/api/cron/process-outreach', {
    headers: { 'Authorization': `Bearer ${cronSecret}` }
  });
  
  const json2 = await res2.json();
  console.log('Response:', JSON.stringify(json2, null, 2));
  
  console.log('\nPipeline test complete!');
}

run();
