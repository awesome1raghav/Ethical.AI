"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ArrowLeft, Target, Terminal, Shield } from "lucide-react";

// Components
import { SecurityCard, SecurityPolicy } from "@/components/matrix/SecurityCard";
import { LiveThreatActivity } from "@/components/matrix/LiveThreatActivity";
import { SecurityGraph } from "@/components/matrix/SecurityGraph";
import { AttackSimulator } from "@/components/matrix/AttackSimulator";
import { ThreatIntelligence } from "@/components/matrix/ThreatIntelligence";
import { SecurityConflictDetector } from "@/components/matrix/SecurityConflictDetector";
import { AISecurityInput } from "@/components/matrix/AISecurityInput";

const SAMPLE_POLICIES: SecurityPolicy[] = [
  {
    id: "m1", name: "Prompt Injection Prevention", purpose: "Detect and sanitize malicious payload injections attempting to alter agent behavior.",
    riskCategory: "Critical", status: "active", confidence: 99.8,
    protectedMissions: 18402, protectedAgents: 12, protectedResources: 140,
    lastTriggered: "4m ago", threatsPrevented: 1402, falsePositives: 2,
    createdBy: "System", governanceAlignment: "High"
  },
  {
    id: "m2", name: "Strict Internal Network Access", purpose: "Isolate agents from accessing internal subnets unless explicitly permitted by Governance.",
    riskCategory: "High", status: "conflict", confidence: 94.2,
    protectedMissions: 4320, protectedAgents: 4, protectedResources: 80,
    lastTriggered: "1h ago", threatsPrevented: 89, falsePositives: 1,
    createdBy: "Admin", governanceAlignment: "Medium"
  },
  {
    id: "m3", name: "Credential Exposure Isolation", purpose: "Prevent agents from transmitting detected secrets outside of approved vaults.",
    riskCategory: "Critical", status: "active", confidence: 100,
    protectedMissions: 92400, protectedAgents: 18, protectedResources: 200,
    lastTriggered: "12m ago", threatsPrevented: 450, falsePositives: 0,
    createdBy: "System", governanceAlignment: "High"
  },
  {
    id: "m4", name: "Allow Developer Terminal", purpose: "Permit developers to execute arbitrary commands via the Browser Agent.",
    riskCategory: "Low", status: "conflict", confidence: 75.0,
    protectedMissions: 0, protectedAgents: 2, protectedResources: 1,
    lastTriggered: "Never", threatsPrevented: 0, falsePositives: 0,
    createdBy: "DevTeam", governanceAlignment: "Low"
  }
];

