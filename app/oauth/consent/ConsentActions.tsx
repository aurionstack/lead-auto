'use client';

import { useState } from 'react';

export default function ConsentActions({ authorizationId }: { authorizationId: string }) {
  const [pending, setPending] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'approve' | 'deny') {
    if (pending) return;
    setPending(decision);
    setError(null);
    try {
      const response = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorizationId, decision }),
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.redirectUrl !== 'string') throw new Error(payload.error || 'Authorization failed.');
      window.location.assign(payload.redirectUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Authorization failed.');
      setPending(null);
    }
  }

  return (
    <div className="mt-8">
      {error && <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={Boolean(pending)} onClick={() => decide('deny')} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-50">
          {pending === 'deny' ? 'Denying…' : 'Deny'}
        </button>
        <button type="button" disabled={Boolean(pending)} onClick={() => decide('approve')} className="rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50">
          {pending === 'approve' ? 'Connecting…' : 'Allow read-only access'}
        </button>
      </div>
    </div>
  );
}
