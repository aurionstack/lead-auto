'use client';

import type { ReactNode } from 'react';

type MetricColor = 'indigo' | 'emerald' | 'violet' | 'amber';

interface MetricCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  color: MetricColor;
  subtitle?: string;
}

const colorMap: Record<MetricColor, {
  bg: string;
  border: string;
  iconBg: string;
  iconBorder: string;
  iconColor: string;
  valueColor: string;
}> = {
  indigo: {
    bg: 'bg-indigo-950/20',
    border: 'border-indigo-900/30',
    iconBg: 'bg-indigo-900/30',
    iconBorder: 'border-indigo-800/50',
    iconColor: 'text-indigo-400',
    valueColor: 'text-indigo-300',
  },
  emerald: {
    bg: 'bg-emerald-950/20',
    border: 'border-emerald-900/30',
    iconBg: 'bg-emerald-900/30',
    iconBorder: 'border-emerald-800/50',
    iconColor: 'text-emerald-400',
    valueColor: 'text-emerald-300',
  },
  violet: {
    bg: 'bg-violet-950/20',
    border: 'border-violet-900/30',
    iconBg: 'bg-violet-900/30',
    iconBorder: 'border-violet-800/50',
    iconColor: 'text-violet-400',
    valueColor: 'text-violet-300',
  },
  amber: {
    bg: 'bg-amber-950/20',
    border: 'border-amber-900/30',
    iconBg: 'bg-amber-900/30',
    iconBorder: 'border-amber-800/50',
    iconColor: 'text-amber-400',
    valueColor: 'text-amber-300',
  },
};

export default function MetricCard({ label, value, icon, color, subtitle }: MetricCardProps) {
  const c = colorMap[color];

  return (
    <div className={`rounded-xl border p-4 ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
          {subtitle && (
            <p className="text-xs text-slate-700 mt-0.5">{subtitle}</p>
          )}
          <p className={`text-2xl font-black mt-2 tabular-nums ${c.valueColor}`}>{value}</p>
        </div>
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl border ${c.iconBg} ${c.iconBorder} ${c.iconColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
