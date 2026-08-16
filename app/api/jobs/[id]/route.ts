import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
  } catch (error: any) {
    console.error('[jobs] Unexpected error deleting job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
