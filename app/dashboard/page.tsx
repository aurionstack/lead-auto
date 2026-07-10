// ============================================================
// app/dashboard/page.tsx — Dashboard Server Component
// ============================================================
// Fetches leads server-side using the service role key.
// Only plain Lead[] crosses the server/client boundary —
// supabaseAdmin is NEVER passed as a prop to DashboardClient.
// ============================================================

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import type { Lead } from '@/lib/types';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { Loader2 } from 'lucide-react';

// ── Mock data for development / demo when Supabase is not configured ──
const MOCK_LEADS: Lead[] = [
  {
    id: 'mock-1',
    business_name: 'Azure Yacht Charters',
    phone: '+971501234567',
    google_maps_url: 'https://maps.google.com/?cid=mock1',
    category: 'Boat Tour Agency',
    rating: 4.8,
    review_count: 312,
    address: 'Dubai Marina, Dubai, UAE',
    opportunity_score: 91,
    ai_reasoning:
      'With 312 reviews and a 4.8-star rating, this business has strong social proof but zero digital advertising infrastructure — a prime candidate for a Click-to-WhatsApp acquisition funnel. High review velocity signals active bookings, making this an immediate high-value B2B opportunity.',
    drafted_pitch:
      "Hi! I came across Azure Yacht Charters on Google — 312 reviews at 4.8 stars is genuinely impressive 🚢. We help premium charter businesses in Dubai turn their Google visibility into instant WhatsApp booking conversations. Could I show you a 5-minute demo of how it works for businesses exactly like yours?",
    status: 'new',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'mock-2',
    business_name: 'Desert Rose Luxury Villas',
    phone: '+971509876543',
    google_maps_url: 'https://maps.google.com/?cid=mock2',
    category: 'Vacation Home Rental',
    rating: 4.6,
    review_count: 187,
    address: 'Palm Jumeirah, Dubai, UAE',
    opportunity_score: 83,
    ai_reasoning:
      'This villa rental operator has substantial organic reach — 187 reviews with consistent 4.6-star performance — yet relies entirely on OTA platforms with no owned digital channel. A WhatsApp template system would recapture repeat guests outside platform commission fees.',
    drafted_pitch:
      "Hello! Saw Desert Rose Luxury Villas on Google Maps — 187 reviews at 4.6★ is a strong signal your guests love you. We build Click-to-WhatsApp systems for luxury villa operators so returning guests can book directly with you (bypassing Airbnb fees). Would a quick call this week make sense?",
    status: 'new',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'mock-3',
    business_name: 'Grand Fleet Self-Drive',
    phone: '+971521112233',
    google_maps_url: 'https://maps.google.com/?cid=mock3',
    category: 'Car Rental',
    rating: 4.3,
    review_count: 524,
    address: 'Deira, Dubai, UAE',
    opportunity_score: 76,
    ai_reasoning:
      'A self-drive fleet operator with 524 reviews is generating significant demand but handling all bookings manually by phone — a WhatsApp template flow would dramatically reduce friction in the conversion path. Mid-tier score due to existing website presence, though no chatbot automation observed.',
    drafted_pitch:
      "Hi! Grand Fleet Self-Drive comes up highly on Google with 524 reviews at 4.3★ — that's a lot of inbound interest. We automate the booking conversation for car rental businesses via WhatsApp so your team spends less time on calls and more time on the road. Worth a 10-minute look?",
    status: 'contacted',
    created_at: new Date(Date.now() - 14400000).toISOString(),
  },
  {
    id: 'mock-4',
    business_name: 'Meridian Dive Center',
    phone: '+971554445566',
    google_maps_url: 'https://maps.google.com/?cid=mock4',
    category: 'Diving & Water Sports',
    rating: 4.9,
    review_count: 89,
    address: 'Jumeirah Beach Road, Dubai, UAE',
    opportunity_score: 64,
    ai_reasoning:
      'Exceptional 4.9-star rating with 89 reviews suggests a highly satisfied niche clientele, but low volume indicates undiscovered potential rather than scale. WhatsApp automation would capture enquiries from Google discovery before they bounce to competitors.',
    drafted_pitch:
      "Hello! Meridian Dive Center is sitting at a remarkable 4.9★ on Google — that's top 1% in Dubai. We help specialist activity businesses like yours convert Google searches into instant WhatsApp enquiries automatically. Happy to show you a live example?",
    status: 'new',
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: 'mock-5',
    business_name: 'Falcon Premium Car Rental',
    phone: '+971567778899',
    google_maps_url: 'https://maps.google.com/?cid=mock5',
    category: 'Luxury Car Rental',
    rating: 4.5,
    review_count: 203,
    address: 'Sheikh Zayed Road, Dubai, UAE',
    opportunity_score: 0,
    ai_reasoning: null,
    drafted_pitch: null,
    status: 'new',
    created_at: new Date(Date.now() - 28800000).toISOString(),
  },
];

// ── Check if Supabase is properly configured ──────────────────
function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return (
    url.startsWith('https://') &&
    !url.includes('your-project-ref') &&
    key.startsWith('eyJ') &&
    !key.includes('replace_with')
  );
}

async function fetchLeads(): Promise<{ leads: Lead[]; isMockData: boolean }> {
  // Fall back to mock data when Supabase is not yet configured
  if (!isSupabaseConfigured()) {
    console.log(
      '[dashboard] Supabase not configured — showing mock data for UI preview. ' +
      'Add real credentials to .env.local to connect to your database.'
    );
    return { leads: MOCK_LEADS, isMockData: true };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .neq('status', 'rejected')
      .order('opportunity_score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[dashboard] Supabase fetch error:', error.message);
      return { leads: MOCK_LEADS, isMockData: true };
    }

    return { leads: (data ?? []) as Lead[], isMockData: false };
  } catch (err) {
    console.error('[dashboard] Unexpected fetch error:', err);
    return { leads: MOCK_LEADS, isMockData: true };
  }
}

export default async function DashboardPage() {
  const { leads, isMockData } = await fetchLeads();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
      </div>
    }>
      {/* Only plain Lead[] data passed here — NOT the supabaseAdmin client */}
      <DashboardClient initialLeads={leads} isMockData={isMockData} />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
