import { Boxes } from 'lucide-react';

export default function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-indigo-300/20 bg-indigo-400/10 shadow-lg shadow-indigo-950/30">
        <Boxes className="size-5 text-indigo-300" />
      </span>
      {!compact && (
        <span>
          <span className="block text-base font-semibold tracking-tight text-white">AurionStack</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Automation Hub</span>
        </span>
      )}
    </span>
  );
}
