import React from 'react';
import { ArrowDown, Shield } from 'lucide-react';

export const ThreatIntelligence: React.FC = () => {
  return (
    <div className="bg-surface rounded-2xl border border-ink/10 p-8">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-5 h-5 text-ink/50" />
        <h2 className="text-lg font-display text-ink">Threat Intelligence Story</h2>
      </div>

      <div className="space-y-4 relative">
        <div className="absolute left-8 top-8 bottom-8 w-px bg-ink/5 z-0" />
        
        <div className="flex gap-6 items-center relative z-10">
          <div className="w-16 text-right text-xs uppercase tracking-widest text-ink/40">10:42 AM</div>
          <div className="p-4 rounded-xl border border-red-900/30 bg-red-950/10 flex-1">
            <span className="text-red-400 font-bold block mb-1 text-sm">Prompt Injection Attempt</span>
            <span className="text-ink/60 text-xs">Origin: Web Interface / External User</span>
          </div>
        </div>

        <div className="flex justify-center -my-2 relative z-10 pl-22">
          <div className="w-6 h-6 rounded-full bg-surface border border-ink/5 flex items-center justify-center mx-auto">
            <ArrowDown className="w-3 h-3 text-ink/40" />
          </div>
        </div>

        <div className="flex gap-6 items-center relative z-10">
          <div className="w-16 text-right text-xs uppercase tracking-widest text-ink/40">10:42 AM</div>
          <div className="p-4 rounded-xl border border-blue-900/30 bg-blue-950/10 flex-1">
            <span className="text-blue-400 font-bold block mb-1 text-sm">Behavior Analysis</span>
            <span className="text-ink/60 text-xs">Identified anomalous syntax pattern matching known jailbreak signatures.</span>
          </div>
        </div>

        <div className="flex justify-center -my-2 relative z-10 pl-22">
          <div className="w-6 h-6 rounded-full bg-surface border border-ink/5 flex items-center justify-center mx-auto">
            <ArrowDown className="w-3 h-3 text-ink/40" />
          </div>
        </div>

        <div className="flex gap-6 items-center relative z-10">
          <div className="w-16 text-right text-xs uppercase tracking-widest text-ink/40">10:42 AM</div>
          <div className="p-4 rounded-xl border border-ink/10 bg-ink/[0.02] flex-1">
            <span className="text-ink font-bold block mb-1 text-sm">Policy Match: Prompt Injection Prevention</span>
            <span className="text-ink/60 text-xs">Confidence Score: 99.8%. Action triggered: Sandbox Isolation.</span>
          </div>
        </div>

        <div className="flex justify-center -my-2 relative z-10 pl-22">
          <div className="w-6 h-6 rounded-full bg-surface border border-ink/5 flex items-center justify-center mx-auto">
            <ArrowDown className="w-3 h-3 text-ink/40" />
          </div>
        </div>

        <div className="flex gap-6 items-center relative z-10">
          <div className="w-16 text-right text-xs uppercase tracking-widest text-ink/40">10:42 AM</div>
          <div className="p-4 rounded-xl border border-green-900/30 bg-green-950/10 flex-1">
            <span className="text-green-400 font-bold block mb-1 text-sm">Mitigated & Continued</span>
            <span className="text-ink/60 text-xs">Harmful payload discarded. Safe intent fulfilled within Sandbox.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
