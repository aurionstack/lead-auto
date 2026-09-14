import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LeadFlow — AI outreach operations',
    template: '%s | LeadFlow',
  },
  description: 'Discover, qualify, and reach the right prospects from one intelligent workspace.',
  applicationName: 'LeadFlow',
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        {children}
      </body>
    </html>
  );
}
