'use client';

import { useState } from 'react';
import type { ScrapeJob } from '@/lib/types';
import { Search, Loader2, MapPin, Building2, Hash, X, LogOut, ChevronRight, LayoutDashboard, Clock, Users, Trash2, Settings } from 'lucide-react';
import Link from 'next/link';

interface BatchListClientProps {
  jobs: ScrapeJob[];
}

export default function BatchListClient({ jobs }: BatchListClientProps) {
  const [showScrapeModal, setShowScrapeModal] = useState(false);
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [scrapeCategory, setScrapeCategory] = useState('');
  const [scrapeMaxResults, setScrapeMaxResults] = useState(50);
  const [isScraping, setIsScraping] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/login';
  };

  const handleScrape = async () => {
    if (!scrapeLocation.trim() || !scrapeCategory.trim()) return;
    setIsScraping(true);
    try {
      const response = await fetch('/api/leads/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: scrapeLocation.trim(),
          category: scrapeCategory.trim(),
          maxResults: scrapeMaxResults,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scrape failed');
      showFeedback('success', data.message);
      setShowScrapeModal(false);
      setScrapeLocation('');
      setScrapeCategory('');
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Scrape request failed.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, jobId: string) => {
    e.preventDefault(); // Prevent link click
    if (!confirm('Are you sure you want to delete this campaign? All associated leads will be deleted.')) return;
    
    setIsDeleting(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete');
      }
      showFeedback('success', 'Campaign deleted successfully');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white">
      {/* ── Top Navigation Bar ──────────────────────────────── */}
      <header className="h-14 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <LayoutDashboard className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Scrape Campaigns</span>
            <span className="text-slate-500 text-xs ml-2">· Lead Batches</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>

          <button
            onClick={() => setShowScrapeModal(true)}
            className="flex items-center gap-1.5 text-xs bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            New Scrape
          </button>

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

      {/* ── Feedback Toast ──────────────────────────────────── */}
      {actionFeedback && (
        <div className="fixed top-20 right-6 z-50 animate-in fade-in slide-in-from-top-4">
          <div className={`px-4 py-3 rounded-xl shadow-lg border ${
            actionFeedback.type === 'success' 
              ? 'bg-emerald-950/80 border-emerald-900/50 text-emerald-300' 
              : 'bg-red-950/80 border-red-900/50 text-red-300'
          }`}>
            <p className="text-sm font-medium">{actionFeedback.message}</p>
          </div>
        </div>
      )}

      {/* ── Main Content: Grid of Jobs ──────────────────────── */}
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-semibold mb-6">Recent Scrape Campaigns</h1>
          
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-slate-900/30 border border-slate-800/60 rounded-2xl text-center">
              <Search className="w-12 h-12 text-slate-700 mb-4" />
              <h3 className="text-lg font-medium text-slate-300 mb-2">No campaigns yet</h3>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                Start by finding some leads. Click "New Scrape" to pull data from Google Maps.
              </p>
              <button
                onClick={() => setShowScrapeModal(true)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Search className="w-4 h-4" /> Start your first scrape
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <Link key={job.id} href={`/dashboard/job/${job.id}`}>
                  <div className="group bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 transition-all cursor-pointer shadow-sm hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-200 capitalize group-hover:text-white transition-colors">{job.category}</h3>
                        <p className="text-sm text-slate-500 capitalize flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {job.location}
                        </p>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium border ${
                        job.status === 'completed' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' :
                        job.status === 'scraping' ? 'bg-amber-950/40 text-amber-400 border-amber-900/50 animate-pulse' :
                        'bg-red-950/40 text-red-400 border-red-900/50'
                      }`}>
                        {job.status}
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, job.id)}
                        disabled={isDeleting === job.id}
                        className="ml-3 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-50"
                        title="Delete Campaign"
                      >
                        {isDeleting === job.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5 text-slate-400 text-sm">
                        <Users className="w-4 h-4 text-indigo-400" />
                        <span className="font-medium text-slate-300">{job.results_count || 0}</span> leads
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(job.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-indigo-400 transition-colors ml-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Find Leads (Scrape) Modal ──────────────────────────── */}
      {showScrapeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowScrapeModal(false); }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6 mx-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-600/20 border border-emerald-500/30">
                  <Search className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Find New Leads</h2>
                  <p className="text-xs text-slate-500">Scrape Google Maps via Apify</p>
                </div>
              </div>
              <button
                onClick={() => setShowScrapeModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  <MapPin className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                  Location
                </label>
                <input
                  type="text"
                  value={scrapeLocation}
                  onChange={(e) => setScrapeLocation(e.target.value)}
                  placeholder="e.g. Mumbai, Delhi, Bangalore"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  <Building2 className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                  Business Category
                </label>
                <input
                  type="text"
                  value={scrapeCategory}
                  onChange={(e) => setScrapeCategory(e.target.value)}
                  placeholder="e.g. restaurants, plumbers, gyms"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  <Hash className="inline w-3.5 h-3.5 mr-1 text-slate-500" />
                  Max Results
                </label>
                <select
                  value={scrapeMaxResults}
                  onChange={(e) => setScrapeMaxResults(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                >
                  <option value={20}>20 results</option>
                  <option value={50}>50 results</option>
                  <option value={100}>100 results</option>
                  <option value={200}>200 results</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScrapeModal(false)}
                className="flex-1 py-2.5 text-sm text-slate-400 border border-slate-700 rounded-xl hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleScrape}
                disabled={isScraping || !scrapeLocation.trim() || !scrapeCategory.trim()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200"
              >
                {isScraping
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Launching...</>
                  : <><Search className="w-4 h-4" /> Start Scraping</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
