import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lead Automation System',
  description: 'Internal lead scoring, AI analysis, and WhatsApp outreach dashboard.',
  robots: 'noindex, nofollow', // Internal tool — prevent search engine indexing
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
