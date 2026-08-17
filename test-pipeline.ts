import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { findEmailWithApollo } from './lib/apollo';
import { findEmailWithHunter } from './lib/hunter';
import { findEmailWithRegex } from './lib/email-parser';

async function run() {
  const domain = 'aurionstack.dev'; // We will use your domain for the test
  
  // We will simulate the Jina website scrape with some fake markdown
  const websiteText = `
    # Welcome to Aurion Stack
    We build custom software.
    Contact us at hello@aurionstack.dev or sales@aurionstack.dev.
    Do not email fake_image@2x.png.
  `;

  console.log(`\n🚀 [TEST] Running concurrent email discovery for ${domain}...`);
  console.log(`------------------------------------------------------`);
  
  // 1. Concurrent Fetch
  console.log(`1. Firing Apollo and Hunter APIs concurrently...`);
  console.log(`2. Scraping website text simultaneously...`);
  
  const [apolloResult, hunterResult] = await Promise.allSettled([
    findEmailWithApollo(domain),
    findEmailWithHunter(domain)
  ]);
  
  const regexResult = findEmailWithRegex(websiteText);
  
  // 2. Aggregation Pool
  console.log(`\n⚙️ [TEST] Aggregating and deduplicating results...`);
  const emailPool = new Map();
  
  if (apolloResult.status === 'fulfilled' && apolloResult.value) {
    console.log(`   -> Apollo found: ${apolloResult.value.length} emails`);
    apolloResult.value.forEach(e => emailPool.set(e.email.toLowerCase(), e));
  } else {
    console.log(`   -> Apollo failed:`, apolloResult);
  }
  
  if (hunterResult.status === 'fulfilled' && hunterResult.value) {
    console.log(`   -> Hunter found: ${hunterResult.value.length} emails`);
    hunterResult.value.forEach(e => {
      if (!emailPool.has(e.email.toLowerCase())) emailPool.set(e.email.toLowerCase(), e);
    });
  } else {
    console.log(`   -> Hunter failed:`, hunterResult);
  }
  
  console.log(`   -> Regex Scraper found: ${regexResult.length} emails`);
  regexResult.forEach(e => {
    if (!emailPool.has(e.email.toLowerCase())) emailPool.set(e.email.toLowerCase(), e);
  });

  const allFoundEmails = Array.from(emailPool.values());
  
  console.log('\n🎯 --- FINAL AGGREGATED EMAIL POOL (Sent to Gemini) ---');
  console.log(JSON.stringify(allFoundEmails, null, 2));
}

run();
