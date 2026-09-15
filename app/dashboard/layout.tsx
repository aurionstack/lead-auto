import { hasDashboardSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasDashboardSession())) redirect('/login');
  return children;
}

export const dynamic = 'force-dynamic';
