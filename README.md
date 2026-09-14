# Lead Automation System

An internal Next.js application that discovers businesses with Apify, enriches and scores them with Hunter and Gemini, routes qualified leads by channel, sends rate-limited SMTP outreach, and tracks replies and suppressions in Supabase.

## Production flow

1. `/api/cron/auto-scrape` runs daily and rotates through active search configurations.
2. Apify calls the authenticated `/api/webhooks/apify` endpoint and the dataset is upserted into `leads`.
3. `/api/cron/process-leads` atomically claims unprocessed leads, discovers email addresses, generates pitches, and queues qualified email leads.
4. `/api/cron/process-outreach` atomically claims due messages, enforces the UTC daily limit, rechecks suppressions, and sends through SMTP.
5. Provider webhooks record delivery activity. Bounces, complaints, and unsubscribes are added to the suppression list.

WhatsApp leads remain in the dashboard for manual outreach. Instantly is an optional manual action and is not part of the scheduled SMTP flow.

## Setup

1. Use Node.js 22 (`nvm use 22.20.0` on nvm-windows, or the version in `.nvmrc` on compatible managers).
2. Copy `.env.local.example` to `.env.local` and fill in every integration you use.
3. Apply every SQL migration in `supabase/migrations`, including `008_multi_tenant_schema.sql`.
4. Configure the application environment variables in Vercel.
5. Add `APP_URL` and `CRON_SECRET` as GitHub Actions repository secrets. `APP_URL` must be the production origin, such as `https://leads.example.com`, and `CRON_SECRET` must exactly match the value configured in Vercel.
6. Deploy the application and enable GitHub Actions. GitHub Actions is the only production scheduler; the project deliberately has no Vercel Cron configuration.

Important deployment secrets are `SESSION_SECRET`, `CRON_SECRET`, `UNSUBSCRIBE_SECRET`, and each webhook secret. If the dedicated session, unsubscribe, or Apify webhook secret is absent, the application temporarily falls back to `CRON_SECRET` for backward compatibility. Dedicated secrets are strongly recommended.

## Schedule

| Task | Schedule (UTC) | Purpose |
| --- | --- | --- |
| Lead scoring | Every 10 minutes | Enrich and qualify atomically claimed leads |
| Instantly push | Every 10 minutes, after lead scoring | Push newly qualified Instantly-channel leads |
| SMTP delivery | Every 5 minutes | Send due queue items, default batch 5 |
| Lead scraping | Daily at 00:00 | Scrape the least recently used search target |

`OUTREACH_DAILY_LIMIT` defaults to 30 and `OUTREACH_BATCH_SIZE` defaults to 5. Queue failures retry three times with exponential backoff. Stale locks are recovered, while ambiguous SMTP deliveries are quarantined to avoid accidental duplicate sends.

Scheduled workflows run from the repository's default branch. Keep the workflow enabled and monitor failed runs in the GitHub Actions tab. Do not recreate the same schedules in Vercel, because two schedulers would compete for the same work.

## Commands

```bash
npm install
npm run dev
npm run lint
npx tsc --noEmit
npm run build
```

## Security model

- Dashboard pages and mutation APIs require a signed HTTP-only JWT session.
- Cron and webhook endpoints fail closed when their secrets are absent or invalid.
- Supabase access is server-side through the service-role key; RLS denies browser roles.
- Queue claims use database row locking and one active message per lead.
- Email content is HTML-escaped and every message contains a signed unsubscribe link.
- Suppression checks fail closed if the suppression database cannot be queried.
