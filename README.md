# AurionStack Automation Hub

AurionStack is a Next.js and Supabase workspace for independent operational automation tools. Authentication, tenancy, provider settings, and safety infrastructure are shared; business data and workflows remain owned by each tool.

## Current modules

### Lead Recovery

The existing production workflow for US home-service companies. It discovers companies with Apify, enriches and qualifies them with Hunter and Gemini, prepares personalized outreach, sends through the guarded SMTP queue, and tracks replies and suppressions.

Its existing `leads`, `scrape_jobs`, `search_configs`, `outreach_queue`, `email_events`, and `email_suppressions` tables remain unchanged. The module boundary is introduced incrementally under `lib/tools/lead-recovery` to avoid a risky database rename.

Canonical UI: `/dashboard/lead-recovery`

### YouTube Creator Outreach

A separate creator-acquisition module for established English-speaking channels that publish active long-form content and underuse Shorts. It has dedicated creator, campaign, queue, event, and note models. It does not use the Lead Recovery `leads` table.

This release provides the module dashboard, creator pipeline, paused campaign configuration, and database foundation. It does **not** implement creator discovery, vidIQ access, scheduled automation, or live email sending.

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

Migration 010 inserts no records and activates no campaign. The YouTube UI degrades to safe preview defaults until it is applied.

## Shared infrastructure

- Supabase Auth and the root dashboard layout protect every `/dashboard/*` route.
- Supabase organization membership scopes browser reads and writes through RLS.
- Provider credentials are organization-owned and configured at `/dashboard/integrations`.
- Lead Recovery keeps its suppression, unsubscribe, bounce, reply-stop, daily-limit, sender, postal-address, and duplicate protections.
- YouTube creator emails require recorded public provenance, and its future queue defaults to `paused`.

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

1. Use Node.js 22.
2. Copy `.env.local.example` to `.env.local` and configure only the providers you use.
3. Apply the required Supabase migrations manually.
4. Run `npm run dev`.

Production scheduling remains in GitHub Actions. Do not duplicate those schedules in Vercel.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Never use development or refactor work to activate a campaign, run Apify/Hunter, or send real outreach.