export default function MatrixSecurityEnginePage() {
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);
  const [policies, setPolicies] = useState<SecurityPolicy[]>(SAMPLE_POLICIES);

  // Background computational particle layer
  const ParticleLayer = () => (
    <div className="fixed inset-0 pointer-events-none z-0 opacity-20">
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/[0.01] rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '10s' }} />
      <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-ink/[0.01] rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '7s' }} />
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full relative bg-surface text-ink overflow-hidden">
      <ParticleLayer />

      {/* Global Header */}
      <header className="px-10 py-6 border-b border-ink/5 bg-surface/80 backdrop-blur-xl relative z-10 flex justify-between items-center">
        <div className="flex flex-col">
          <div className="flex items-center gap-3 mb-1">
            <ShieldAlert className="h-5 w-5 text-ink/50" />
            <h1 className="text-sm font-mono font-bold uppercase tracking-[0.4em] text-ink">EthicalAI Matrix Security</h1>
          </div>
          <p className="text-ink/55 text-xs">Autonomous threat detection and mitigation.</p>
        </div>
        
        {/* Security Health */}
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-end cursor-pointer group">
            <span className="text-[10px] uppercase tracking-widest text-ink/40 group-hover:text-ink/70 transition-colors">Security Health</span>
            <span className="text-2xl font-mono text-ink flex items-center gap-2">
              99.4%
              <span className="w-2 h-2 rounded-full bg-ink/70 animate-pulse" />
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-grow relative z-10 overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedPolicy ? (
            // MAIN DASHBOARD
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              className="h-full flex flex-col p-10 overflow-y-auto scrollbar-hide"
            >
              <div className="max-w-7xl mx-auto w-full flex gap-8">
                {/* Left Column: Library & Input */}
                <div className="flex-1 flex flex-col gap-8">
                  <AISecurityInput />
                  
                  <div>
                    <h2 className="text-xl font-display mb-6 flex items-center gap-3">
                      Security Intelligence Library
                      <span className="px-2 py-0.5 rounded-full bg-ink/5 text-ink/40 text-[10px] uppercase tracking-widest">{policies.length} Policies</span>
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {policies.map(policy => (
                        <SecurityCard 
                          key={policy.id} 
                          policy={policy} 
                          onClick={setSelectedPolicy} 
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Mission Impact Overview */}
                  <div className="mt-4 p-8 rounded-2xl bg-ink/[0.01] border border-ink/5 grid grid-cols-4 gap-6">
                    <div>
                      <span className="text-ink/40 text-[10px] uppercase tracking-widest block mb-2">Protected Missions</span>
                      <span className="text-2xl font-mono text-ink">114,832</span>
                    </div>
                    <div>
                      <span className="text-ink/40 text-[10px] uppercase tracking-widest block mb-2">Threats Mitigated</span>
                      <span className="text-2xl font-mono text-ink">2,051</span>
                    </div>
                    <div>
                      <span className="text-ink/40 text-[10px] uppercase tracking-widest block mb-2">Avg Mitigation Time</span>
                      <span className="text-2xl font-mono text-ink">12ms</span>
                    </div>
                    <div>
                      <span className="text-ink/40 text-[10px] uppercase tracking-widest block mb-2">False Positives</span>
                      <span className="text-2xl font-mono text-ink">3</span>
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Stream */}
                <div className="w-[400px] shrink-0">
                  <LiveThreatActivity />
                </div>
              </div>
            </motion.div>
          ) : (
            // POLICY WORKSPACE
            <motion.div 
              key="workspace"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 bg-surface flex flex-col overflow-y-auto scrollbar-hide"
            >
              {/* Workspace Header */}
              <div className="sticky top-0 z-20 px-10 py-6 border-b border-ink/5 bg-surface/95 backdrop-blur flex justify-between items-center">
                <div className="flex items-center gap-6">
                  <button 
                    onClick={() => setSelectedPolicy(null)}
                    className="p-2 rounded-full hover:bg-ink/10 transition-colors group"
                  >
                    <ArrowLeft className="w-5 h-5 text-ink/50 group-hover:text-ink transition-colors" />
                  </button>
                  <div>
                    <h2 className="text-2xl font-display text-ink mb-1">{selectedPolicy.name}</h2>
                    <div className="flex items-center gap-4 text-xs text-ink/40 uppercase tracking-widest">
                      <span>{selectedPolicy.riskCategory} Risk</span>
                      <span>•</span>
                      <span>Confidence: {selectedPolicy.confidence}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <button className="nexus-button bg-transparent border-ink/10 text-ink hover:bg-ink/5">
                    Discard
                  </button>
                  <button className="nexus-button bg-ink text-brand-ink hover:bg-ink/90 border-transparent">
                    Deploy Intelligence
                  </button>
                </div>
              </div>

              {/* Workspace Content */}
              <div className="p-10 max-w-7xl mx-auto w-full grid grid-cols-12 gap-8 pb-32">
                
                {/* Left Column: Logic & Graph */}
                <div className="col-span-8 flex flex-col gap-8">
                  {selectedPolicy.status === 'conflict' && (
                    <SecurityConflictDetector />
                  )}
                  
                  <div className="mb-4">
                    <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-4">Policy Purpose</h3>
                    <p className="text-ink/80 text-lg leading-relaxed">
                      {selectedPolicy.purpose}
                    </p>
                  </div>

                  <ThreatIntelligence />
                  
                  <div>
                    <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-4 mt-4">Security Relationship Graph</h3>
                    <SecurityGraph />
                  </div>
                </div>

                {/* Right Column: Simulator & Impact */}
                <div className="col-span-4 flex flex-col gap-8">
                  {/* Live Impact Preview */}
                  <div className="bg-surface rounded-2xl border border-ink/10 p-6">
                    <h3 className="text-ink/40 text-xs uppercase tracking-widest mb-6">Live Security Impact</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                        <span className="text-ink/60">Affected Agents</span>
                        <span className="text-ink">12</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                        <span className="text-ink/60">Affected Resources</span>
                        <span className="text-ink">140</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-ink/5 pb-4">
                        <span className="text-ink/60">Security Health</span>
                        <span className="text-emerald-400">+0.1%</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-ink/60">Risk Reduction</span>
                        <span className="text-ink">Significant</span>
                      </div>
                    </div>
                  </div>

                  <AttackSimulator />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
