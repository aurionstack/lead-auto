import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

import { supabaseAdmin } from './lib/supabase';
import { findEmailWithApollo } from './lib/apollo';
import { findEmailWithHunter } from './lib/hunter';
import { findEmailWithRegex } from './lib/email-parser';

async function fetchWebsiteText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { 
      signal: controller.signal, 
      headers: { 
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown' 
      } 
    });
    clearTimeout(timeoutId);
    
    if (!res.ok) return 'Failed to load website via Jina (returned error code).';
    
    let text = await res.text();
    if (text.length > 4000) text = text.substring(0, 4000) + '\n...[TRUNCATED]';
    return text || 'Website loaded but no readable text found.';
  } catch (err: any) {
    clearTimeout(timeoutId);
    return 'Website failed to load or timed out.';
  }
}

async function run() {
  console.log(`\n🔍 [TEST] Fetching an authentic lead from Supabase...`);
  
  // Get 1 lead that has a website using Supabase REST API to avoid Node 20 websocket issues
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceKey) {
    console.error(`❌ Missing Supabase credentials in .env.local`);
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/leads?select=*&website=not.is.null&limit=1`, {
    headers: {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    }
  });

  if (!response.ok) {
    console.error(`❌ Failed to fetch lead from Supabase:`, await response.text());
    return;
  }
  
  const leads = await response.json();
  if (!leads || leads.length === 0) {
    console.error(`❌ No leads with websites found in the database.`);
    return;
  }
  
  const lead = leads[0];
  console.log(`\n------------------------------------------------------`);
  console.log(`🏢 Business: ${lead.business_name}`);
  console.log(`🌐 Website:  ${lead.website}`);
  console.log(`------------------------------------------------------`);
  
  let finalWebsite = lead.website;
  const domain = finalWebsite.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  
  console.log(`\n🚀 [TEST] Running concurrent email discovery for ${domain}...`);
  console.log(`1. Firing Apollo and Hunter APIs concurrently...`);
  console.log(`2. Scraping website text simultaneously via Jina Reader...`);
  
  const [apolloResult, hunterResult, websiteText] = await Promise.allSettled([
    findEmailWithApollo(domain),
    findEmailWithHunter(domain),
    fetchWebsiteText(finalWebsite)
  ]);
  
  const scrapedText = websiteText.status === 'fulfilled' ? websiteText.value : '';
  const regexResult = findEmailWithRegex(scrapedText);
  
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
