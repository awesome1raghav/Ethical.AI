"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, Server, Shield, BrainCircuit, Database, 
  ChevronRight, X, ExternalLink, ActivitySquare, AlertCircle, 
  CheckCircle2, Clock, ArrowLeft
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";

// Knowledge Components
import { KnowledgeAssistant } from "@/components/knowledge/KnowledgeAssistant";
import { KnowledgeCard, KnowledgeAsset } from "@/components/knowledge/KnowledgeCard";
import { LiveKnowledgeActivity } from "@/components/knowledge/LiveKnowledgeActivity";
import { ConnectedSources } from "@/components/knowledge/ConnectedSources";
import { AssetWorkspace } from "@/components/knowledge/AssetWorkspace";

// --- TYPES ---
type NodeStatus = 'healthy' | 'attention' | 'syncing' | 'offline';

interface NodeData {
  id: string;
  label: string;
  type: 'core' | 'system';
  x: number;
  y: number;
  icon: React.ElementType;
  status: NodeStatus;
  intelligence: string;
  metrics: { label: string; value: string }[];
  logs: { time: string; msg: string }[];
}

interface EdgeData {
  source: string;
  target: string;
  path: string;
}

// --- CONSTANTS ---
const NODES: NodeData[] = [
  {
    id: 'core', label: 'Nexus Core', type: 'core', x: 0, y: 0, icon: BrainCircuit, status: 'healthy',
    intelligence: 'Orchestrating Platform',
    metrics: [{ label: 'Global Latency', value: '12ms' }, { label: 'Active Streams', value: '42' }],
    logs: [{ time: '14:58', msg: 'System pulse broadcast' }]
  },
  {
    id: 'nexus', label: 'Nexus', type: 'system', x: 0, y: -280, icon: Activity, status: 'healthy',
    intelligence: 'Research Agent: Executing',
    metrics: [{ label: 'Active Agents', value: '4' }, { label: 'Mission Queue', value: '1' }],
    logs: [{ time: '14:55', msg: 'Started Chat Mission' }, { time: '14:50', msg: 'Agent pool scaled' }]
  },
  {
    id: 'helix', label: 'Helix', type: 'system', x: 280, y: 60, icon: Server, status: 'attention',
    intelligence: 'Validating Policy Update',
    metrics: [{ label: 'Rules Enforced', value: '12,402' }, { label: 'Failovers', value: '1' }],
    logs: [{ time: '14:58', msg: 'Latency spike detected' }, { time: '14:57', msg: 'Policy sync initiated' }]
  },
  {
    id: 'matrix', label: 'Matrix', type: 'system', x: -180, y: 220, icon: Shield, status: 'healthy',
    intelligence: 'Sandbox Environment Active',
    metrics: [{ label: 'Threats Blocked', value: '0' }, { label: 'Integrity', value: '100%' }],
    logs: [{ time: '14:42', msg: 'Security Scan Finished' }]
  },
  {
    id: 'memory', label: 'Knowledge Base', type: 'system', x: -280, y: -80, icon: Database, status: 'syncing',
    intelligence: 'Indexing Enterprise Knowledge',
    metrics: [{ label: 'Active Embeddings', value: '1.2M' }, { label: 'Freshness', value: '98%' }],
    logs: [{ time: '14:58', msg: 'Payroll docs embedded' }, { time: '14:49', msg: 'Drive synchronized' }]
  }
];

const EDGES: EdgeData[] = [
  { source: 'core', target: 'nexus', path: 'M 0 0 L 0 -280' },
  { source: 'core', target: 'helix', path: 'M 0 0 L 280 60' },
  { source: 'core', target: 'matrix', path: 'M 0 0 L -180 220' },
  { source: 'core', target: 'memory', path: 'M 0 0 L -280 -80' },
  { source: 'memory', target: 'nexus', path: 'M -280 -80 Q -140 -180 0 -280' },
  { source: 'nexus', target: 'helix', path: 'M 0 -280 Q 140 -110 280 60' },
  { source: 'helix', target: 'matrix', path: 'M 280 60 Q 50 140 -180 220' },
];

