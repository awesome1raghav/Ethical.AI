import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Target, Users, Box, ChevronRight, Copy, Archive } from 'lucide-react';

export interface SecurityPolicy {
  id: string;
  name: string;
  purpose: string;
  riskCategory: string;
  status: 'active' | 'draft' | 'conflict';
  confidence: number;
  protectedMissions: number;
  protectedAgents: number;
  protectedResources: number;
  lastTriggered: string;
  threatsPrevented: number;
  falsePositives: number;
  createdBy: string;
  governanceAlignment: string;
}

interface SecurityCardProps {
  policy: SecurityPolicy;
  onClick: (policy: SecurityPolicy) => void;
}

export const SecurityCard: React.FC<SecurityCardProps> = ({ policy, onClick }) => {
  const isConflict = policy.status === 'conflict';
  const isActive = policy.status === 'active';

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(policy)}
      className={`
        relative group cursor-pointer overflow-hidden rounded-2xl
        stealth-glass hover-surface p-6 border
        ${isConflict ? 'border-red-900/30' : 'border-ink/5'}
      `}
    >
      {/* Transient Semantic Accents */}
      {isConflict && (
        <div className="absolute top-0 left-0 w-full h-1 bg-red-900/50 animate-pulse" />
      )}
      {isActive && !isConflict && (
        <div className="absolute top-0 left-0 w-full h-[1px] bg-ink/10" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-ink font-medium text-lg tracking-wide mb-1">{policy.name}</h3>
          <p className="text-ink/60 text-sm mb-3 leading-relaxed max-w-sm line-clamp-2">
            {policy.purpose}
          </p>
          <div className="flex items-center gap-3 text-xs text-ink/55">
            <span className="uppercase tracking-wider px-2 py-0.5 rounded bg-ink/5">{policy.riskCategory}</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-ink/30" /> {policy.confidence}% Confidence</span>
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0
          ${isConflict ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 
            isActive ? 'bg-ink/5 text-ink/70 border border-ink/10' : 
            'bg-brand-ink text-ink/45 border border-ink/25'}
        `}>
          {isConflict && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
          {!isConflict && isActive && <span className="w-1.5 h-1.5 rounded-full bg-ink/50" />}
          {policy.status}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 mb-5 pt-4 border-t border-ink/5 text-sm">
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Threats</span>
          <span className="text-ink font-mono">{policy.threatsPrevented.toLocaleString()}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Box className="w-3 h-3" /> F.P.</span>
          <span className="text-ink font-mono">{policy.falsePositives}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Users className="w-3 h-3" /> Agents</span>
          <span className="text-ink font-mono">{policy.protectedAgents}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1">Last</span>
          <span className="text-ink font-mono text-xs mt-0.5 truncate">{policy.lastTriggered}</span>
        </div>
      </div>

      {/* Footer / Quick Actions */}
      <div className="pt-4 flex justify-between items-center text-xs">
        <div className="text-ink/45">
          Created by <span className="text-ink/70">{policy.createdBy}</span>
        </div>
        
        {/* Quick Actions (visible on hover) */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1.5 rounded bg-ink/5 hover:bg-ink/10 text-ink/70 transition-colors flex items-center gap-1" title="Inspect Logic">
            <span className="uppercase tracking-widest text-[10px] pl-1">Inspect</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
