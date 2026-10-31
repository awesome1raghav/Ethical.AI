"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  History, Search, Filter, Trash2, Calendar, 
  Activity, CheckCircle, Clock, RefreshCw, BarChart3,
  MoreVertical, FileText, Download, Play, Copy, ArrowUpRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMissionsHistory, deleteMission, type MissionRecord } from "@/app/actions/db-actions";
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

// Sample chart data; mission metrics are not aggregated yet.
const activityData = [
  { name: 'Mon', count: 12 }, { name: 'Tue', count: 19 }, { name: 'Wed', count: 15 },
  { name: 'Thu', count: 25 }, { name: 'Fri', count: 22 }, { name: 'Sat', count: 30 }, { name: 'Sun', count: 28 }
];

const statusData = [
  { name: 'Completed', value: 75, color: '#FFFFFF' },
  { name: 'Failed', value: 5, color: '#333333' },
  { name: 'Cancelled', value: 20, color: '#666666' }
];

export default function MissionHistoryDashboard() {
  const router = useRouter();
  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const logsRef = useRef<HTMLDivElement>(null);
  
  // Filters
  const [filterRisk, setFilterRisk] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  
  // Context Menu
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Delete Confirmation
  const [missionToDelete, setMissionToDelete] = useState<MissionRecord | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const records = await getMissionsHistory();
      setMissions(records);
    } catch (err) {
      console.error("Failed to load mission history from DB:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const confirmDelete = async () => {
    if (!missionToDelete) return;
    const targetId = missionToDelete.id;
    setMissionToDelete(null);
    setMissions((prev) => prev.filter((m) => m.id !== targetId));
    try {
      await deleteMission(targetId);
    } catch (err) {}
  };

  const handleEditableMission = (mission: MissionRecord) => {
    sessionStorage.setItem("editable_mission_prompt", mission.description);
    router.push("/");
  };

  const filteredMissions = missions.filter((m) => {
    const matchesSearch = 
      m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.primary_intent.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRisk = filterRisk === "ALL" || m.risk_level.toUpperCase() === filterRisk;
    return matchesSearch && matchesRisk;
  });

  const scrollToLogs = () => {
    logsRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col min-h-full w-full mx-auto px-8 md:px-12 py-10 text-ink bg-transparent font-body relative">
      
      {/* Scroll to Logs Button (Floating) */}
      <button 
        onClick={scrollToLogs}
        className="fixed bottom-10 right-10 z-50 p-4 rounded-full bg-surface border border-ink/[0.1] text-ink/60 hover:text-ink hover:bg-surface shadow-2xl transition-all hover:scale-105 group"
        title="Scroll to Logs"
      >
        <ArrowUpRight className="h-5 w-5 rotate-135 group-hover:-translate-y-0.5 transition-transform" style={{ transform: 'rotate(135deg)' }} />
      </button>

      {/* ── 1. GLOBAL SEARCH & FILTER TOOLBAR ── */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-8 bg-surface border border-ink/[0.04] p-2 rounded-2xl sticky top-0 z-20 shadow-2xl backdrop-blur-xl">
        <div className="relative flex-grow w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search missions by ID, intent, or keywords..."
            className="w-full bg-surface border border-transparent rounded-xl pl-12 pr-4 py-3 text-[13px] text-ink placeholder:text-ink/20 focus:border-ink/10 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 shrink-0 pr-2 overflow-x-auto w-full md:w-auto scrollbar-hide">
           <Filter className="h-4 w-4 text-ink/40 ml-2 mr-1" />
           <select className="bg-surface border border-ink/5 rounded-lg px-3 py-2 text-[11px] font-mono outline-none text-ink/70 hover:text-ink cursor-pointer">
              <option>Date: All Time</option>
              <option>Past 24 Hours</option>
              <option>Past Week</option>
           </select>
           <select 
             value={filterRisk} 
             onChange={(e) => setFilterRisk(e.target.value)}
             className="bg-surface border border-ink/5 rounded-lg px-3 py-2 text-[11px] font-mono outline-none text-ink/70 hover:text-ink cursor-pointer"
           >
              <option value="ALL">Risk: All</option>
              <option value="LOW">Risk: Low</option>
              <option value="MEDIUM">Risk: Medium</option>
              <option value="HIGH">Risk: High</option>
           </select>
           <button onClick={loadData} className="p-2 rounded-lg border border-ink/5 hover:bg-ink/5 transition-colors">
              <RefreshCw className={cn("h-4 w-4 text-ink/60", loading && "animate-spin")} />
           </button>
        </div>
      </div>

      {/* ── 2. MISSION OVERVIEW METRICS ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Total Missions', value: missions.length.toString() },
          { label: 'Success Rate', value: '98.5%' },
          { label: 'Avg Execution Time', value: '14.2s' },
          { label: 'Avg Cost', value: '$0.04' },
          { label: 'Tokens Processed', value: '1.2M' },
          { label: 'Avg Risk Score', value: 'Low' }
        ].map((metric, i) => (
          <div key={i} className="bg-surface border border-ink/[0.04] rounded-2xl p-5 flex flex-col justify-center">
            <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest mb-1 block">{metric.label}</span>
            <span className="text-[24px] font-display font-medium text-ink block leading-none">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* ── 3. USAGE & PERFORMANCE ANALYTICS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        
        {/* Activity Chart */}
        <div className="lg:col-span-2 bg-surface border border-ink/[0.04] rounded-2xl p-6 h-[280px] flex flex-col">
           <div className="flex items-center justify-between mb-6">
              <span className="text-[12px] font-mono uppercase tracking-widest text-ink/40">Mission Activity Trend</span>
              <Activity className="h-4 w-4 text-ink/20" />
           </div>
           <div className="flex-1 w-full min-h-0">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={activityData}>
                 <defs>
                   <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.15}/>
                     <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid hsl(var(--ink) / 0.1)', borderRadius: '8px', fontSize: '12px' }}
                   itemStyle={{ color: '#fff' }}
                   cursor={{ stroke: 'hsl(var(--ink) / 0.1)', strokeWidth: 1 }}
                 />
                 <Area type="monotone" dataKey="count" stroke="#FFFFFF" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Status Distribution */}
        <div className="lg:col-span-1 bg-surface border border-ink/[0.04] rounded-2xl p-6 h-[280px] flex flex-col">
           <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-mono uppercase tracking-widest text-ink/40">Status Distribution</span>
              <BarChart3 className="h-4 w-4 text-ink/20" />
           </div>
           <div className="flex-1 w-full min-h-0 flex items-center justify-center">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={statusData} innerRadius={60} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                   {statusData.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={entry.color} />
                   ))}
                 </Pie>
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid hsl(var(--ink) / 0.1)', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                   itemStyle={{ color: '#fff' }}
                 />
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* ── 4. MISSION LIST ── */}
      <div ref={logsRef} className="flex-1 bg-surface border border-ink/[0.04] rounded-2xl flex flex-col overflow-hidden">
        <div className="p-6 border-b border-ink/[0.04] flex justify-between items-center bg-surface">
          <h2 className="text-[16px] font-display font-medium text-ink">Execution Logs</h2>
          <span className="text-[11px] font-mono text-ink/40">{filteredMissions.length} records found</span>
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-ink/[0.04] bg-surface">
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-ink/40 font-medium">Mission ID</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-ink/40 font-medium">Intent</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-ink/40 font-medium">Risk</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-ink/40 font-medium hidden md:table-cell">Tokens</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-ink/40 font-medium hidden lg:table-cell">Cost (Est)</th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-widest text-ink/40 font-medium right-0">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/[0.04]">
              {filteredMissions.map((mission) => (
                <tr key={mission.id} className="hover:bg-ink/[0.02] transition-colors group relative">
                  <td className="px-6 py-4">
                    <Link href={`/history/${mission.id}`} className="text-[13px] font-mono font-medium text-ink group-hover:underline">
                      {mission.id}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-body text-ink/80 line-clamp-1 max-w-[200px]">{mission.primary_intent}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 rounded bg-ink/5 border border-ink/10 text-[9px] font-mono text-ink/60 uppercase">
                      {mission.risk_level || "LOW"}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell text-[12px] font-mono text-ink/60">
                    {(mission.stored_tokens || 1420).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell text-[12px] font-mono text-ink/60">
                    ${((mission.stored_tokens || 1420) * 0.00002).toFixed(4)}
                  </td>
                  
                  {/* ── 5. ACTIONS CONTEXT MENU ── */}
                  <td className="px-6 py-4 relative">
                    <button 
                      onClick={() => setActiveMenuId(activeMenuId === mission.id ? null : mission.id)}
                      className="p-1.5 rounded-md hover:bg-ink/10 text-ink/40 hover:text-ink transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === mission.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuId(null)} />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-10 top-10 z-40 w-48 bg-surface border border-ink/[0.08] rounded-xl shadow-2xl overflow-hidden py-1"
                          >
                            <Link href={`/history/${mission.id}`} className="flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-ink/80 hover:text-ink hover:bg-ink/5 transition-colors">
                              <ArrowUpRight size={14} /> View Analytics
                            </Link>
                            <button className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-ink/80 hover:text-ink hover:bg-ink/5 transition-colors">
                              <FileText size={14} /> Download Report
                            </button>
                            <button className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-ink/80 hover:text-ink hover:bg-ink/5 transition-colors">
                              <Download size={14} /> Export Logs
                            </button>
                            <div className="h-px bg-ink/5 my-1" />
                            <button onClick={() => handleEditableMission(mission)} className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-ink/80 hover:text-ink hover:bg-ink/5 transition-colors">
                              <Copy size={14} /> Editable Mission
                            </button>
                            <button className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-ink/80 hover:text-ink hover:bg-ink/5 transition-colors">
                              <Play size={14} /> Re-run Mission
                            </button>
                            <div className="h-px bg-ink/5 my-1" />
                            <button 
                              onClick={() => { setMissionToDelete(mission); setActiveMenuId(null); }}
                              className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-[11px] font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                            >
                              <Trash2 size={14} /> Delete Record
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))}
              {filteredMissions.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-[12px] font-mono text-ink/40">No missions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DELETE MODAL */}
      <AnimatePresence>
        {missionToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-rose-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4"
            >
              <h3 className="text-lg font-display font-bold text-ink">Delete Mission Record?</h3>
              <p className="text-[13px] font-body text-ink/55 leading-relaxed">
                Are you sure you want to delete mission <span className="font-mono text-ink font-bold">{missionToDelete.id}</span>? 
                This action is permanent.
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMissionToDelete(null)} className="px-4 py-2 rounded-xl border border-ink/10 text-ink text-[12px] hover:bg-ink/5">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 rounded-xl bg-rose-900/50 text-rose-200 border border-rose-500/30 text-[12px] hover:bg-rose-900 transition-colors">Delete Mission</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
