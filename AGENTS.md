<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AurionStack architecture rules

1. AurionStack is the umbrella platform. Do not brand the entire application as LeadFlow or as one tool.
2. Every automation product is an isolated module with its own routes, service boundary, types, and business-specific tables.
3. Authentication, organizations, provider credentials, rate limiting, audit infrastructure, notifications, and the design system belong to shared platform code.
4. Never add one tool's domain fields to another tool's tables. In particular, YouTube creator fields do not belong in `leads`.
5. Do not send production outreach, invoke scraping/enrichment providers, or activate campaigns during development or refactoring.
6. Campaigns and outreach queues must be paused by default. Activation requires a deliberate, authorized user action.
7. Never bypass suppression, unsubscribe, bounce, reply-stop, daily-limit, sender, or postal-address protections.
8. MCP actions must be business-domain operations that call service-layer guardrails. Do not expose generic unrestricted email, SQL, or provider-call tools.
9. Preserve legacy routes, cron endpoints, webhooks, unsubscribe URLs, and API behavior where reasonable. Production-sensitive migrations should be incremental.
10. Preserve stable Lead Recovery behavior unless a change is required and validated. Prefer adapters and service wrappers over broad rewrites.
11. Never commit API keys, credentials, tokens, customer data, or populated local environment files.
12. Database migrations must be additive and reversible where practical. Never apply a production migration automatically without explicit authorization.
13. Resolve the active organization on every tenant-owned mutation. Do not rely on client-provided organization IDs.
14. Run lint, TypeScript validation, tests, and a production build before declaring work complete.

## Module map

- `lib/tools/registry.ts` is the typed product registry used by the Automation Hub.
- `lib/tools/lead-recovery/` owns Lead Recovery service and policy boundaries while legacy tables remain unchanged.
- `lib/tools/youtube-outreach/` owns creator types, defaults, and services.
- `components/shared/` contains platform and tool-shell UI.
- `components/tools/<tool-id>/` contains tool-specific UI.
- `lib/mcp/action-registry.ts` documents future MCP-facing business actions. Entries stay disabled until their guarded service implementations exist.
