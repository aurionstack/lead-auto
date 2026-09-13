import { createClient } from '@supabase/supabase-js';
import { buildOutreachHtml, buildOutreachText } from '../lib/email/templates';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl } from '../lib/email/unsubscribe';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Mock WebSocket for Node 20 compatibility
if (!globalThis.WebSocket) {
  globalThis.WebSocket = class {} as any;
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Fetching stuck leads...");
  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('status', 'new')
    .gt('opportunity_score', 0)
    .not('email', 'is', null)
    .not('drafted_email_pitch', 'is', null);

  if (error) {
    console.error("Error fetching leads:", error);
    process.exit(1);
  }

  console.log(`Found ${leads?.length || 0} stuck leads to process.`);

  let successCount = 0;
  for (const lead of leads || []) {
    const businessName = lead.business_name || 'Business Owner';
    const draft = lead.drafted_email_pitch;
    const unsubscribeLink = buildUnsubscribeUrl(lead.id);
    
    const html = buildOutreachHtml({ businessName, body: draft, unsubscribeLink });
    const text = buildOutreachText({ businessName, body: draft, unsubscribeLink });
    const subject = `Partnership Inquiry - ${businessName}`;
    
    const { error: queueError } = await supabaseAdmin
      .from('outreach_queue')
      .insert({
        lead_id: lead.id,
        target_email: lead.email,
        subject,
        body_html: html,
        body_text: text,
        unsubscribe_url: buildOneClickUnsubscribeUrl(lead.id),
        status: 'pending',
        organization_id: lead.organization_id
      });

    if (queueError) {
      console.error(`Failed to queue lead ${lead.id}:`, queueError);
      continue;
    }

    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({ status: 'approved' })
      .eq('id', lead.id);

    if (updateError) {
      console.error(`Failed to update lead ${lead.id}:`, updateError);
    } else {
      successCount++;
    }
  }

  console.log(`Successfully moved ${successCount} leads into the outreach queue!`);
}

run();
