'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const handleLogout = async () => {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <button onClick={handleLogout} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-slate-500 hover:bg-white/[0.04] hover:text-slate-200">
      <LogOut className="size-4" />
      {!compact && 'Sign out'}
    </button>
  );
}
