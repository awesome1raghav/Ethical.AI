"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Lock, Key, Search, Clock, Database, Github, ShieldCheck, 
  Slack, Mail, Server, Activity, ArrowRight, Settings, Plus,
  MoreVertical, Eye, EyeOff, RotateCw, Trash2, ShieldAlert
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---
type Integration = {
  id: string;
  name: string;
  provider: string;
  status: 'connected' | 'disconnected';
  lastConnected: string;
  authMethod: string;
  enabled: boolean;
  secrets: Secret[];
};

type Secret = {
  id: string;
  name: string;
  type: string;
  value: string;
  lastRotated: string;
  expiry: string | null;
};

type Policy = {
  id: string;
  name: string;
  value: string;
  status: 'active' | 'inactive';
  action: string;
};

type Limit = {
  id: string;
  name: string;
  value: string;
  usage: string;
  capacity: string;
  enabled: boolean;
  action: string;
};

// Sample records shown until audit storage is connected.
const initialIntegrations: Integration[] = [
  {
    id: "int-1", name: "GitHub OS", provider: "GitHub", status: "connected",
    lastConnected: "2 min ago", authMethod: "OAuth Token", enabled: true,
    secrets: [{ id: "sec-1", name: "GitHub Personal Access", type: "OAuth Token", value: "ghp_xxxxxxxxxxxxxxxxxxx", lastRotated: "2 days ago", expiry: "2024-12-31" }]
  },
  {
    id: "int-2", name: "Production DB", provider: "PostgreSQL", status: "connected",
    lastConnected: "Just now", authMethod: "Username/Password", enabled: true,
    secrets: [{ id: "sec-2", name: "DB Admin Password", type: "Password", value: "sUpErSeCrEt123!", lastRotated: "1 week ago", expiry: null }]
  },
  {
    id: "int-3", name: "Alerts Channel", provider: "Slack", status: "disconnected",
    lastConnected: "Never", authMethod: "Webhook", enabled: false,
    secrets: []
  },
  {
    id: "int-4", name: "AWS Cloud", provider: "AWS", status: "connected",
    lastConnected: "1 hr ago", authMethod: "IAM Role", enabled: true,
    secrets: [{ id: "sec-3", name: "AWS Access Key", type: "API Key", value: "AKIAIOSFODNN7EXAMPLE", lastRotated: "1 month ago", expiry: "2025-01-01" }]
  }
];

const initialPolicies: Policy[] = [
  { id: "pol-1", name: "Maximum Execution Time", value: "120 Seconds", status: "active", action: "Stop Mission" },
  { id: "pol-2", name: "Retry Attempts", value: "3 Retries", status: "active", action: "Notify User" },
  { id: "pol-3", name: "Maximum Tool Calls", value: "50 Calls", status: "active", action: "Pause Mission" }
];

const initialLimits: Limit[] = [
  { id: "lim-1", name: "Monthly Budget", value: "$5,000.00", usage: "$1,240.50", capacity: "75% Free", enabled: true, action: "Stop Mission" },
  { id: "lim-2", name: "Token Limit (Daily)", value: "50,000,000", usage: "12,400,000", capacity: "75% Free", enabled: true, action: "Require Human Approval" },
  { id: "lim-3", name: "Budget Per Mission", value: "$5.00", usage: "-", capacity: "-", enabled: true, action: "Pause Mission" }
];

// --- Sub-components ---
const IntegrationIcon = ({ provider }: { provider: string }) => {
  switch (provider) {
    case 'GitHub': return <Github className="h-5 w-5" />;
    case 'PostgreSQL': return <Database className="h-5 w-5" />;
    case 'Slack': return <Slack className="h-5 w-5" />;
    case 'AWS': return <Server className="h-5 w-5" />;
    default: return <Settings className="h-5 w-5" />;
  }
};

