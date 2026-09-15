import { createClient } from '@/lib/supabase-server';

export async function getCurrentOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).limit(1).maybeSingle();
  if (error) {
    console.error('[tenancy] Unable to resolve organization:', error.message);
    return null;
  }
  return data?.organization_id ?? null;
}
