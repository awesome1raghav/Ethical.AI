import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const SecurityConflictDetector: React.FC = () => {
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
          <h3 className="text-amber-400 font-bold uppercase tracking-widest text-sm mb-2">Security Conflict Detected</h3>
          <p className="text-ink/80 text-sm mb-4">
            The modifications to this policy conflict with an existing security directive. Silent conflicts are not permitted.
          </p>
          
          <div className="bg-surface rounded-xl border border-ink/5 p-4 mb-4 text-sm flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1">Winning Policy</span>
              <span className="text-ink">Strict Internal Network Access (Blocks Terminal)</span>
            </div>
            <ArrowRight className="w-4 h-4 text-ink/20" />
            <div className="flex flex-col text-right">
              <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1">Current Modification</span>
              <span className="text-ink">Allow Developer Terminal (Allows Terminal)</span>
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <h4 className="text-xs uppercase tracking-widest text-ink/40 mb-1">Resolution Suggestions</h4>
            <button className="text-left text-sm text-ink/70 p-3 rounded-lg border border-ink/10 hover:bg-ink/[0.02] hover:border-ink/20 transition-all">
              1. Add Sandbox isolation to Developer Terminal.
            </button>
            <button className="text-left text-sm text-ink/70 p-3 rounded-lg border border-ink/10 hover:bg-ink/[0.02] hover:border-ink/20 transition-all">
              2. Restrict Developer Terminal to non-sensitive missions only.
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