export default function BlackBoxDashboard() {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations);
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [limits, setLimits] = useState<Limit[]>(initialLimits);

  // Panel States
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [addingSecret, setAddingSecret] = useState(false);
  const [addingPolicy, setAddingPolicy] = useState(false);
  const [editingLimit, setEditingLimit] = useState<Limit | null>(null);

  // Utility to hide secrets
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-col min-h-full w-full mx-auto max-w-[1400px] px-8 md:px-12 py-10 text-ink bg-transparent font-body relative overflow-x-hidden">
      
      {/* ── HEADER ── */}
      <header className="mb-12 border-b border-ink/[0.04] pb-6 flex items-end justify-between">
         <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 rounded-lg bg-ink/5 border border-ink/10 flex items-center justify-center">
                 <Lock className="h-4 w-4 text-ink" />
              </div>
              <span className="text-[10px] font-mono font-bold tracking-[0.4em] text-ink/40 uppercase">
                Secure Execution Configuration
              </span>
            </div>
            <h1 className="text-[32px] font-display font-medium text-ink tracking-tight">BLACKBOX</h1>
            <p className="text-[13px] text-ink/40 mt-1 max-w-2xl">
              Define the execution boundaries, integrate external secure systems, and manage operational budgets that govern all autonomous AI missions.
            </p>
         </div>
      </header>

      {/* ── 1. SECURE INTEGRATIONS ── */}
      <section className="mb-16">
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-display font-medium text-ink flex items-center gap-2"><Key className="h-4 w-4"/> Secure Integrations</h2>
            <button className="text-[11px] font-mono text-ink/60 hover:text-ink transition-colors border border-ink/10 rounded-lg px-3 py-1.5 hover:bg-ink/5">
              + New Integration
            </button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {integrations.map((int) => (
              <div key={int.id} className="bg-surface border border-ink/[0.04] rounded-2xl p-5 hover:border-ink/10 transition-colors flex flex-col group relative">
                 <div className="flex justify-between items-start mb-4">
                    <div className="h-10 w-10 rounded-xl bg-ink/5 border border-ink/10 flex items-center justify-center text-ink/60 group-hover:text-ink transition-colors">
                      <IntegrationIcon provider={int.provider} />
                    </div>
                    <div className={cn("h-2 w-2 rounded-full", int.status === 'connected' ? 'bg-ink shadow-[0_0_8px_hsl(var(--ink) / 0.4)]' : 'bg-ink/25')} />
                 </div>
                 <h3 className="text-[14px] font-medium text-ink mb-1">{int.name}</h3>
                 <p className="text-[11px] font-mono text-ink/40 uppercase tracking-widest">{int.provider}</p>
                 
                 <div className="mt-6 pt-4 border-t border-ink/[0.04] flex flex-col gap-2">
                    <div className="flex justify-between text-[11px] font-mono text-ink/60">
                       <span>Auth</span>
                       <span className="text-ink/80">{int.authMethod}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-ink/60">
                       <span>Last Sync</span>
                       <span className="text-ink/80">{int.lastConnected}</span>
                    </div>
                 </div>

                 <button 
                   onClick={() => setSelectedIntegration(int)}
                   className="mt-6 w-full py-2 rounded-xl bg-ink/5 border border-ink/10 text-[11px] font-mono text-ink/80 hover:bg-ink hover:text-brand-ink font-bold transition-all uppercase tracking-wider"
                 >
                   Modify Integration
                 </button>
              </div>
            ))}
         </div>
      </section>

      {/* ── 2. EXECUTION POLICIES ── */}
      <section className="mb-16">
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-display font-medium text-ink flex items-center gap-2"><ShieldCheck className="h-4 w-4"/> Execution Policies</h2>
            <button 
              onClick={() => setAddingPolicy(true)}
              className="text-[11px] font-mono text-ink/60 hover:text-ink transition-colors border border-ink/10 rounded-lg px-3 py-1.5 hover:bg-ink/5"
            >
              + Add Policy
            </button>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {policies.map((pol) => (
               <div key={pol.id} className="bg-surface border border-ink/[0.04] rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest block mb-2">{pol.name}</span>
                    <span className="text-[24px] font-medium text-ink block mb-6">{pol.value}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-ink/[0.04]">
                     <span className="text-[11px] font-mono text-ink/60">Action: <span className="text-ink/90">{pol.action}</span></span>
                     <button className="text-ink/40 hover:text-ink"><Settings size={14}/></button>
                  </div>
               </div>
            ))}
         </div>
      </section>

      {/* ── 3. BUDGET & USAGE LIMITS ── */}
      <section className="mb-10">
         <div className="flex items-center justify-between mb-6">
            <h2 className="text-[16px] font-display font-medium text-ink flex items-center gap-2"><Activity className="h-4 w-4"/> Budget & Usage Limits</h2>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {limits.map((lim) => (
               <div key={lim.id} className="bg-surface border border-ink/[0.04] rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-[10px] font-mono text-ink/40 uppercase tracking-widest">{lim.name}</span>
                       <div className={cn("px-2 py-0.5 rounded text-[9px] font-mono uppercase", lim.enabled ? "bg-ink/10 text-ink" : "bg-ink/5 text-ink/40")}>
                          {lim.enabled ? 'Enabled' : 'Disabled'}
                       </div>
                    </div>
                    <span className="text-[28px] font-display font-medium text-ink block mb-2">{lim.value}</span>
                    <div className="flex justify-between text-[11px] font-mono text-ink/60 mb-6">
                       <span>Usage: <strong className="text-ink">{lim.usage}</strong></span>
                       <span>{lim.capacity}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-ink/[0.04]">
                     <span className="text-[10px] font-mono text-ink/40 max-w-[150px] leading-tight">Breach: <span className="text-ink">{lim.action}</span></span>
                     <button onClick={() => setEditingLimit(lim)} className="px-3 py-1.5 rounded-lg border border-ink/10 text-[11px] font-mono text-ink/80 hover:bg-ink/10 transition-colors">
                        Modify Limit
                     </button>
                  </div>
               </div>
            ))}
         </div>
      </section>

      {/* ── SIDE PANEL: MODIFY INTEGRATION ── */}
      <AnimatePresence>
         {selectedIntegration && (
            <>
               <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 onClick={() => setSelectedIntegration(null)}
                 className="fixed inset-0 z-40 bg-surface/80 backdrop-blur-sm"
               />
               <motion.div
                 initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                 className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-[600px] bg-surface border-l border-ink/[0.06] shadow-2xl flex flex-col"
               >
                  <div className="flex items-center gap-4 p-6 border-b border-ink/[0.06]">
                     <button onClick={() => setSelectedIntegration(null)} className="p-2 rounded-lg hover:bg-ink/5 text-ink/60 hover:text-ink transition-colors">
                        <ArrowRight className="h-5 w-5 rotate-180" />
                     </button>
                     <div className="flex-1">
                        <h2 className="text-[18px] font-display font-medium text-ink">{selectedIntegration.name}</h2>
                        <p className="text-[11px] font-mono text-ink/40 uppercase tracking-widest">{selectedIntegration.provider}</p>
                     </div>
                     <div className={cn("px-2 py-1 rounded text-[10px] font-mono uppercase tracking-widest", selectedIntegration.status === 'connected' ? 'bg-ink/10 text-ink' : 'bg-ink/25 text-ink/40')}>
                        {selectedIntegration.status}
                     </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 scrollbar-hide flex flex-col gap-8">
                     
                     {/* Connection Details */}
                     <div>
                        <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-4">Connection Details</h3>
                        <div className="space-y-4">
                           <div className="bg-surface border border-ink/5 rounded-xl p-4 flex justify-between items-center">
                              <span className="text-[13px] text-ink/80">Enable Integration for BlackBox</span>
                              <div className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", selectedIntegration.enabled ? "bg-ink" : "bg-ink/20")}>
                                 <div className={cn("absolute top-1 w-3 h-3 bg-surface rounded-full transition-all", selectedIntegration.enabled ? "right-1" : "left-1")} />
                              </div>
                           </div>
                           <div className="grid grid-cols-2 gap-4">
                              <div className="bg-surface border border-ink/5 rounded-xl p-4">
                                 <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Auth Method</label>
                                 <input type="text" readOnly value={selectedIntegration.authMethod} className="w-full bg-transparent border-none text-[13px] text-ink outline-none" />
                              </div>
                              <div className="bg-surface border border-ink/5 rounded-xl p-4">
                                 <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Target Endpoint</label>
                                 <input type="text" readOnly value="api.external.com" className="w-full bg-transparent border-none text-[13px] text-ink outline-none" />
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Secret Vault (Nested) */}
                     <div>
                        <div className="flex items-center justify-between mb-4">
                           <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40">Integration Secret Vault</h3>
                           <button onClick={() => setAddingSecret(true)} className="flex items-center gap-1.5 text-[11px] font-mono text-ink/80 hover:text-ink bg-ink/5 hover:bg-ink/10 border border-ink/10 px-3 py-1.5 rounded-lg transition-colors">
                              <Plus size={12}/> Add Secret
                           </button>
                        </div>

                        {selectedIntegration.secrets.length === 0 ? (
                           <div className="p-8 border border-dashed border-ink/10 rounded-2xl text-center text-ink/40 text-[12px] font-mono">
                              No secrets stored for this integration.
                           </div>
                        ) : (
                           <div className="space-y-3">
                              {selectedIntegration.secrets.map(sec => (
                                 <div key={sec.id} className="bg-surface border border-ink/5 rounded-2xl p-5 flex flex-col gap-4 group">
                                    <div className="flex justify-between items-start">
                                       <div>
                                          <h4 className="text-[13px] font-medium text-ink">{sec.name}</h4>
                                          <p className="text-[10px] font-mono text-ink/40 uppercase tracking-widest">{sec.type}</p>
                                       </div>
                                       <div className="flex gap-2">
                                          <button title="Rotate Secret" className="p-1.5 rounded bg-ink/5 hover:bg-ink/10 text-ink/60 hover:text-ink transition-colors"><RotateCw size={14}/></button>
                                          <button title="Delete Secret" className="p-1.5 rounded bg-ink/5 hover:bg-rose-500/20 text-ink/60 hover:text-rose-400 transition-colors"><Trash2 size={14}/></button>
                                       </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                       <code className="flex-1 bg-brand-ink border border-ink/10 rounded-lg px-3 py-2 text-[12px] font-mono text-ink/80">
                                          {visibleSecrets.has(sec.id) ? sec.value : "••••••••••••••••••••••••"}
                                       </code>
                                       <button onClick={() => toggleSecretVisibility(sec.id)} className="p-2.5 rounded-lg bg-brand-ink border border-ink/10 hover:bg-ink/10 text-ink/60 hover:text-ink transition-colors">
                                          {visibleSecrets.has(sec.id) ? <EyeOff size={16}/> : <Eye size={16}/>}
                                       </button>
                                    </div>
                                    <div className="flex justify-between text-[10px] font-mono text-ink/40 uppercase pt-2 border-t border-ink/5">
                                       <span>Rotated: {sec.lastRotated}</span>
                                       <span>Expires: {sec.expiry || 'Never'}</span>
                                    </div>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>

                  </div>
               </motion.div>
            </>
         )}
      </AnimatePresence>

      {/* ── MODAL: ADD SECRET ── */}
      <AnimatePresence>
         {addingSecret && (
            <motion.div className="fixed inset-0 z-[60] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
               <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-surface border border-ink/10 rounded-2xl w-full max-w-md p-6">
                  <h3 className="text-[18px] font-display font-medium text-ink mb-6">Add Secret</h3>
                  <div className="space-y-4">
                     <div>
                        <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Secret Name</label>
                        <input type="text" placeholder="e.g. Production Database Key" className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-2.5 text-[13px] text-ink outline-none focus:border-ink/40" />
                     </div>
                     <div>
                        <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Secret Value</label>
                        <textarea placeholder="Paste secret here..." rows={3} className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-2.5 text-[13px] font-mono text-ink outline-none focus:border-ink/40 resize-none" />
                     </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                     <button onClick={() => setAddingSecret(false)} className="px-4 py-2 text-[12px] text-ink/60 hover:text-ink">Cancel</button>
                     <button onClick={() => setAddingSecret(false)} className="px-4 py-2 text-[12px] font-bold bg-ink text-brand-ink hover:bg-ink/90 rounded-xl">Save & Encrypt</button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* ── MODAL: ADD/MODIFY POLICY ── */}
      <AnimatePresence>
         {addingPolicy && (
            <motion.div className="fixed inset-0 z-[60] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
               <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-surface border border-ink/10 rounded-2xl w-full max-w-md p-6">
                  <h3 className="text-[18px] font-display font-medium text-ink mb-6">Configure Policy</h3>
                  <div className="space-y-4">
                     <div>
                        <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Policy Type</label>
                        <select className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-3 text-[13px] text-ink outline-none focus:border-ink/40">
                           <option>Maximum Execution Time</option>
                           <option>Retry Attempts</option>
                           <option>Queue Capacity</option>
                           <option>Tool Calls</option>
                        </select>
                     </div>
                     <div>
                        <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Configured Value</label>
                        <input type="text" placeholder="e.g. 120 Seconds" className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-2.5 text-[13px] text-ink outline-none focus:border-ink/40" />
                     </div>
                     <div>
                        <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Action when limit reached</label>
                        <select className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-3 text-[13px] text-ink outline-none focus:border-ink/40">
                           <option>Stop Mission</option>
                           <option>Pause Mission</option>
                           <option>Require Human Approval</option>
                           <option>Notify User</option>
                        </select>
                     </div>
                  </div>
                  <div className="flex justify-end gap-3 mt-8">
                     <button onClick={() => setAddingPolicy(false)} className="px-4 py-2 text-[12px] text-ink/60 hover:text-ink">Cancel</button>
                     <button onClick={() => setAddingPolicy(false)} className="px-4 py-2 text-[12px] font-bold bg-ink text-brand-ink hover:bg-ink/90 rounded-xl">Enforce Policy</button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

      {/* ── MODAL: MODIFY LIMIT ── */}
      <AnimatePresence>
         {editingLimit && (
            <motion.div className="fixed inset-0 z-[60] bg-surface/80 backdrop-blur-sm flex items-center justify-center p-4">
               <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-surface border border-ink/10 rounded-2xl w-full max-w-md p-6 flex flex-col gap-6">
                  <div className="flex items-center gap-3">
                     <ShieldAlert className="h-6 w-6 text-ink/60"/>
                     <h3 className="text-[18px] font-display font-medium text-ink">Modify Usage Limit</h3>
                  </div>
                  <div>
                     <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">{editingLimit.name} Threshold</label>
                     <input type="text" defaultValue={editingLimit.value} className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-3 text-[18px] font-display font-bold text-ink outline-none focus:border-ink/40" />
                  </div>
                  <div>
                     <label className="text-[10px] font-mono text-ink/40 uppercase block mb-1">Limit Behavior</label>
                     <select defaultValue={editingLimit.action} className="w-full bg-surface border border-ink/10 rounded-xl px-4 py-3 text-[13px] text-ink outline-none focus:border-ink/40">
                        <option value="Stop Mission">Stop Mission</option>
                        <option value="Pause Mission">Pause Mission</option>
                        <option value="Require Human Approval">Require Human Approval</option>
                        <option value="Notify User">Notify User</option>
                     </select>
                  </div>
                  <div className="flex items-center gap-4 bg-surface border border-ink/5 p-4 rounded-xl">
                     <div className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", editingLimit.enabled ? "bg-ink" : "bg-ink/20")}>
                        <div className={cn("absolute top-1 w-3 h-3 bg-surface rounded-full transition-all", editingLimit.enabled ? "right-1" : "left-1")} />
                     </div>
                     <span className="text-[12px] text-ink/80">Enable this system limit</span>
                  </div>
                  <div className="flex justify-end gap-3 mt-2">
                     <button onClick={() => setEditingLimit(null)} className="px-4 py-2 text-[12px] text-ink/60 hover:text-ink">Cancel</button>
                     <button onClick={() => setEditingLimit(null)} className="px-4 py-2 text-[12px] font-bold bg-ink text-brand-ink hover:bg-ink/90 rounded-xl">Save Limit</button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>

    </div>
  );
}