const PLATFORM_EVENTS = [
  "Research Agent completed mission",
  "Helix validated policy update",
  "Knowledge Base embedding complete",
  "Matrix refreshed sandbox",
  "New MCP connected"
];

// Sample assets shown until a document store is connected.
const SAMPLE_ASSETS: KnowledgeAsset[] = [
  {
    id: 'k1', title: 'Global HR Handbook v2', summary: 'Defines organizational policies, compensation guidelines, and conduct expectations across all departments.',
    category: 'Human Resources', collection: 'Company Policies', confidence: 99, freshness: 'Updated Today',
    source: 'SharePoint', owner: 'HR Dept', version: '2.4.1', status: 'indexed', missionUsage: 1420,
    contains: ['Compensation', 'Conduct', 'Benefits', 'Remote Work']
  },
  {
    id: 'k2', title: 'Engineering Architecture 2026', summary: 'Core technical specifications for EthicalAI, including microservices, graph databases, and memory vectorization.',
    category: 'Engineering', collection: 'Technical Specs', confidence: 94, freshness: 'Needs Review',
    source: 'GitHub', owner: 'SysArchitecture', version: '1.0.0', status: 'embedding', missionUsage: 890,
    contains: ['Microservices', 'Vector DB', 'Security', 'GraphQL']
  },
  {
    id: 'k3', title: 'US Remote Work Addendum', summary: 'Older specification detailing WFH equipment stipends. Deprecated by Global HR Handbook v2.',
    category: 'Human Resources', collection: 'Company Policies', confidence: 45, freshness: 'Stale',
    source: 'Google Drive', owner: 'Finance', version: '1.2.0', status: 'conflict', missionUsage: 12,
    contains: ['Stipends', 'Remote Work', 'Equipment']
  },
  {
    id: 'k4', title: 'Q3 Financial Projections', summary: 'Detailed financial modeling and forecasting for Q3, containing highly sensitive budget constraints.',
    category: 'Finance', collection: 'Quarterly Reports', confidence: 98, freshness: 'Fresh',
    source: 'OneDrive', owner: 'CFO Office', version: 'Final', status: 'indexed', missionUsage: 432,
    contains: ['Projections', 'Budgets', 'Q3', 'Hiring']
  }
];

