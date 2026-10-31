import React from 'react';
import { Database, CheckCircle2, AlertTriangle, Cloud } from 'lucide-react';

export const ConnectedSources: React.FC = () => {
  return (
    <div className="bg-surface rounded-2xl border border-ink/5 p-6 flex flex-col justify-between h-full">
      <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-4">Connected Enterprise Sources</h3>
      
      <div className="space-y-3">
        {/* Google Drive */}
        <div className="bg-surface rounded-xl border border-ink/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-blue-400" />
            <div>
              <span className="text-ink text-sm font-medium block">Google Drive (Engineering)</span>
              <span className="text-ink/40 text-[10px] uppercase tracking-widest block mt-0.5">481 Documents • 1.1s Latency</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Healthy</span>
            <span className="text-ink/40 text-[10px] uppercase tracking-widest mt-0.5">Synced 3m ago</span>
          </div>
        </div>

        {/* GitHub */}
        <div className="bg-surface rounded-xl border border-ink/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-ink/80" />
            <div>
              <span className="text-ink text-sm font-medium block">GitHub Repositories</span>
              <span className="text-ink/40 text-[10px] uppercase tracking-widest block mt-0.5">14 Repos • 0.8s Latency</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Healthy</span>
            <span className="text-ink/40 text-[10px] uppercase tracking-widest mt-0.5">Synced 12m ago</span>
          </div>
        </div>

        {/* SharePoint */}
        <div className="bg-surface rounded-xl border border-amber-900/30 p-4 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50" />
          <div className="flex items-center gap-3 pl-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <div>
              <span className="text-ink text-sm font-medium block">SharePoint (Finance)</span>
              <span className="text-ink/40 text-[10px] uppercase tracking-widest block mt-0.5">1,024 Documents • 4.2s Latency</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-amber-400 text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Sync Delayed</span>
            <span className="text-ink/40 text-[10px] uppercase tracking-widest mt-0.5">Synced 1h ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};
