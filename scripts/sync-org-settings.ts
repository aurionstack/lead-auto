import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { supabaseAdmin } from '../lib/supabase';

async function syncOrgSettings() {
  const orgId = 'b83bd0e8-3607-420b-ad69-51e7360b86ed';
  const hunterKey = process.env.HUNTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const apifyToken = process.env.APIFY_TOKEN;
  const placeholderAddress = '100 Innovation Way, Suite 400, Austin, TX 78701';

  console.log('Updating organization settings for org:', orgId);
  const updates: Record<string, string | null> = {
    postal_address: placeholderAddress,
    updated_at: new Date().toISOString(),
  };

  if (hunterKey) updates.hunter_api_key = hunterKey;
  if (geminiKey) updates.gemini_api_key = geminiKey;
  if (apifyToken) updates.apify_api_token = apifyToken;

  const { data, error } = await supabaseAdmin
    .from('organization_settings')
    .update(updates)
    .eq('organization_id', orgId)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating settings:', error);
    process.exit(1);
  }

  console.log('Successfully updated organization_settings:');
  console.log('  postal_address:', data.postal_address);
  console.log('  hunter_api_key configured:', Boolean(data.hunter_api_key));
  console.log('  gemini_api_key configured:', Boolean(data.gemini_api_key));
  console.log('  apify_api_token configured:', Boolean(data.apify_api_token));
}

syncOrgSettings();
