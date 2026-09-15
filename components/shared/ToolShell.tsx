'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Menu, Radar, Video as Youtube, X } from 'lucide-react';
import { useState } from 'react';
import BrandMark from './BrandMark';
import LogoutButton from './LogoutButton';

export interface ToolNavItem {
  label: string;
  href: string;
}

interface ToolShellProps {
  title: string;
  description: string;
  icon: 'radar' | 'youtube';
  status: string;
  navigation: ToolNavItem[];
  children: React.ReactNode;
}

export default function ToolShell({ title, description, icon, status, navigation, children }: ToolShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const ToolIcon = icon === 'youtube' ? Youtube : Radar;

  const isActive = (href: string) => pathname === href || (href !== navigation[0]?.href && pathname.startsWith(`${href}/`));

  return (
    <div className="min-h-screen bg-[#080a10] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/[0.07] bg-[#0b0e14] p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0`}>
          <div className="flex items-center justify-between px-2">
            <Link href="/dashboard" aria-label="AurionStack Automation Hub"><BrandMark /></Link>
            <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-slate-500 hover:bg-white/5 lg:hidden" aria-label="Close navigation"><X className="size-5" /></button>
          </div>

          <Link href="/dashboard" className="mt-7 inline-flex items-center gap-2 px-3 text-xs font-medium text-slate-500 hover:text-slate-200">
            <ArrowLeft className="size-3.5" /> Back to automations
          </Link>

          <div className="mt-6 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
            <div className="flex items-center gap-3">
              <span className={`grid size-10 place-items-center rounded-xl ${icon === 'youtube' ? 'bg-rose-400/10 text-rose-300' : 'bg-indigo-400/10 text-indigo-300'}`}><ToolIcon className="size-5" /></span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{title}</p><p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">{status}</p></div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">{description}</p>
          </div>

          <nav className="mt-7 space-y-1" aria-label={`${title} navigation`}>
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">Tool workspace</p>
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`flex items-center rounded-xl px-3 py-2.5 text-sm font-medium ${isActive(item.href) ? 'bg-indigo-400/10 text-indigo-200 ring-1 ring-inset ring-indigo-400/15' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white'}`}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-auto border-t border-white/[0.06] pt-4"><LogoutButton /></div>
        </aside>

        {mobileOpen && <button className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation overlay" />}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-[#080a10]/90 px-4 backdrop-blur-xl sm:px-7 lg:hidden">
            <button onClick={() => setMobileOpen(true)} className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-slate-300" aria-label="Open navigation"><Menu className="size-5" /></button>
            <ToolIcon className="size-5 text-indigo-300" />
            <span className="text-sm font-semibold text-white">{title}</span>
          </header>
          <main className="px-4 py-6 sm:px-7 lg:px-10 lg:py-9">{children}</main>
        </div>
      </div>
    </div>
  );
}
