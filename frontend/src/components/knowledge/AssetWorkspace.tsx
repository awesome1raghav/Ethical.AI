import React from 'react';
import { ArrowLeft, BookOpen, Search, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { KnowledgeAsset } from './KnowledgeCard';
import { ConflictDetector } from './ConflictDetector';
import { KnowledgeGraph } from './KnowledgeGraph';

interface AssetWorkspaceProps {
  asset: KnowledgeAsset;
  onBack: () => void;
}

export const AssetWorkspace: React.FC<AssetWorkspaceProps> = ({ asset, onBack }) => {
  return (
    <div className="absolute inset-0 bg-surface flex flex-col overflow-y-auto scrollbar-hide z-50">
      {/* Workspace Header */}
      <div className="sticky top-0 z-20 px-10 py-6 border-b border-ink/5 bg-surface/95 backdrop-blur flex justify-between items-center">
        <div className="flex items-center gap-6">
          <button 
            onClick={onBack}
            className="p-2 rounded-full hover:bg-ink/10 transition-colors group"
          >
            <ArrowLeft className="w-5 h-5 text-ink/50 group-hover:text-ink transition-colors" />
          </button>
          <div>
            <h2 className="text-2xl font-display text-ink mb-1">{asset.title}</h2>
            <div className="flex items-center gap-4 text-xs text-ink/40 uppercase tracking-widest">
              <span>{asset.category}</span>
              <span>•</span>
              <span>Confidence: {asset.confidence}%</span>
              <span>•</span>
              <span className={asset.freshness === 'Stale' ? 'text-amber-400' : ''}>{asset.freshness}</span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button className="nexus-button bg-transparent border-ink/10 text-ink hover:bg-ink/5">
            View Source
          </button>
          <button className="nexus-button bg-ink text-brand-ink hover:bg-ink/90 border-transparent">
            Re-Index Asset
          </button>
        </div>
      </div>

      {/* Workspace Content */}
      <div className="p-10 max-w-7xl mx-auto w-full grid grid-cols-12 gap-8 pb-32">
        
        {/* Left Column: Intelligence & Content */}
        <div className="col-span-8 flex flex-col gap-8">
          {asset.status === 'conflict' && <ConflictDetector />}
          
          <div className="mb-4">
            <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-4">AI Summary</h3>
            <p className="text-ink/80 text-lg leading-relaxed">
              {asset.summary}
            </p>
          </div>

          <div>
            <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-4">Semantic Chunks & Explainability</h3>
            <div className="space-y-4">
              <div className="bg-surface rounded-xl border border-ink/5 p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-ink">Chunk: Compensation Guidelines</span>
                  <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Indexed</span>
                </div>
                <p className="text-sm text-ink/60 mb-3">
                  Defines the structure for annual bonuses and base salary adjustments for the engineering department.
                </p>
                <div className="text-[10px] text-ink/40 uppercase tracking-widest">
                  Frequently retrieved by: Finance Agent
                </div>
              </div>
              <div className="bg-surface rounded-xl border border-ink/5 p-5">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-bold text-ink">Chunk: Remote Work Addendum</span>
                  <span className="text-xs text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Flagged (Conflict)</span>
                </div>
                <p className="text-sm text-ink/60 mb-3">
                  Specifies WFH equipment stipends. This chunk conflicts with updated information in the Global HR Handbook v2.
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-4 mt-4">Knowledge Relationship Graph</h3>
            <KnowledgeGraph />
          </div>
        </div>

        {/* Right Column: Metadata & Mission Impact */}
        <div className="col-span-4 flex flex-col gap-8">
          <div className="bg-surface rounded-2xl border border-ink/10 p-6">
            <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-6">Mission Impact</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                <span className="text-ink/60">Referenced Missions</span>
                <span className="text-ink">{asset.missionUsage}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                <span className="text-ink/60">Active Agents Utilizing</span>
                <span className="text-ink">3</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                <span className="text-ink/60">Avg Retrieval Confidence</span>
                <span className="text-ink">{asset.confidence}%</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink/60">Most Frequent Consumer</span>
                <span className="text-ink">Research Agent</span>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-ink/10 p-6">
            <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-6">Source Intelligence</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                <span className="text-ink/60">Connected Source</span>
                <span className="text-ink">{asset.source}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                <span className="text-ink/60">Owner</span>
                <span className="text-ink">{asset.owner}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-ink/60">Version</span>
                <span className="text-ink">{asset.version}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
