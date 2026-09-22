# AurionStack Automation Hub

AurionStack is a Next.js and Supabase workspace for independent operational automation tools. Authentication, tenancy, provider settings, and safety infrastructure are shared; business data and workflows remain owned by each tool.

## Current modules

### Lead Recovery

The existing production workflow for US home-service companies. It discovers companies with Apify, enriches and qualifies them with Hunter and Gemini, prepares personalized outreach, sends through the guarded SMTP queue, and tracks replies and suppressions.

Its existing `leads`, `scrape_jobs`, `search_configs`, `outreach_queue`, `email_events`, and `email_suppressions` tables remain unchanged. The module boundary is introduced incrementally under `lib/tools/lead-recovery` to avoid a risky database rename.

Canonical UI: `/dashboard/lead-recovery`

### YouTube Creator Outreach

A separate creator-acquisition module for established English-speaking channels that publish active long-form content and underuse Shorts. It has dedicated creator, campaign, queue, event, and note models. It does not use the Lead Recovery `leads` table.

The module includes scheduled YouTube Data API discovery, deterministic qualification from channel statistics and recent upload durations, public channel-description email provenance, Hunter mailbox verification, a dedicated guarded queue, SMTP delivery, provider-event tracking, reply-stop behavior, and creator-specific unsubscribe handling. Campaigns remain paused by default and require an exact authenticated activation confirmation.

Canonical UI: `/dashboard/youtube-outreach`

## Route structure

```text
/dashboard                              Automation Hub
/dashboard/lead-recovery                Lead Recovery overview
/dashboard/lead-recovery/prospects      Company prospect review
/dashboard/lead-recovery/campaigns      Discovery runs
/dashboard/lead-recovery/inbox          Sent outreach
/dashboard/lead-recovery/job/[id]       Discovery-run prospects
/dashboard/lead-recovery/settings       Search targets
/dashboard/youtube-outreach             Creator pipeline overview
/dashboard/youtube-outreach/creators    Creator records
/dashboard/youtube-outreach/campaigns   Creator campaigns
/dashboard/youtube-outreach/replies     Creator replies
/dashboard/youtube-outreach/automation  Paused daily configuration
/dashboard/youtube-outreach/settings    Tool policy and dependencies
/dashboard/integrations                 Shared provider credentials
```

Compatibility redirects remain for `/dashboard/job/[id]`, `/dashboard/settings`, and `/dashboard/api-keys`. Production cron, webhook, email, and unsubscribe endpoints are unchanged. Namespaced API endpoints are introduced incrementally under `/api/tools/<tool-id>`.

## Directory boundaries

```text
app/dashboard/                 Protected platform and tool routes
app/api/tools/                 New tool-namespaced API surface
components/hub/                Automation Hub UI
components/shared/             Reusable platform/tool shell
components/tools/              Tool-specific UI
lib/tools/registry.ts          Static typed automation registry
lib/tools/lead-recovery/       Lead Recovery service and policy boundary
lib/tools/youtube-outreach/    YouTube creator service, types, and defaults
lib/mcp/                       Authenticated MCP server, action catalog, audit and auth
lib/email/                     Shared guarded delivery infrastructure
supabase/migrations/           Additive schema changes
```

## Adding another automation tool

1. Add a typed entry to `lib/tools/registry.ts`.
2. Create tool-owned routes under `app/dashboard/<tool-id>`.
3. Add a tool service and types under `lib/tools/<tool-id>`.
4. Use dedicated tables for tool-specific data. Reference `organization_id` and enable tenant RLS.
5. Reuse shared auth, integrations, rate limits, and UI primitives rather than duplicating them.
6. Add only business-domain MCP actions and leave high-risk actions disabled until server-side authorization and safety checks exist.
7. Add tests and run the full validation suite.

## Database setup

Apply migrations in numerical order. They are never applied automatically by the application.

- `009_add_outreach_postal_address.sql` adds the CAN-SPAM sender address required by the shared email provider.
- `010_youtube_outreach_foundation.sql` adds `youtube_creators`, `youtube_campaigns`, `youtube_outreach_queue`, `youtube_outreach_events`, and `youtube_creator_notes` with tenant RLS and paused defaults.
- `011_mcp_observability.sql` adds metadata-only MCP audit logs and distributed request limiting.
- `012_revqr_whatsapp_sales_engine.sql` adds tenant-isolated RevQR campaigns, consent-aware prospects, conversations, messages, jobs, and audit events. It creates no campaign and sends nothing.

Migration 010 inserts no records and activates no campaign. The YouTube UI degrades to safe preview defaults until it is applied.

## Shared infrastructure

- Supabase Auth and the root dashboard layout protect every `/dashboard/*` route.
- Supabase organization membership scopes browser reads and writes through RLS.
- Provider credentials are organization-owned and configured at `/dashboard/integrations`.
- Lead Recovery keeps its suppression, unsubscribe, bounce, reply-stop, daily-limit, sender, postal-address, and duplicate protections.
- YouTube creator emails require recorded public provenance and Hunter verification. Its queue defaults to `paused`, uses the shared suppression and sender controls, and only becomes eligible after deliberate campaign activation.

## Read-only MCP control layer

The production app exposes a Streamable HTTP MCP endpoint at `/mcp`. It uses Supabase Auth as an OAuth 2.1 authorization server, resolves the authenticated user's organization on every request, relies on tenant RLS for business reads, and records metadata-only tool audit events. The endpoint exposes exactly these Phase 2 tools:

```text
lead_recovery.get_status
lead_recovery.list_prospects
lead_recovery.get_replies
lead_recovery.get_stats
youtube.get_status
youtube.list_creators
youtube.get_replies
youtube.get_stats
```

