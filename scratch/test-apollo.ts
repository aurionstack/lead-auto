import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function run() {
  const apiKey = process.env.APOLLO_API_KEY;
  console.log('Testing Apollo API...');
  
  try {
    const response = await fetch('https://api.apollo.io/v1/organizations/enrich?domain=aurionstack.dev', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey as string,
      }
    });

    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

run();
