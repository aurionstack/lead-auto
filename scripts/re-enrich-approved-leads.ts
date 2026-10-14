import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
import { supabaseAdmin } from '../lib/supabase';
import { findEmailWithHunter, getHunterApiKey, verifyEmailWithHunter } from '../lib/hunter';
import { buildOutreachHtml, buildOutreachText } from '../lib/email/templates';
import { buildOneClickUnsubscribeUrl, buildUnsubscribeUrl } from '../lib/email/unsubscribe';
import { addToQueue } from '../lib/email/queue';
import { isSuppressed } from '../lib/email/suppression';
import { campaignSequenceId } from '../lib/tools/lead-recovery/campaign';
import type { DiscoveredEmail } from '../lib/types';

async function reEnrichApprovedLeads() {
  console.log('=== RE-ENRICHING APPROVED LEADS MISSING EMAILS ===');
  
  const hunterKey = getHunterApiKey();
  if (!hunterKey) {
    console.error('Hunter API key is not configured.');
    process.exit(1);
  }

  const { data: leads, error } = await supabaseAdmin
    .from('leads')
    .select('id, business_name, website, status, drafted_email_pitch, opportunity_score, organization_id, alternative_emails')
    .eq('status', 'approved')
    .is('email', null)
    .not('website', 'is', null)
    .order('opportunity_score', { ascending: false });

  if (error || !leads) {
    console.error('Error fetching approved leads:', error);
    process.exit(1);
  }

  console.log(`Found ${leads.length} approved leads with website but no email.`);

  let enrichedCount = 0;
  let queuedCount = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const domain = lead.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].split('?')[0];
    if (!domain) continue;

    console.log(`\n[${i + 1}/${leads.length}] Checking ${lead.business_name} (${domain})...`);

    try {
      const hunterEmails = await findEmailWithHunter(domain, hunterKey);
      if (!hunterEmails || hunterEmails.length === 0) {
        console.log(`  No emails found via Hunter.`);
        continue;
      }

      console.log(`  Found ${hunterEmails.length} candidate email(s). Verifying...`);

      let selectedValidEmail: string | null = null;
      const candidates: DiscoveredEmail[] = [...hunterEmails];

      for (const candidate of candidates) {
        const verifyRes = await verifyEmailWithHunter(candidate.email, hunterKey);
        candidate.verificationStatus = verifyRes.status;
        candidate.verifiedAt = verifyRes.verifiedAt || undefined;

        if (verifyRes.status === 'valid') {
          candidate.selected = true;
          selectedValidEmail = candidate.email;
          console.log(`  Verified valid email: ${selectedValidEmail} (score: ${verifyRes.score})`);
          break;
        } else {
          console.log(`  Email ${candidate.email} not valid (${verifyRes.status})`);
        }
      }

      if (!selectedValidEmail) {
        console.log(`  None of the discovered emails passed verification.`);
        continue;
      }

      // Update lead in Supabase
      const { error: updateError } = await supabaseAdmin
        .from('leads')
        .update({
          email: selectedValidEmail,
          alternative_emails: candidates,
        })
        .eq('id', lead.id);

      if (updateError) {
        console.error(`  Failed to update lead ${lead.id}:`, updateError);
        continue;
      }

      enrichedCount++;
      console.log(`  Updated lead with verified email.`);

      // Check suppression and queue outreach
      if (await isSuppressed(selectedValidEmail)) {
        console.log(`  Email ${selectedValidEmail} is suppressed; skipping queue.`);
        continue;
      }

      // Check if already in queue
      const { data: existingQueue } = await supabaseAdmin
        .from('outreach_queue')
        .select('id')
        .eq('lead_id', lead.id)
        .in('status', ['pending', 'locked', 'sent'])
        .maybeSingle();

      if (existingQueue) {
        console.log(`  Lead already in queue (queue id: ${existingQueue.id}).`);
        continue;
      }

      const businessName = lead.business_name || 'Business Owner';
      const draft = lead.drafted_email_pitch || `We help ${businessName} recover missed inbound inquiries and convert them into scheduled jobs.`;
      const unsubscribeLink = buildUnsubscribeUrl(lead.id);
      const html = buildOutreachHtml({ businessName, body: draft, unsubscribeLink });
      const text = buildOutreachText({ businessName, body: draft, unsubscribeLink });
      const subject = `A missed-enquiry idea for ${businessName}`;

      await addToQueue({
        leadId: lead.id,
        subject,
        bodyHtml: html,
        bodyText: text,
        targetEmail: selectedValidEmail,
        unsubscribeUrl: buildOneClickUnsubscribeUrl(lead.id),
        campaignId: campaignSequenceId('initial'),
      }, lead.organization_id);

      queuedCount++;
      console.log(`  Successfully added to outreach queue!`);

      // Gentle pause to stay well within Hunter rate limits (10 req/sec)
      await new Promise((resolve) => setTimeout(resolve, 400));
    } catch (err: unknown) {
      console.error(`  Error processing lead ${lead.id}:`, err instanceof Error ? err.message : String(err));
    }
  }

  console.log(`\n=== RE-ENRICHMENT COMPLETE ===`);
  console.log(`Leads examined: ${leads.length}`);
  console.log(`Leads updated with valid email: ${enrichedCount}`);
  console.log(`Leads queued for outreach: ${queuedCount}`);
}

reEnrichApprovedLeads();
