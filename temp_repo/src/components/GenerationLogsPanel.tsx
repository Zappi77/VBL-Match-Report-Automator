import { Check, Loader2 } from "lucide-react";

interface GenerationLogsPanelProps {
  loading: boolean;
  logs: string[];
  elapsedTime: number;
}

export function GenerationLogsPanel({ loading, logs, elapsedTime }: GenerationLogsPanelProps) {
  if (!loading || logs.length === 0) return null;

  return (
    <div className="mt-6 bg-[#5A5A40]/5 p-6 rounded-2xl border border-[#5A5A40]/10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-start gap-3">
          <Loader2 className="w-5 h-5 text-[#5A5A40] animate-spin mt-0.5" />
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]">Live-Protokoll (KI-Suche)</p>
            <p className="text-sm font-medium italic text-[#5A5A40]">{logs[logs.length - 1]}</p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-mono font-bold text-[#5A5A40]">{elapsedTime}s</span>
          <p className="text-[8px] text-[#5A5A40]/40 uppercase tracking-widest">Abgelaufen</p>
        </div>
      </div>

      <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
        {logs.slice(0, -1).reverse().map((log, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px] text-[#5A5A40]/50 font-mono">
            <Check className="w-3 h-3" />
            <span>{log}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
