'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080a10] p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-red-400/15 bg-[#11141c] p-8 text-center shadow-2xl">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-red-400/10 text-red-300">
          <AlertTriangle className="size-5" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Workspace temporarily unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">Your data is safe. We could not load the latest workspace state.</p>
        <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200">
          <RefreshCw className="size-4" /> Try again
        </button>
      </div>
    </main>
  );
}
