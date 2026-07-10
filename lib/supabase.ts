// ============================================================
// src/lib/supabase.ts
// SERVER-SIDE ONLY — Never import this in client components.
//
// SECURITY GUARANTEE:
//   - Uses SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix)
//   - This client is never passed to client components as a prop
//   - The supabaseAdmin client bypasses RLS intentionally,
//     allowing our API routes to read/write the leads table
//   - The anon role (used by client-side code) has ZERO access
//     per the RLS policies in 001_leads_schema.sql
//
// LAZY INITIALIZATION:
//   - The client is created on first use (not at module load time)
//   - This prevents Next.js build from throwing on missing env vars
//     for pages marked force-dynamic (which never run at build time)
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Module-level singleton — initialized once on first call
let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      '[supabase.ts] Missing NEXT_PUBLIC_SUPABASE_URL. ' +
      'Add it to your .env.local file.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      '[supabase.ts] Missing SUPABASE_SERVICE_ROLE_KEY. ' +
      'This key must NOT have a NEXT_PUBLIC_ prefix — ' +
      'it bypasses all RLS policies and must stay server-side only.'
    );
  }

  _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable session handling — this is a server-side service client,
      // not a user-facing auth client.
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  return _supabaseAdmin;
}

// Export as a Proxy so call sites use `supabaseAdmin.from(...)` naturally,
// but the actual client is created lazily on first property access.
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});
