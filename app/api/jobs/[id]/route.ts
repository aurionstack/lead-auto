import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { hasDashboardSession } from '@/lib/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await hasDashboardSession())) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    // Because we set up `ON DELETE CASCADE` in the database,
    // deleting the job will also delete all associated leads automatically.
    const { error } = await supabaseAdmin
      .from('scrape_jobs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[jobs] Error deleting job:', error);
      return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (error: unknown) {
    console.error('[jobs] Unexpected error deleting job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
