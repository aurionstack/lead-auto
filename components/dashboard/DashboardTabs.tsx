'use client';

import { useState } from 'react';
import { LayoutDashboard, Mail, Activity, Search, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';
import AnalyticsChart from './AnalyticsChart';
import SentInbox from './SentInbox';
import BatchListClient from './BatchListClient';

export default function DashboardTabs({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState('analytics');

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' });
    window.location.href = '/login';
  };

  return (
    <div className="space-y-6">
      {/* Tabs Navigation & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl w-fit border border-slate-800">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'analytics' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'inbox' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Sent Inbox</span>
            {data.outreach.length > 0 && (
              <span className="ml-2 bg-slate-800 text-xs px-2 py-0.5 rounded-full">{data.outreach.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'jobs' ? 'bg-indigo-500/10 text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>System Jobs</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
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
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'analytics' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <p className="text-slate-400 text-sm font-medium">Total Leads</p>
                <p className="text-3xl font-bold text-white mt-2">{data.leadStats.total}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <p className="text-slate-400 text-sm font-medium">Emails Sent</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2">{data.leadStats.contacted}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <p className="text-slate-400 text-sm font-medium">Rejected Leads</p>
                <p className="text-3xl font-bold text-rose-400 mt-2">{data.leadStats.rejected}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <p className="text-slate-400 text-sm font-medium">Processing Queue</p>
                <p className="text-3xl font-bold text-amber-400 mt-2">{data.leadStats.new}</p>
              </div>
            </div>
            
            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="text-lg font-medium text-white mb-6">Email Volume (Last 7 Days)</h3>
                <AnalyticsChart data={data.chartData} />
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                 <div>
                    <h3 className="text-lg font-medium text-white mb-2">Performance Insight</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      The AI outreach engine automatically discovers, scores, and emails highly qualified leads.
                    </p>
                 </div>
                 
                 <div className="bg-slate-950 p-4 rounded-lg mt-6 border border-slate-800">
                    <p className="text-sm font-medium text-slate-300">Conversion to Send Rate</p>
                    <div className="flex items-end mt-2">
                       <span className="text-3xl font-bold text-indigo-400">
                         {data.leadStats.total > 0 
                           ? Math.round((data.leadStats.contacted / data.leadStats.total) * 100) 
                           : 0}%
                       </span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SentInbox outreach={data.outreach} />
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <BatchListClient jobs={data.jobs} />
          </div>
        )}
      </div>
    </div>
  );
}