No write, scraping, campaign activation, queueing, generic SQL, or outreach operation is registered with the MCP server. The action catalog keeps preview and outreach actions disabled.

### Supabase OAuth setup

1. Apply migrations 009, 010, and 011 manually in order.
2. In Supabase Dashboard → Authentication → OAuth Server, enable OAuth 2.1.
3. Set the authorization path to `/oauth/consent` and keep the Supabase Site URL pointed at the production app origin.
4. Enable dynamic client registration for MCP clients and require user approval.
5. Prefer an asymmetric JWT signing key (RS256 or ES256) so access tokens can be validated through JWKS.
6. Confirm the OAuth discovery document is reachable at `https://<project-ref>.supabase.co/.well-known/oauth-authorization-server/auth/v1`.

The MCP protected-resource document is published at `/.well-known/oauth-protected-resource`, and unauthenticated `/mcp` requests return the matching `WWW-Authenticate` discovery challenge.

### Connect from ChatGPT

After deploying the app and completing the Supabase OAuth setup:

1. Enable Developer Mode in ChatGPT under Settings → Apps & Connectors → Advanced settings.
2. Create an app using `https://<your-production-domain>/mcp`.
3. Complete the AurionStack consent screen with an existing workspace account.
4. Refresh the app after changing MCP tool metadata so ChatGPT reloads the descriptors.

Use a stable HTTPS production URL. A tunnel may be used only for local testing.

## Local setup

Apify supports a server-only `APIFY_FALLBACK_TOKEN` environment variable. Workspace tokens take precedence over `APIFY_TOKEN`; the secondary token is tried on credit/usage-limit rejections. Dataset reads also try the secondary token on access errors so fallback-account runs can be imported. Run creation is never retried after network timeouts or server errors, which could otherwise create duplicate paid runs. A second token for the same Apify account shares that account's credit limits. Set the fallback variable in Vercel Production and Preview, then redeploy to enable it there.

Production builds use `next build --webpack` to avoid the Turbopack build process hanging on the deployment runner. Development continues to use Turbopack. If a deployment still stalls immediately after `npm run build`, redeploy once with **Use existing Build Cache** disabled in Vercel. Keep the Vercel project Node.js setting on 22.x to match `package.json`.

Set the server-only `EMAIL_REPLY_TO` environment variable to the inbox that should receive prospect replies. The visible sender remains the workspace `from_email`; the delivery worker adds `Reply-To` from this variable. Existing messages retain the reply address they were originally sent with.

### Gmail reply synchronization

`/api/cron/sync-replies` performs a metadata-only Gmail inbox scan for recent messages with `In-Reply-To` headers. It never downloads or stores message bodies. A matched reply records the lead as replied and stops pending follow-ups through the existing service guardrails.

Configure a Google OAuth client and issue the refresh token with the narrow `gmail.metadata` scope, then add `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` to Vercel Production and Preview. The scheduled GitHub workflow calls the sync every five minutes. Without these variables the endpoint reports `configured: false` and performs no mailbox access.

Newly selected lead addresses are checked with Hunter's email verifier before initial outreach is queued. Candidate provenance, verification result, and timestamp are preserved in `alternative_emails`; only a `valid` result can enter the initial email queue.

1. Use Node.js 22.
2. Copy `.env.local.example` to `.env.local` and configure only the providers you use.
3. Apply the required Supabase migrations manually.
4. Run `npm run dev`.

Production scheduling remains in GitHub Actions. Do not duplicate those schedules in Vercel.

### YouTube Creator Outreach automation

Enable YouTube Data API v3 in a Google Cloud project and configure the server-only `YOUTUBE_API_KEY` in Vercel Production and Preview. The daily discovery worker rotates through campaign niches, inspects channel statistics and the latest eight uploads, and only stores an email when it appears publicly in the channel description. Hunter must verify that mailbox as `valid` before the creator can be qualified or queued.

Saving a campaign always stores it paused. Activation requires typing `ACTIVATE YOUTUBE OUTREACH` in the authenticated dashboard and is refused unless the YouTube key, Hunter verifier, workspace SMTP credentials, matching sender identity, postal address, and non-zero daily limits are ready. The five-minute sender enforces campaign daily limits, suppression, unsubscribe, reply-stop, and provider-event handling.

### RevQR WhatsApp Sales Engine

Apply migration 012, then configure `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, and (optionally) `WHATSAPP_GRAPH_API_VERSION`. Configure `REVQR_ONBOARDING_WEBHOOK_URL` and `REVQR_ONBOARDING_WEBHOOK_SECRET` for the RevQR product endpoint that provisions the customer account, QR asset, and stand artwork. In Meta, use `https://<production-domain>/api/webhooks/whatsapp` as the webhook callback, enter the same verification token, and subscribe the WhatsApp phone number to the `messages` field.

Create the paused campaign at `/dashboard/revqr-whatsapp/campaigns`, including the Meta phone-number ID, demo URL, payment URL, daily limit, and an approved follow-up template. One deliberate activation enables unattended processing after that point. Incoming WhatsApp messages record inbound consent, open the 24-hour customer-service window, classify intent, and queue a guarded response. STOP/not-interested language revokes consent and cancels pending work immediately. Free-form messages are blocked outside the service window; the single delayed follow-up requires an approved Meta template. Delivery/read/failure webhooks update message state. When a customer supplies both a logo image and Google Review URL, the worker securely downloads the logo from Meta and calls the configured RevQR onboarding webhook as multipart form data. That endpoint must return `customer_url`, `qr_asset_url`, and `standee_asset_url`.

Discovered phone numbers are never treated as consent and cannot enter this sender. Lead sourcing can be added independently, but outbound initiation must retain verifiable permission and use an approved template under current WhatsApp Business rules.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Never use development or refactor work to activate a campaign, run Apify/Hunter, or send real outreach.
