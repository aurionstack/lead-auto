'use client';

import type { Lead } from '@/lib/types';
import { Building2, Phone } from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  isSelected: boolean;
  onClick: () => void;
}

export default function LeadCard({ lead, isSelected, onClick }: LeadCardProps) {
  const score = lead.opportunity_score;

  const getScoreConfig = (s: number | null) => {
    if (!s || s === 0) return {
      barColor: 'bg-slate-700',
      textColor: 'text-slate-500',
      label: 'Unscored',
    };
    if (s >= 80) return {
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-400',
      label: `${s}`,
    };
    if (s >= 60) return {
      barColor: 'bg-amber-500',
      textColor: 'text-amber-400',
      label: `${s}`,
    };
    if (s >= 40) return {
      barColor: 'bg-orange-500',
      textColor: 'text-orange-400',
      label: `${s}`,
    };
    return {
      barColor: 'bg-red-500',
      textColor: 'text-red-400',
      label: `${s}`,
    };
  };

  const scoreConfig = getScoreConfig(score);

  const statusDotColor: Record<string, string> = {
    new: 'bg-blue-400',
    approved: 'bg-violet-400',
    contacted: 'bg-emerald-400',
    rejected: 'bg-red-400',
  };

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-3.5 transition-all duration-150 border group ${
        isSelected
          ? 'bg-indigo-600/15 border-indigo-500/30 shadow-lg shadow-indigo-900/20'
          : 'bg-transparent border-transparent hover:bg-slate-800/50 hover:border-slate-700/50'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
          isSelected ? 'bg-indigo-600/20 border border-indigo-500/30' : 'bg-slate-800 border border-slate-700/50'
        }`}>
          <Building2 className={`w-4 h-4 ${isSelected ? 'text-indigo-400' : 'text-slate-500'}`} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name + Status dot */}
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate transition-colors ${
              isSelected ? 'text-white' : 'text-slate-300 group-hover:text-white'
            }`}>
              {lead.business_name ?? 'Unknown Business'}
            </p>
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotColor[lead.status] ?? 'bg-slate-500'}`} />
          </div>

          {/* Category */}
          <p className="text-xs text-slate-500 truncate mt-0.5">
            {lead.category ?? 'No category'}
          </p>

          {/* Phone */}
          {lead.phone && (
            <div className="flex items-center gap-1 mt-1.5">
              <Phone className="w-3 h-3 text-slate-600" />
              <span className="text-xs text-slate-600 font-mono">{lead.phone}</span>
            </div>
          )}

          {/* Score bar */}
          <div className="mt-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-600">Score</span>
              <span className={`text-xs font-bold ${scoreConfig.textColor}`}>
                {scoreConfig.label}
              </span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${scoreConfig.barColor}`}
                style={{ width: `${score ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
