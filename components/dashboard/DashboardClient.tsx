'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Lead, LeadStatus } from '@/lib/types';
import {
  LayoutDashboard, Users, TrendingUp, MessageSquare,
  Star, MapPin, Phone, ExternalLink, X, RefreshCw,
  CheckCircle2, XCircle, Zap, LogOut, ChevronRight,
  Building2, Hash, Brain, Mail, Send, Loader2, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import LeadCard from './LeadCard';
import MetricCard from './MetricCard';

interface DashboardClientProps {
  // SECURITY: Only plain serializable Lead[] data received here.
  // The supabaseAdmin client instance is NEVER passed as a prop.
  initialLeads: Lead[];
  isMockData?: boolean;
}

export default function DashboardClient({ initialLeads, isMockData = false }: DashboardClientProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    initialLeads[0]?.id ?? null
  );
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTriggeringAI, setIsTriggeringAI] = useState(false);
  const [editedPitch, setEditedPitch] = useState<string>('');
  const [editedEmailPitch, setEditedEmailPitch] = useState<string>('');
  const [pitchModified, setPitchModified] = useState(false);
  const [emailPitchModified, setEmailPitchModified] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [mockBannerDismissed, setMockBannerDismissed] = useState(false);

  // Set initial pitch when component mounts with a selected lead
  useEffect(() => {
    const first = initialLeads[0];
    if (first) {
      setEditedPitch(first.drafted_pitch ?? '');
      setEditedEmailPitch(first.drafted_email_pitch ?? '');
    }
  }, [initialLeads]);

  const selectedLead = leads.find((l) => l.id === selectedLeadId) ?? null;

  // When a lead is selected, reset the editable pitch to its current value
  const handleSelectLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setEditedPitch(lead.drafted_pitch ?? '');
    setEditedEmailPitch(lead.drafted_email_pitch ?? '');
    setPitchModified(false);
    setEmailPitchModified(false);
    setActionFeedback(null);
  };

  // Pipeline metrics
  const newLeads = leads.filter((l) => l.status === 'new').length;
  const highPotential = leads.filter((l) => (l.opportunity_score ?? 0) >= 70).length;
  const contacted = leads.filter((l) => l.status === 'contacted').length;
  const totalActive = leads.length;

  // ── API call helper ──────────────────────────────────────────
  const updateLead = useCallback(
    async (id: string, payload: { status?: LeadStatus; drafted_pitch?: string; drafted_email_pitch?: string }) => {
      const response = await fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Update failed');
      }
      return response.json();
    },
    []
  );

  // ── Save edited pitch ────────────────────────────────────────
  const handleSavePitches = async () => {
    if (!selectedLead || (!pitchModified && !emailPitchModified)) return;
    setIsUpdating(true);
    try {
      const payload: { drafted_pitch?: string; drafted_email_pitch?: string } = {};
      if (pitchModified) payload.drafted_pitch = editedPitch;
      if (emailPitchModified) payload.drafted_email_pitch = editedEmailPitch;

      await updateLead(selectedLead.id, payload);
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id ? { ...l, ...payload } : l
        )
      );
      setPitchModified(false);
      setEmailPitchModified(false);
      showFeedback('success', 'Pitches saved successfully.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Open WhatsApp Web + mark contacted ───────────────────────
  const handleOpenWhatsApp = async () => {
    if (!selectedLead?.phone) return;
    setIsUpdating(true);

    const pitch = editedPitch || selectedLead.drafted_pitch || '';
    const cleanPhone = selectedLead.phone.replace(/\D/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(pitch)}`;

    // Open WhatsApp in new tab immediately (before async call)
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    try {
      await updateLead(selectedLead.id, { status: 'contacted' });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id ? { ...l, status: 'contacted' } : l
        )
      );
      showFeedback('success', 'Lead marked as contacted.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Push to Instantly ─────────────────────────────────────────
  const handlePushToInstantly = async () => {
    if (!selectedLead?.email) return;
    setIsUpdating(true);

    try {
      const response = await fetch('/api/leads/push-to-instantly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? 'Push failed');
      }
      
      setLeads((prev) =>
        prev.map((l) =>
          l.id === selectedLead.id ? { ...l, status: 'contacted' } : l
        )
      );
      showFeedback('success', 'Lead pushed to Instantly.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Instantly push failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Reject lead ───────────────────────────────────────────────
  const handleRejectLead = async () => {
    if (!selectedLead) return;
    setIsUpdating(true);
    try {
      await updateLead(selectedLead.id, { status: 'rejected' });

      // Remove from list and select next available lead
      const updatedLeads = leads.filter((l) => l.id !== selectedLead.id);
      setLeads(updatedLeads);
      setSelectedLeadId(updatedLeads[0]?.id ?? null);
      setEditedPitch(updatedLeads[0]?.drafted_pitch ?? '');
      setEditedEmailPitch(updatedLeads[0]?.drafted_email_pitch ?? '');
      showFeedback('success', 'Lead rejected and removed from pipeline.');
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Reject failed.');
    } finally {
      setIsUpdating(false);
    }
  };

  // ── Logout ────────────────────────────────────────────────────
  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/login';
  };

  // ── Trigger AI Processing ─────────────────────────────────────
  const handleTriggerAI = async () => {
    setIsTriggeringAI(true);
    try {
      const response = await fetch('/api/leads/trigger-ai', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to trigger AI');
      showFeedback('success', `AI processed ${data.processed} leads (${data.succeeded} succeeded). Refreshing...`);
      setTimeout(() => window.location.reload(), 2000);
    } catch (err) {
      showFeedback('error', err instanceof Error ? err.message : 'Failed to trigger AI.');
    } finally {
      setIsTriggeringAI(false);
    }
  };

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-slate-500';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number | null) => {
    if (!score) return 'bg-slate-800/50 border-slate-700/50';
    if (score >= 80) return 'bg-emerald-950/40 border-emerald-900/50';
    if (score >= 60) return 'bg-amber-950/40 border-amber-900/50';
    if (score >= 40) return 'bg-orange-950/40 border-orange-900/50';
    return 'bg-red-950/40 border-red-900/50';
  };

  const getStatusBadge = (status: LeadStatus) => {
    const map: Record<LeadStatus, { label: string; class: string }> = {
      new: { label: 'New', class: 'bg-blue-900/40 text-blue-300 border-blue-800/50' },
      approved: { label: 'Approved', class: 'bg-violet-900/40 text-violet-300 border-violet-800/50' },
      contacted: { label: 'Contacted', class: 'bg-emerald-900/40 text-emerald-300 border-emerald-800/50' },
      rejected: { label: 'Rejected', class: 'bg-red-900/40 text-red-300 border-red-800/50' },
    };
    const config = map[status] ?? map.new;
    return (
      <span className={`px-2 py-0.5 text-xs rounded-md border font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col text-white">
      {/* ── Top Navigation Bar ──────────────────────────────── */}
      <header className="h-14 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-xl flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30">
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <span className="text-sm font-bold text-white">Lead System</span>
            <span className="text-slate-500 text-xs ml-2">· Internal Dashboard</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 hidden sm:block">
            {totalActive} active lead{totalActive !== 1 ? 's' : ''}
          </span>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Campaigns
          </Link>

          <button
            onClick={handleTriggerAI}
            disabled={isTriggeringAI}
            className="flex items-center gap-1.5 text-xs bg-indigo-900/40 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-800/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
          >
            {isTriggeringAI ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {isTriggeringAI ? 'Processing...' : 'Run AI'}
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

      {/* ── Mock Data Banner ─────────────────────────────────── */}
      {isMockData && !mockBannerDismissed && (
        <div className="px-6 py-2.5 bg-amber-950/60 border-b border-amber-900/50 flex items-center justify-between gap-4">
          <p className="text-amber-300 text-xs">
            <span className="font-semibold">Demo mode</span> — Showing 5 sample leads. Add real Supabase credentials to
            <code className="mx-1 px-1.5 py-0.5 bg-amber-900/40 rounded text-amber-200 font-mono">.env.local</code>
            and restart the dev server to connect to live data.
          </p>
          <button
            onClick={() => setMockBannerDismissed(true)}
            className="shrink-0 text-amber-500 hover:text-amber-300 text-xs underline transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Pipeline Metrics Bar ────────────────────────────── */}
      <div className="px-6 py-4 border-b border-slate-800/40 bg-slate-900/40">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard
            label="New Leads"
            value={newLeads}
            icon={<Users className="w-4 h-4" />}
            color="indigo"
          />
          <MetricCard
            label="High Potential"
            value={highPotential}
            icon={<TrendingUp className="w-4 h-4" />}
            color="emerald"
            subtitle="Score ≥ 70"
          />
          <MetricCard
            label="Contacted"
            value={contacted}
            icon={<MessageSquare className="w-4 h-4" />}
            color="violet"
          />
          <MetricCard
            label="Total Pipeline"
            value={totalActive}
            icon={<LayoutDashboard className="w-4 h-4" />}
            color="amber"
          />
        </div>
      </div>

      {/* ── Main Split Layout ────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar — Lead List ──────────────────────── */}
        <aside className="w-80 shrink-0 border-r border-slate-800/60 flex flex-col bg-slate-900/30">
          <div className="px-4 py-3 border-b border-slate-800/40">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Pipeline · Sorted by Score
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-700">
            {leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <Users className="w-10 h-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">No active leads</p>
                <p className="text-slate-700 text-xs mt-1">Trigger the Apify webhook to ingest leads</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {leads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isSelected={lead.id === selectedLeadId}
                    onClick={() => handleSelectLead(lead)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── Right Pane — Lead Detail ──────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          {!selectedLead ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-12">
              <Building2 className="w-12 h-12 text-slate-700 mb-4" />
              <h3 className="text-slate-400 font-semibold">Select a lead</h3>
              <p className="text-slate-600 text-sm mt-1">Choose a lead from the sidebar to view details</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-6">

              {/* Action Feedback Toast */}
              {actionFeedback && (
                <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl border shadow-2xl text-sm font-medium transition-all duration-300 ${
                  actionFeedback.type === 'success'
                    ? 'bg-emerald-950/90 border-emerald-800/60 text-emerald-300'
                    : 'bg-red-950/90 border-red-800/60 text-red-300'
                }`}>
                  {actionFeedback.type === 'success'
                    ? <CheckCircle2 className="w-4 h-4" />
                    : <XCircle className="w-4 h-4" />
                  }
                  {actionFeedback.message}
                </div>
              )}

              {/* Lead Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h1 className="text-xl font-bold text-white truncate">
                      {selectedLead.business_name ?? 'Unknown Business'}
                    </h1>
                    {getStatusBadge(selectedLead.status)}
                  </div>
                  <p className="text-slate-400 text-sm">{selectedLead.category ?? 'Uncategorized'}</p>
                </div>

                {/* Score Badge */}
                <div className={`shrink-0 flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 ${getScoreBg(selectedLead.opportunity_score)}`}>
                  <span className={`text-2xl font-black ${getScoreColor(selectedLead.opportunity_score)}`}>
                    {selectedLead.opportunity_score ?? '–'}
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5">/ 100</span>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {selectedLead.rating && (
                  <InfoTile
                    icon={<Star className="w-4 h-4 text-amber-400" />}
                    label="Rating"
                    value={`${selectedLead.rating} ★`}
                  />
                )}
                {selectedLead.review_count !== null && (
                  <InfoTile
                    icon={<Hash className="w-4 h-4 text-indigo-400" />}
                    label="Reviews"
                    value={selectedLead.review_count.toLocaleString()}
                  />
                )}
                {selectedLead.phone && (
                  <InfoTile
                    icon={<Phone className="w-4 h-4 text-emerald-400" />}
                    label="Phone"
                    value={selectedLead.phone}
                  />
                )}
                {selectedLead.address && (
                  <InfoTile
                    icon={<MapPin className="w-4 h-4 text-rose-400" />}
                    label="Address"
                    value={selectedLead.address}
                    className={selectedLead.email ? '' : 'col-span-2'}
                  />
                )}
                {selectedLead.email && (
                  <InfoTile
                    icon={<Mail className="w-4 h-4 text-sky-400" />}
                    label="Email"
                    value={selectedLead.email}
                  />
                )}
              </div>

              {/* External Links */}
              <div className="flex flex-col gap-2">
                {selectedLead.website && (
                  <a
                    href={selectedLead.website.startsWith('http') ? selectedLead.website : `https://${selectedLead.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Visit Website
                    <ChevronRight className="w-3 h-3" />
                  </a>
                )}
                {selectedLead.google_maps_url && (
                  <a
                    href={selectedLead.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors group"
                  >
                    <ExternalLink className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    View on Google Maps
                    <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>

              {/* AI Reasoning Block */}
              {selectedLead.ai_reasoning ? (
                <div className="rounded-xl bg-indigo-950/30 border border-indigo-900/40 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-indigo-300">AI Analysis</h3>
                    <span className="text-xs text-indigo-600 bg-indigo-900/30 px-2 py-0.5 rounded-full">Gemini 3.5 Flash Lite</span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{selectedLead.ai_reasoning}</p>
                </div>
              ) : (
                <div className="rounded-xl bg-slate-800/30 border border-slate-700/40 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-slate-600" />
                    <h3 className="text-sm font-semibold text-slate-600">AI Analysis</h3>
                  </div>
                  <p className="text-slate-600 text-sm">Awaiting next cron cycle (every 10 minutes)…</p>
                </div>
              )}

              {/* Editable Pitch Textareas */}
              <div className="rounded-xl bg-slate-900/60 border border-slate-800/60 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">WhatsApp & Email Pitches</h3>
                    {(pitchModified || emailPitchModified) && (
                      <span className="text-xs text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-800/40">
                        Modified
                      </span>
                    )}
                  </div>
                  {(pitchModified || emailPitchModified) && (
                    <button
                      onClick={handleSavePitches}
                      disabled={isUpdating}
                      className="text-xs bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-300 border border-emerald-800/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Save Changes
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">WhatsApp Hook</label>
                    <textarea
                      id={`pitch-${selectedLead.id}`}
                      value={editedPitch}
                      onChange={(e) => {
                        setEditedPitch(e.target.value);
                        setPitchModified(e.target.value !== (selectedLead.drafted_pitch ?? ''));
                      }}
                      placeholder={selectedLead.ai_reasoning
                        ? 'WhatsApp pitch will appear here...'
                        : 'Awaiting AI processing...'
                      }
                      rows={3}
                      className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email Hook (Instantly)</label>
                    <textarea
                      id={`email-pitch-${selectedLead.id}`}
                      value={editedEmailPitch}
                      onChange={(e) => {
                        setEditedEmailPitch(e.target.value);
                        setEmailPitchModified(e.target.value !== (selectedLead.drafted_email_pitch ?? ''));
                      }}
                      placeholder={selectedLead.ai_reasoning
                        ? 'Email pitch will appear here...'
                        : 'Awaiting AI processing...'
                      }
                      rows={3}
                      className="w-full bg-slate-800/60 border border-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500/40 transition-all resize-none leading-relaxed"
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-600 mt-2">
                  Edit the message before sending. Changes are saved before opening WhatsApp or pushing to Instantly.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pb-6">
                {/* Open WhatsApp Web */}
                <button
                  id={`whatsapp-btn-${selectedLead.id}`}
                  onClick={handleOpenWhatsApp}
                  disabled={isUpdating || !selectedLead.phone || selectedLead.status === 'contacted'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-900/30"
                >
                  {isUpdating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4" />
                  )}
                  WhatsApp
                </button>

                {/* Push to Instantly */}
                <button
                  id={`instantly-btn-${selectedLead.id}`}
                  onClick={handlePushToInstantly}
                  disabled={isUpdating || !selectedLead.email || selectedLead.status === 'contacted'}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:cursor-not-allowed disabled:text-slate-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-sky-900/30"
                >
                  {isUpdating ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Instantly
                </button>

                {/* Reject Lead */}
                <button
                  id={`reject-btn-${selectedLead.id}`}
                  onClick={handleRejectLead}
                  disabled={isUpdating}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-800 hover:bg-red-950/60 hover:border-red-900/60 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-400 hover:text-red-400 text-sm font-semibold rounded-xl transition-all duration-200"
                >
                  <X className="w-4 h-4" />
                  Reject
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Inline helper component — Info Tile ─────────────────────────
interface InfoTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}

function InfoTile({ icon, label, value, className = '' }: InfoTileProps) {
  return (
    <div className={`rounded-xl bg-slate-900/60 border border-slate-800/50 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      </div>
      <p className="text-sm text-white font-medium truncate">{value}</p>
    </div>
  );
}
