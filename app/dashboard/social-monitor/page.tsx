import { redirect } from 'next/navigation';

export default function SocialMonitorPage() {
  redirect('/dashboard/lead-recovery');
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
