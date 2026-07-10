import { redirect } from 'next/navigation';

// Root route redirects to the dashboard.
// Middleware will further redirect to /login if not authenticated.
export default function RootPage() {
  redirect('/dashboard');
}