// --- MAIN COMPONENT ---
export default function KnowledgeGraphDashboard() {
  const router = useRouter();
  const { setSidebarHidden } = useSidebar();
  
  const [camera, setCamera] = useState({ x: 0, y: 0, scale: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Knowledge Engine State
  const [selectedAsset, setSelectedAsset] = useState<KnowledgeAsset | null>(null);
  
  const [events, setEvents] = useState<string[]>([PLATFORM_EVENTS[0]]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarHidden(selectedNodeId === 'memory');
    
    let eventIndex = 1;
    const interval = setInterval(() => {
      setEvents(prev => {
        const next = [PLATFORM_EVENTS[eventIndex], ...prev].slice(0, 3);
        eventIndex = (eventIndex + 1) % PLATFORM_EVENTS.length;
        return next;
      });
    }, 8000);
    return () => clearInterval(interval);
  }, [setSidebarHidden, selectedNodeId]);

  const handleWheel = (e: React.WheelEvent) => {
    if (selectedNodeId) return;
    e.preventDefault();
    const scaleAdjust = e.deltaY * -0.001;
    setCamera(prev => ({
      ...prev,
      scale: Math.min(Math.max(0.5, prev.scale + scaleAdjust), 2)
    }));
  };

  const handleNodeClick = (id: string) => {
    if (isDragging) return;
    const node = NODES.find(n => n.id === id);
    if (!node) return;

    setSelectedNodeId(id);
    
    if (id === 'memory') {
      // Memory Engine handles its own full screen, just center the camera so it looks good if they exit
      setCamera({ x: -node.x, y: -node.y, scale: 1.5 });
    } else {
      setCamera({ x: -node.x - 200, y: -node.y, scale: 1.2 });
    }
  };

  const resetCamera = () => {
    setSelectedNodeId(null);
    setSelectedAsset(null);
    setCamera({ x: 0, y: 0, scale: 1 });
  };

  const selectedNode = NODES.find(n => n.id === selectedNodeId);

  return (
    <div 
      className="relative w-full h-full bg-surface text-ink overflow-hidden rounded-[24px] border border-ink/[0.04]"
      onWheel={handleWheel}
      onDoubleClick={resetCamera}
    >
      
      {/* BACKGROUND ELEMENTS */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--ink) / 0.1) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
         <motion.div 
           animate={{ rotate: 360 }} transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
           className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full border border-ink/[0.02]"
         />
         <motion.div 
           animate={{ rotate: -360 }} transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
           className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[1200px] rounded-full border border-ink/[0.02]"
         />
      </div>

      {/* GRAPH CANVAS */}
      <motion.div
        ref={containerRef}
        drag={!selectedNodeId}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setTimeout(() => setIsDragging(false), 50)}
        dragConstraints={{ left: -1000, right: 1000, top: -1000, bottom: 1000 }}
        dragElastic={0.1}
        className="absolute top-1/2 left-1/2 w-0 h-0 cursor-grab active:cursor-grabbing"
        animate={{ x: camera.x, y: camera.y, scale: camera.scale }}
        transition={{ type: "spring", stiffness: 70, damping: 20, mass: 1 }}
      >
         <svg className="absolute overflow-visible pointer-events-none" style={{ left: 0, top: 0 }}>
            {EDGES.map((edge, i) => (
               <g key={i}>
                  <path d={edge.path} fill="none" stroke="hsl(var(--ink) / 0.04)" strokeWidth="2" />
                  <motion.path 
                    d={edge.path} fill="none" stroke="hsl(var(--ink) / 0.4)" strokeWidth="2"
                    strokeDasharray="4 200" initial={{ strokeDashoffset: 200 }} animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.5 }}
                  />
               </g>
            ))}
         </svg>

         {NODES.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isFaded = selectedNodeId && !isSelected;
            const Icon = node.icon;

            let glowColor = "hsl(var(--ink) / 0.1)";
            let borderColor = "hsl(var(--ink) / 0.1)";
            if (node.status === 'attention') { glowColor = "rgba(245,158,11,0.1)"; borderColor = "rgba(245,158,11,0.3)"; }
            if (node.status === 'syncing') { glowColor = "hsl(var(--ink) / 0.2)"; borderColor = "hsl(var(--ink) / 0.4)"; }

            return (
               <motion.div
                 key={node.id}
                 className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-auto"
                 style={{ left: node.x, top: node.y, zIndex: isSelected ? 50 : 10 }}
                 animate={{ opacity: isFaded ? 0.3 : 1 }}
                 transition={{ duration: 0.5 }}
               >
                  <AnimatePresence>
                     {hoveredNodeId === node.id && !selectedNodeId && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                          className="absolute bottom-full mb-4 w-48 bg-surface border border-ink/[0.08] rounded-xl p-4 shadow-2xl backdrop-blur-xl z-50 pointer-events-none"
                        >
                           <h4 className="text-[12px] font-medium text-ink mb-1">{node.label}</h4>
                           <p className="text-[10px] text-ink/60 font-mono mb-3">{node.intelligence}</p>
                        </motion.div>
                     )}
                  </AnimatePresence>

                  {node.type === 'core' && (
                     <>
                        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.4, 0.1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute w-48 h-48 rounded-full border border-ink/20" />
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute w-32 h-32 rounded-full border-t border-b border-ink/20" />
                     </>
                  )}

                  <motion.button
                     onClick={() => handleNodeClick(node.id)}
                     onMouseEnter={() => setHoveredNodeId(node.id)}
                     onMouseLeave={() => setHoveredNodeId(null)}
                     whileHover={{ scale: 1.05 }}
                     whileTap={{ scale: 0.95 }}
                     className="relative flex items-center justify-center rounded-2xl bg-surface shadow-2xl transition-all"
                     style={{ width: node.type === 'core' ? 80 : 64, height: node.type === 'core' ? 80 : 64, boxShadow: `0 0 40px ${glowColor}`, border: `1px solid ${borderColor}` }}
                  >
                     <Icon size={node.type === 'core' ? 32 : 24} className={node.status === 'attention' ? 'text-amber-500' : 'text-ink/80'} />
                     {node.status === 'syncing' && (
                        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute inset-0 rounded-2xl border border-ink/40" />
                     )}
                  </motion.button>
                  <span className="mt-4 text-[12px] font-mono tracking-widest text-ink/60 uppercase">{node.label}</span>
               </motion.div>
            );
         })}
      </motion.div>

      {/* OVERLAY UI (Pointer Events None so you can drag behind it) */}
      <AnimatePresence>
        {selectedNodeId !== 'memory' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 z-40"
          >
            <div className="flex justify-center pointer-events-auto">
                <button className="flex flex-col items-center gap-1 bg-surface/80 backdrop-blur-md border border-ink/[0.08] px-6 py-3 rounded-2xl shadow-xl hover:bg-ink/[0.03] transition-colors">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">Platform Health</span>
                  <span className="text-[20px] font-display font-medium text-ink">99.2%</span>
                </button>
            </div>
            <div className="flex justify-between items-end">
                <div className="bg-surface/80 backdrop-blur-md border border-ink/[0.04] p-5 rounded-2xl w-64 pointer-events-auto">
                  <div className="flex items-center gap-2 mb-4">
                      <Clock size={12} className="text-ink/40"/>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-ink/40">System Timeline</span>
                  </div>
                  <div className="space-y-3">
                      {[ { t: '14:58', m: 'Mission Completed' }, { t: '14:54', m: 'Helix Updated' }, { t: '14:49', m: 'Google Drive Connected' } ].map((log, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <span className="text-[10px] font-mono text-ink/20 mt-0.5">{log.t}</span>
                            <span className="text-[11px] font-medium text-ink/70">{log.m}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 w-72">
                  <AnimatePresence>
                      {events.map((ev, i) => (
                        <motion.div key={ev + i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1 - (i * 0.3), x: 0, scale: 1 - (i * 0.05) }} exit={{ opacity: 0, y: -20 }} className="bg-surface/80 backdrop-blur-md border border-ink/[0.08] px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-ink/60 animate-pulse" />
                            <span className="text-[11px] font-medium text-ink/80">{ev}</span>
                        </motion.div>
                      ))}
                  </AnimatePresence>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STANDARD RIGHT PANEL INSPECTOR (For non-memory nodes) */}
      <AnimatePresence>
         {selectedNode && selectedNode.id !== 'memory' && (
            <motion.div 
               initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
               className="absolute right-0 top-0 bottom-0 w-[420px] bg-surface border-l border-ink/[0.04] shadow-[-20px_0_40px_hsl(var(--surface) / 0.8)] z-50 flex flex-col pointer-events-auto"
            >
               <div className="h-20 px-8 border-b border-ink/[0.04] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                     <div className="h-10 w-10 rounded-xl bg-ink/5 flex items-center justify-center border border-ink/10">
                        {selectedNode && <selectedNode.icon size={18} className="text-ink" />}
                     </div>
                     <div>
                        <h2 className="text-[15px] font-medium text-ink">{selectedNode.label}</h2>
                        <span className="text-[10px] font-mono tracking-widest uppercase text-ink/40">{selectedNode.status}</span>
                     </div>
                  </div>
                  <button onClick={resetCamera} className="p-2 rounded-lg text-ink/40 hover:text-ink hover:bg-ink/5 transition-colors"><X size={16}/></button>
               </div>
               <div className="flex-1 overflow-y-auto p-8 space-y-10">
                  <div>
                     <span className="text-[10px] font-mono tracking-widest uppercase text-ink/40 mb-3 block">Current Intelligence</span>
                     <div className="bg-surface border border-ink/[0.06] rounded-2xl p-5 flex items-center gap-3">
                        <ActivitySquare size={16} className={selectedNode.status === 'attention' ? 'text-amber-500' : 'text-ink/60'} />
                        <span className="text-[13px] font-medium text-ink/90">{selectedNode.intelligence}</span>
                     </div>
                  </div>
                  <div>
                     <span className="text-[10px] font-mono tracking-widest uppercase text-ink/40 mb-3 block">Live Metrics</span>
                     <div className="grid grid-cols-2 gap-4">
                        {selectedNode.metrics.map((m, i) => (
                           <div key={i} className="bg-surface border border-ink/[0.04] rounded-xl p-4">
                              <span className="block text-[20px] font-display text-ink">{m.value}</span>
                              <span className="block text-[10px] font-mono text-ink/40 uppercase mt-1">{m.label}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
               <div className="p-6 border-t border-ink/[0.04] bg-surface">
                  <button 
                     onClick={() => {
                        if (selectedNode.id === 'helix') router.push('/helix');
                        else if (selectedNode.id === 'matrix') router.push('/matrix');
                        else if (selectedNode.id === 'nexus' || selectedNode.id === 'core') router.push('/');
                        else if (selectedNode.id === 'memory') setSelectedNodeId('memory');
                        else router.push('/' + selectedNode.id);
                     }} 
                     className="w-full flex items-center justify-center gap-2 bg-ink text-brand-ink py-3.5 rounded-xl text-[12px] font-bold tracking-wide transition-transform hover:scale-[1.02]"
                  >
                     OPEN DASHBOARD <ExternalLink size={14} />
                  </button>
               </div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* KNOWLEDGE BASE INTELLIGENCE ENGINE (FULL SCREEN TAKEOVER) */}
      <AnimatePresence>
        {selectedNode?.id === 'memory' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 bg-surface z-50 flex flex-col pointer-events-auto"
          >
            {selectedAsset ? (
              <AssetWorkspace asset={selectedAsset} onBack={() => setSelectedAsset(null)} />
            ) : (
              <>
                <header className="px-10 py-6 border-b border-ink/5 bg-surface/80 backdrop-blur-xl relative z-10 flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <button onClick={resetCamera} className="p-2 rounded-full hover:bg-ink/10 transition-colors group">
                      <ArrowLeft className="w-5 h-5 text-ink/50 group-hover:text-ink transition-colors" />
                    </button>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-3 mb-1">
                        <Database className="h-5 w-5 text-blue-400" />
                        <h1 className="text-sm font-mono font-bold uppercase tracking-[0.4em] text-ink">Knowledge Intelligence Engine</h1>
                      </div>
                      <p className="text-ink/55 text-xs">The organizational memory and semantic reasoning core.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="flex flex-col items-end group">
                      <span className="text-[10px] uppercase tracking-widest text-ink/40">Knowledge Health</span>
                      <span className="text-2xl font-mono text-ink flex items-center gap-2">
                        98.7% <span className="w-2 h-2 rounded-full bg-ink/70 animate-pulse" />
                      </span>
                    </div>
                  </div>
                </header>

                <div className="flex-grow overflow-y-auto scrollbar-hide p-10 relative">
                  <div className="max-w-7xl mx-auto w-full grid grid-cols-12 gap-8">
                    {/* Left Column */}
                    <div className="col-span-8 flex flex-col gap-8">
                      <KnowledgeAssistant />
                      
                      <div>
                        <h2 className="text-xl font-display mb-6 flex items-center gap-3">
                          Knowledge Intelligence Library
                          <span className="px-2 py-0.5 rounded-full bg-ink/5 text-ink/40 text-[10px] uppercase tracking-widest">{SAMPLE_ASSETS.length} Assets</span>
                        </h2>
                        
                        <div className="grid grid-cols-1 gap-6">
                          {SAMPLE_ASSETS.map(asset => (
                            <KnowledgeCard key={asset.id} asset={asset} onClick={setSelectedAsset} />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="col-span-4 flex flex-col gap-8">
                      <div className="h-[350px]">
                        <LiveKnowledgeActivity />
                      </div>
                      <ConnectedSources />
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
