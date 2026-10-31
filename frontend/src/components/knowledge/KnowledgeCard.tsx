import React from 'react';
import { motion } from 'framer-motion';
import { BrainCircuit, Book, FolderOpen, Target, Clock, AlertTriangle } from 'lucide-react';

export interface KnowledgeAsset {
  id: string;
  title: string;
  summary: string;
  category: string;
  collection: string;
  confidence: number;
  freshness: 'Fresh' | 'Updated Today' | 'Needs Review' | 'Stale';
  source: string;
  owner: string;
  version: string;
  status: 'indexed' | 'embedding' | 'failed' | 'conflict';
  missionUsage: number;
  contains: string[];
}

interface KnowledgeCardProps {
  asset: KnowledgeAsset;
  onClick: (asset: KnowledgeAsset) => void;
}

export const KnowledgeCard: React.FC<KnowledgeCardProps> = ({ asset, onClick }) => {
  const isConflict = asset.status === 'conflict';
  const isEmbedding = asset.status === 'embedding';
  const isFailed = asset.status === 'failed';

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(asset)}
      className={`
        relative group cursor-pointer overflow-hidden rounded-2xl
        stealth-glass hover-surface p-6 border
        ${isConflict || isFailed ? 'border-red-900/30' : isEmbedding ? 'border-blue-900/30' : 'border-ink/5'}
      `}
    >
      {/* Transient Semantic Accents */}
      {(isConflict || isFailed) && (
        <div className="absolute top-0 left-0 w-full h-1 bg-red-900/50 animate-pulse" />
      )}
      {isEmbedding && (
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50 animate-pulse" />
      )}
      {asset.status === 'indexed' && (
        <div className="absolute top-0 left-0 w-full h-[1px] bg-ink/10" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-ink font-medium text-lg tracking-wide mb-1">{asset.title}</h3>
          <p className="text-ink/60 text-sm mb-3 leading-relaxed max-w-xs line-clamp-2">
            {asset.summary}
          </p>
        </div>
        
        {/* Status Indicator */}
        <div className={`px-2 py-1 rounded text-[10px] uppercase tracking-wider flex items-center gap-1.5 shrink-0
          ${(isConflict || isFailed) ? 'bg-red-950/40 text-red-400 border border-red-900/50' : 
            isEmbedding ? 'bg-blue-950/40 text-blue-400 border border-blue-900/50' : 
            'bg-green-950/40 text-green-400 border border-green-900/50'}
        `}>
          {(isConflict || isFailed) && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
          {isEmbedding && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
          {asset.status === 'indexed' && <span className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          {asset.status}
        </div>
      </div>

      {/* Intelligence Data */}
      <div className="mb-4">
        <span className="text-ink/40 text-[10px] uppercase tracking-widest block mb-2">Contains Intelligence On:</span>
        <div className="flex flex-wrap gap-2">
          {asset.contains.map((topic, i) => (
            <span key={i} className="px-2 py-1 rounded-md bg-ink/5 border border-ink/10 text-[11px] text-ink/70">
              {topic}
            </span>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-4 mb-5 pt-4 border-t border-ink/5 text-sm">
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><BrainCircuit className="w-3 h-3" /> Confidence</span>
          <span className="text-ink font-mono">{asset.confidence}%</span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Mission Usage</span>
          <span className="text-ink font-mono">{asset.missionUsage}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-ink/40 text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1">
            {asset.freshness === 'Stale' || asset.freshness === 'Needs Review' ? <AlertTriangle className="w-3 h-3 text-amber-400" /> : <Clock className="w-3 h-3" />}
            Freshness
          </span>
          <span className={`font-mono text-[11px] mt-0.5 truncate ${asset.freshness === 'Stale' || asset.freshness === 'Needs Review' ? 'text-amber-400' : 'text-ink'}`}>{asset.freshness}</span>
        </div>
      </div>
    </motion.div>
  );
};
