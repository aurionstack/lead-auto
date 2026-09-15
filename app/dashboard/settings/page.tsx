import { redirect } from 'next/navigation';

export default function LegacySettingsPage() {
  redirect('/dashboard/lead-recovery/settings');
}
