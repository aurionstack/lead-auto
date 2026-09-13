// ============================================================
// src/app/api/leads/[id]/route.ts
//
// LEAD STATUS UPDATE ENDPOINT
// ============================================================
//
// PATCH /api/leads/:id
//   Body: { "status": "contacted" | "rejected" | "approved" }
//
// Used by the dashboard client to:
//   - Mark a lead as 'contacted' when WhatsApp is opened
//   - Mark a lead as 'rejected' to remove from active view
//   - Update the drafted_pitch if the user edits it
//
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasDashboardSession } from '@/lib/auth';
import type { LeadStatus } from '@/lib/types';

const VALID_STATUSES: LeadStatus[] = ['new', 'approved', 'contacted', 'rejected'];

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  // ── 1. Verify session cookie (dashboard actions are gated) ─
  if (!(await hasDashboardSession())) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. Extract and validate lead ID ───────────────────────
  const { id } = await params;

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Invalid lead ID.' }, { status: 400 });
  }

  // ── 3. Parse request body ──────────────────────────────────
  let body: { status?: LeadStatus; drafted_pitch?: string; drafted_email_pitch?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Build the update payload — only include provided fields
  const updatePayload: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    updatePayload.status = body.status;
  }

  if (body.drafted_pitch !== undefined) {
    if (typeof body.drafted_pitch !== 'string') {
      return NextResponse.json({ error: 'drafted_pitch must be a string.' }, { status: 400 });
    }
    updatePayload.drafted_pitch = body.drafted_pitch;
  }

  if (body.drafted_email_pitch !== undefined) {
    if (typeof body.drafted_email_pitch !== 'string') {
      return NextResponse.json({ error: 'drafted_email_pitch must be a string.' }, { status: 400 });
    }
    updatePayload.drafted_email_pitch = body.drafted_email_pitch;
  }

  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update.' },
      { status: 400 }
    );
  }

  // ── 4. Update lead in Supabase (service role bypasses RLS) ─
  let updateQuery = supabaseAdmin
    .from('leads')
    .update(updatePayload)
    .eq('id', id);
  if (body.status !== undefined) {
    updateQuery = updateQuery.in('status', ['new', 'approved']);
  }
  const { data, error } = await updateQuery
    .select('id, status, drafted_pitch, drafted_email_pitch')
    .maybeSingle();

  if (error) {
    console.error(`[leads/[id]] Error updating lead ${id}:`, error);
    return NextResponse.json(
      { error: 'Database update failed.', detail: error.message },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Lead not found or is no longer actionable.' }, { status: 409 });
  }

  return NextResponse.json({ success: true, lead: data });
}
