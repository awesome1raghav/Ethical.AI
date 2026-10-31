import React from 'react';
import { AlertTriangle, Copy, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const ConflictDetector: React.FC = () => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-amber-950/10 border border-amber-900/30 rounded-2xl p-6 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50 animate-pulse" />
      
      <div className="flex gap-4">
        <div className="mt-1">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        
        <div className="flex-1">
          <h3 className="text-amber-400 font-bold uppercase tracking-widest text-sm mb-2">Knowledge Conflict Detected</h3>
          <p className="text-ink/80 text-sm mb-4">
            This asset contains conflicting definitions for "Remote Work Policy" compared to a more recently verified asset.
          </p>
          
          <div className="bg-surface rounded-xl border border-ink/5 p-4 mb-4 text-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Copy className="w-3 h-3" /> Conflicting Asset</span>
              <span className="text-ink">Global HR Handbook v2 (Updated Today)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-ink/20" />
            <div className="flex flex-col text-right">
              <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1 justify-end"><AlertTriangle className="w-3 h-3" /> This Asset</span>
              <span className="text-ink">US Remote Work Addendum (Stale)</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <h4 className="text-xs uppercase tracking-widest text-ink/40 mb-1">Resolution Actions</h4>
            <button className="text-left text-sm text-ink/70 p-3 rounded-lg border border-ink/10 hover:bg-ink/[0.02] hover:border-ink/20 transition-all">
              Mark this asset as deprecated (Archived).
            </button>
            <button className="text-left text-sm text-ink/70 p-3 rounded-lg border border-ink/10 hover:bg-ink/[0.02] hover:border-ink/20 transition-all">
              Merge unique data into Global HR Handbook v2.
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
