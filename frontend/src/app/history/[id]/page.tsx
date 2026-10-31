"use client";

import React, { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { 
  ArrowLeft, Download, Share2, Play, Copy, 
  Cpu, Database, HardDrive, CheckCircle2, ShieldCheck, 
  Activity, Clock, User as UserIcon, Zap, FileText, Bot, 
  CheckCircle, Globe
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMissionById, getChatHistory } from "@/app/actions/db-actions";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const costData = [
  { name: 'Compute / Inference', value: 0.024, color: '#FFFFFF' },
  { name: 'Vector Storage', value: 0.008, color: '#666666' },
  { name: 'API Services', value: 0.010, color: '#333333' }
];

export default function MissionAnalyticsScreen({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const missionId = resolvedParams.id;
  
  const [mission, setMission] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getMissionById(missionId);
        if (data) {
          setMission(data);
          const hist = await getChatHistory(missionId);
          setHistory(hist || []);
        }
      } catch (err) {} finally {
        setLoading(false);
      }
    }
    load();
  }, [missionId]);

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center"><Activity className="animate-spin text-ink/20" /></div>;
  }

  if (!mission) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center">
        <h2 className="text-ink text-lg font-medium">Mission Not Found</h2>
        <Link href="/history" className="mt-4 text-ink/60 hover:text-ink underline text-sm">Return to History</Link>
      </div>
    );
  }

  const handleEditableMission = () => {
    sessionStorage.setItem("editable_mission_prompt", mission.description);
    router.push("/");
  };

  // Extract unique agents used
  const agents = Array.from(new Set(history.map(h => h.agent_name).filter(Boolean)));

  return (
    <div className="flex flex-col h-full w-full mx-auto max-w-[1400px] px-8 md:px-12 py-10 overflow-y-auto scrollbar-hide text-ink bg-transparent font-body">
      
      {/* ── TOP NAVIGATION ── */}
      <nav className="flex items-center justify-between mb-8 pb-4 border-b border-ink/[0.04]">
        <div className="flex items-center gap-4">
          <Link href="/history" className="p-2 rounded-lg hover:bg-ink/5 transition-colors text-ink/60 hover:text-ink">
             <ArrowLeft size={16} />
          </Link>
          <span className="text-[14px] font-display font-medium text-ink">Mission Analytics</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ink/5 hover:bg-ink/5 text-[11px] font-mono text-ink/60 hover:text-ink transition-colors">
            <Download size={14} /> Download Report
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ink/5 hover:bg-ink/5 text-[11px] font-mono text-ink/60 hover:text-ink transition-colors">
            <Share2 size={14} /> Share
          </button>
          <div className="w-px h-4 bg-ink/10 mx-2" />
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-ink/5 hover:bg-ink/5 text-[11px] font-mono text-ink/60 hover:text-ink transition-colors">
            <Play size={14} /> Re-run Mission
          </button>
          <button onClick={handleEditableMission} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ink text-brand-ink text-[11px] font-mono font-bold hover:bg-ink/90 transition-colors">
            <Copy size={14} /> Editable Mission
          </button>
        </div>
      </nav>

      {/* ── MISSION HEADER ── */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
         <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 rounded bg-ink/10 text-ink font-mono text-[10px] tracking-widest uppercase">{mission.id}</span>
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-ink/10 bg-ink/5 text-[10px] font-mono text-ink/80 uppercase">
                <CheckCircle2 size={12} className="text-ink/40" /> Completed
              </span>
            </div>
            <h1 className="text-[28px] md:text-[32px] font-display font-medium leading-tight max-w-2xl text-ink">
              {mission.primary_intent}
            </h1>
         </div>
         <div className="flex items-center gap-8 text-right">
            <div>
               <span className="block text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-1">Duration</span>
               <span className="block text-[18px] font-medium text-ink">4.2s</span>
            </div>
            <div>
               <span className="block text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-1">Executed On</span>
               <span className="block text-[18px] font-medium text-ink">{new Date(mission.created_at).toLocaleDateString()}</span>
               <span className="block text-[10px] font-mono text-ink/40">{new Date(mission.created_at).toLocaleTimeString()}</span>
            </div>
         </div>
      </header>

      {/* ── MISSION SUMMARY MODULES ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-10">
        <div className="col-span-2 bg-surface border border-ink/[0.04] rounded-2xl p-6">
          <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-2 block">AI Models Deployed</span>
          <div className="flex flex-wrap gap-2 mt-2">
             <span className="px-2 py-1 bg-ink/5 border border-ink/10 rounded text-[11px] font-mono text-ink">Gemma 4 12B</span>
             <span className="px-2 py-1 bg-ink/5 border border-ink/10 rounded text-[11px] font-mono text-ink">NeMo Guardrails</span>
          </div>
        </div>
        <div className="col-span-1 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-1 block">Total Cost</span>
          <span className="text-[20px] font-medium text-ink block leading-none">${((mission.stored_tokens || 1000) * 0.00002).toFixed(4)}</span>
        </div>
        <div className="col-span-1 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-1 block">Tokens Used</span>
          <span className="text-[20px] font-medium text-ink block leading-none">{(mission.stored_tokens || 1420).toLocaleString()}</span>
        </div>
        <div className="col-span-2 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col justify-center">
          <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-1 block">Approval Status</span>
          <span className="flex items-center gap-2 text-[14px] font-medium text-ink"><ShieldCheck size={16}/> Matrix Auto-Approved</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Resource usage (sample values) */}
        <div className="lg:col-span-1 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col">
           <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-6 flex items-center gap-2"><Cpu size={14}/> Resource Load</h3>
           <div className="space-y-6 flex-1">
              <div>
                 <div className="flex justify-between text-[11px] font-mono mb-2"><span className="text-ink/60">Compute Core</span> <span className="text-ink">68%</span></div>
                 <div className="h-1 bg-ink/5 rounded-full overflow-hidden"><div className="h-full bg-ink/80 w-[68%]" /></div>
              </div>
              <div>
                 <div className="flex justify-between text-[11px] font-mono mb-2"><span className="text-ink/60">Memory Swarm</span> <span className="text-ink">1.2 GB</span></div>
                 <div className="h-1 bg-ink/5 rounded-full overflow-hidden"><div className="h-full bg-ink/60 w-[45%]" /></div>
              </div>
              <div>
                 <div className="flex justify-between text-[11px] font-mono mb-2"><span className="text-ink/60">Network Bandwidth</span> <span className="text-ink">12 MB/s</span></div>
                 <div className="h-1 bg-ink/5 rounded-full overflow-hidden"><div className="h-full bg-ink/40 w-[20%]" /></div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-ink/[0.04]">
                 <div>
                   <span className="block text-[10px] font-mono text-ink/40">API Calls</span>
                   <span className="block text-[16px] font-medium text-ink">42</span>
                 </div>
                 <div>
                   <span className="block text-[10px] font-mono text-ink/40">Tool Calls</span>
                   <span className="block text-[16px] font-medium text-ink">14</span>
                 </div>
              </div>
           </div>
        </div>

        {/* ── COST BREAKDOWN ── */}
        <div className="lg:col-span-1 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col">
           <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-2 flex items-center gap-2"><Database size={14}/> Cost Distribution</h3>
           <div className="flex-1 w-full flex items-center justify-center">
             <ResponsiveContainer width="100%" height="80%">
               <PieChart>
                 <Pie data={costData} innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                   {costData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid hsl(var(--ink) / 0.1)', borderRadius: '8px', fontSize: '11px', color: '#fff' }}
                   itemStyle={{ color: '#fff' }}
                   formatter={(val: number) => `$${val.toFixed(3)}`}
                 />
               </PieChart>
             </ResponsiveContainer>
           </div>
           <div className="flex justify-center gap-4 text-[9px] font-mono uppercase tracking-widest mt-2">
             <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-ink"/> Compute</span>
             <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-ink/50"/> Vector</span>
             <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-ink/25"/> API</span>
           </div>
        </div>

        {/* ── HUMAN INTERVENTION LOG ── */}
        <div className="lg:col-span-1 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col">
           <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-6 flex items-center gap-2"><UserIcon size={14}/> Human Intervention</h3>
           <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
              <CheckCircle size={32} className="mb-4 text-ink/80" />
              <p className="text-[13px] font-medium text-ink mb-1">No Intervention Required</p>
              <p className="text-[11px] text-ink/60 max-w-[200px] leading-relaxed">Mission executed entirely autonomously within governance thresholds.</p>
           </div>
        </div>
      </div>

      {/* ── TOOL CALLS & INTEGRATIONS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
         <div className="bg-surface border border-ink/[0.04] rounded-2xl p-6">
            <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-6 flex items-center gap-2"><Zap size={14}/> Tool Calls Audit</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-ink/[0.04]">
                  <th className="pb-3 text-[10px] font-mono text-ink/40 uppercase font-medium">Tool Name</th>
                  <th className="pb-3 text-[10px] font-mono text-ink/40 uppercase font-medium">Provider</th>
                  <th className="pb-3 text-[10px] font-mono text-ink/40 uppercase font-medium">Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/[0.04]">
                 {['Web Scraper', 'Database Query', 'Semantic Search'].map((tool, i) => (
                    <tr key={i}>
                       <td className="py-3 text-[12px] font-medium text-ink">{tool}</td>
                       <td className="py-3 text-[12px] text-ink/60">System</td>
                       <td className="py-3 text-[11px] font-mono text-ink/80">{(120 + i*40)}ms</td>
                    </tr>
                 ))}
              </tbody>
            </table>
         </div>

         <div className="bg-surface border border-ink/[0.04] rounded-2xl p-6">
            <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-6 flex items-center gap-2"><Globe size={14}/> Connected Integrations</h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between p-3 rounded-lg border border-ink/5 bg-ink/[0.02]">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-ink/5 border border-ink/10 flex items-center justify-center text-[10px]">GH</div>
                     <span className="text-[12px] font-medium text-ink">GitHub OAuth</span>
                  </div>
                  <span className="text-[10px] font-mono text-ink/40 uppercase">Used 3 times</span>
               </div>
               <div className="flex items-center justify-between p-3 rounded-lg border border-ink/5 bg-ink/[0.02]">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-ink/5 border border-ink/10 flex items-center justify-center text-[10px]">SL</div>
                     <span className="text-[12px] font-medium text-ink">Slack Webhook</span>
                  </div>
                  <span className="text-[10px] font-mono text-ink/40 uppercase">Used 1 time</span>
               </div>
            </div>
         </div>
      </div>

      {/* ── FINAL OUTPUT ── */}
      <div className="bg-surface border border-ink/[0.04] rounded-2xl p-8 mb-20">
         <div className="flex items-center justify-between mb-8 pb-4 border-b border-ink/[0.04]">
            <h3 className="text-[14px] font-display font-medium text-ink flex items-center gap-2"><FileText size={16}/> Final Mission Output</h3>
            <button className="text-[10px] font-mono uppercase tracking-widest text-ink/60 hover:text-ink transition-colors flex items-center gap-1.5"><Copy size={12}/> Copy Output</button>
         </div>
         <div className="prose prose-invert prose-p:text-ink/60 prose-headings:text-ink/90 max-w-none text-[13px] leading-relaxed">
            {history.length > 0 ? (
               history.filter(h => h.sender === 'assistant' && h.message.includes('Output')).map((h, i) => (
                  <div key={i} className="mb-6 pb-6 border-b border-ink/[0.04] last:border-0">
                     <p>{h.message}</p>
                  </div>
               ))
            ) : (
               <p className="opacity-60 italic">No output artifacts captured for this mission.</p>
            )}
         </div>
      </div>
    </div>
  );
}
