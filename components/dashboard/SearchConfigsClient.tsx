'use client';

import { useState } from 'react';
import type { SearchConfig } from '@/lib/types';
import { Settings, Plus, Loader2, MapPin, Building2, Trash2, Mail, MessageCircle, Clock, LayoutDashboard, LogOut, Search, X } from 'lucide-react';
import Link from 'next/link';

interface Props {
  configs: SearchConfig[];
}

export default function SearchConfigsClient({ configs }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [channel, setChannel] = useState('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/login';
  };

  const handleAdd = async () => {
    if (!query.trim() || !location.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search_query: query.trim(), location: location.trim(), channel }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to add config');
      }
    } catch (err) {
      alert('Error adding config');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this search configuration?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/configs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to delete config');
      }
    } catch (err) {
      alert('Error deleting config');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white">
      {/* ── Top Navigation Bar ──────────────────────────────── */}
      <header className="h-14 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 transition-colors">
            <LayoutDashboard className="w-4 h-4 text-slate-400" />
          </Link>
          <div className="w-px h-4 bg-slate-800"></div>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <Settings className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Automation Settings</span>
            <span className="text-slate-500 text-xs ml-2">· Search Configs</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            View Campaigns
          </Link>

          <div className="w-px h-4 bg-slate-800 hidden sm:block"></div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold mb-1">Autonomous Search Targets</h1>
              <p className="text-sm text-slate-500">
                The daily Cron job will pick the oldest target in this list and automatically scrape it.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Target
            </button>
          </div>

          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Search Query</th>
                  <th className="px-6 py-4 font-medium">Location</th>
                  <th className="px-6 py-4 font-medium">Channel</th>
                  <th className="px-6 py-4 font-medium">Last Scraped</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {configs.map((config) => (
                  <tr key={config.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-slate-200">
                        <Building2 className="w-4 h-4 text-slate-500" />
                        {config.search_query}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <MapPin className="w-4 h-4 text-slate-500" />
                        {config.location}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {config.channel === 'whatsapp' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-900/50 text-xs font-medium">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/40 text-blue-400 border border-blue-900/50 text-xs font-medium">
                          <Mail className="w-3.5 h-3.5" /> Email
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-400 text-xs">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(config.last_scraped_at).getFullYear() === 1970 
                          ? 'Never' 
                          : new Date(config.last_scraped_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDelete(config.id)}
                        disabled={deletingId === config.id}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                      >
                        {deletingId === config.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No search configurations found. Add one to start autonomous scraping.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* ── Add Target Modal ──────────────────────────── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6 mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30">
                  <Plus className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Add Search Target</h2>
                  <p className="text-xs text-slate-500">The robot will scrape this automatically.</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  <Building2 className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                  Search Query (Niche)
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. real estate developer"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  <MapPin className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                  Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Miami, Florida"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Channel Pipeline
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                >
                  <option value="email">Email Campaign (SaaS/Internal Tools)</option>
                  <option value="whatsapp">WhatsApp Pipeline (Local Businesses)</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={isSubmitting || !query.trim() || !location.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200"
              >
                {isSubmitting
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : <>Save Target</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
