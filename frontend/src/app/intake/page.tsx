"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Brain, Cpu, Database, ShieldCheck, Lock, CheckCircle2,
  Globe, Network, Zap, Search, Rocket, Server, ChevronDown, ChevronUp,
  Cloud, HardDrive, Terminal, Building, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { saveMission } from "@/app/actions/db-actions";
import { createNexusMission } from "@/app/actions/nexus-backend-bridge";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

// Backend AgentType names -> the agent ids seeded in agents_registry. Mirrors
// the mapping in app/page.tsx -- this page dispatches missions too (the
// chat-mode "Execute with Agents" escalation path lands here), so it needs
// the same real translation, not a second copy that drifts.
const AGENT_ID_MAP: Record<string, string> = {
  ResearchAgent: "research_agent",
  BrowserAgent: "research_agent",
  SummaryAgent: "knowledge_agent",
  CitationAgent: "knowledge_agent",
  ReasoningAgent: "knowledge_agent",
  CodingAgent: "execution_agent",
  FileAgent: "execution_agent",
  ReportAgent: "execution_agent",
  ChatAgent: "knowledge_agent",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type BootPhase = 'IDLE' | 'CORE_BOOT' | 'BOOTING_NEXUS' | 'BOOTING_RESOURCES' | 'BOOTING_HELIX' | 'BOOTING_MATRIX' | 'SYNC' | 'READY';
type NodeStatus = 'waiting' | 'initializing' | 'ready';
type NodeId = 'CORE' | 'NEXUS' | 'HELIX' | 'MATRIX' | 'RESOURCES';
type RecommendationStatus = 'Recommended' | 'Optional' | 'Not Recommended';
type RuntimeType = 'Cloud API' | 'Local' | 'MCP Tool' | 'Enterprise Service';

interface AgentDetail {
  id: string; name: string; shortDesc: string; model: string; provider: string;
  recStatus: RecommendationStatus; recReason: string; runtimeType: RuntimeType;
  whyModel: string; enabled: boolean; icon: any; angle: number;
  estRuntime: string; estCost: string; confidence: number; resourcesUsed: string[];
}

interface PolicyCheck { id: string; name: string; ruleId: string; status: 'passed'; reason: string; }
interface SecurityCheck { id: string; component: string; status: string; details: string; sandboxType: string; }
interface ResourceItem { id: string; name: string; type: string; status: string; purpose: string; permissions: string; connectionType: string; icon: any; }

// ─── Graph Geometry ───────────────────────────────────────────────────────────
const CX = 350, CY = 255;
const NODE_POS: Record<NodeId, { x: number; y: number }> = {
  CORE:      { x: CX,       y: CY },
  HELIX:     { x: CX,       y: CY - 165 },
  NEXUS:     { x: CX + 190, y: CY },
  RESOURCES: { x: CX - 190, y: CY },
  MATRIX:    { x: CX,       y: CY + 165 },
};

const NEXUS_X = NODE_POS.NEXUS.x, NEXUS_Y = NODE_POS.NEXUS.y;
const AGENT_R = 82;
const BOOT_ORDER: NodeId[] = ['RESOURCES', 'NEXUS', 'MATRIX', 'HELIX'];
const PHASE_TO_NODE: Partial<Record<BootPhase, NodeId>> = {
  BOOTING_NEXUS:'NEXUS', BOOTING_RESOURCES:'RESOURCES', BOOTING_HELIX:'HELIX', BOOTING_MATRIX:'MATRIX',
};
const CTA_LABEL: Record<string, string> = {
  CORE_BOOT:'Connect External Resources', BOOTING_RESOURCES:'Connecting Resources…',
  NEXUS_DONE:'Initialize Intelligence Layer', BOOTING_NEXUS:'Initializing Intelligence…',
  MATRIX_DONE:'Initialize Secure Runtime', BOOTING_MATRIX:'Securing Runtime…',
  HELIX_DONE:'Validate Governance', BOOTING_HELIX:'Validating Governance…',
  SYNC:'Synchronizing Architecture…', READY:'Begin Mission Execution',
};

function agentPos(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return { x: NEXUS_X + AGENT_R * Math.cos(rad), y: NEXUS_Y + AGENT_R * Math.sin(rad) };
}

// ─── Data Sets ────────────────────────────────────────────────────────────────
const FULL_AGENTS: AgentDetail[] = [
  { id:'a1', name:'Research Agent', shortDesc:'Collects external intelligence, parses documentation, and synthesizes structured research.', model:'Gemma 4 12B', provider:'Ollama (local)', recStatus:'Recommended', recReason:'Required because mission objective requires deep external data synthesis and structured research.', runtimeType:'Local', whyModel:'Gemma 4 12B runs locally with structured JSON output, so research data never leaves the machine.', enabled:true, icon:Search, angle:-90, estRuntime:'45s', estCost:'$0.00', confidence:98, resourcesUsed:['GitHub','Uploaded Files','Web Search'] },
  { id:'a2', name:'Analysis Agent', shortDesc:'Evaluates mission constraints, performs multi-criteria reasoning, and constructs execution plans.', model:'Gemma 4 12B', provider:'Ollama (local)', recStatus:'Recommended', recReason:'Essential for evaluating complex governance parameters and generating execution steps.', runtimeType:'Local', whyModel:'Gemma 4 12B handles multi-step reasoning locally, behind the Helix guardrails.', enabled:true, icon:Network, angle:-30, estRuntime:'30s', estCost:'$0.00', confidence:96, resourcesUsed:['Internal Knowledge Base','Notion'] },
  { id:'a3', name:'Browser Agent', shortDesc:'Automates interactive web workflows, extracts DOM telemetry, and executes browser sessions.', model:'Gemma 4 12B', provider:'Ollama (local)', recStatus:'Optional', recReason:'Can autonomously verify web portal status, but essential data is already available via APIs.', runtimeType:'Local', whyModel:'browser-use drives the browser with Gemma 4 12B as its local planner.', enabled:false, icon:Globe, angle:30, estRuntime:'60s', estCost:'$0.00', confidence:91, resourcesUsed:['Browser MCP'] },
  { id:'a4', name:'Code Agent', shortDesc:'Generates, reviews, and refactors mission-critical code artifacts in secure sandboxes.', model:'Gemma 4 12B', provider:'Ollama (local)', recStatus:'Not Recommended', recReason:'This mission does not require code generation or programmatic software refactoring.', runtimeType:'Local', whyModel:'Gemma 4 12B writes code locally with zero data egress.', enabled:false, icon:Zap, angle:90, estRuntime:'15s', estCost:'$0.00', confidence:94, resourcesUsed:['Local Workspace'] },
  { id:'a5', name:'Database Agent', shortDesc:'Queries enterprise databases, validates schema integrity, and executes sanitized SQL operations.', model:'Enterprise DB Connector', provider:'Enterprise Service', recStatus:'Optional', recReason:'Allows real-time verification of database records if mission requires deep auditing.', runtimeType:'Enterprise Service', whyModel:'Enterprise Connector selected to abide by corporate IAM roles and encrypted TLS tunnels.', enabled:false, icon:Database, angle:150, estRuntime:'10s', estCost:'Included', confidence:99, resourcesUsed:['Financial Records DB'] },
];

const HELIX_POLICIES: PolicyCheck[] = [
  { id:'p1', name:'Data Egress & Privacy', ruleId:'POL-DAT-09', status:'passed', reason:'All sensitive entities will be automatically redacted before cloud API transit.' },
  { id:'p2', name:'Role-Based Access Control', ruleId:'POL-IAM-02', status:'passed', reason:'User session verified with Tier-3 Enterprise Administrator privileges.' },
  { id:'p3', name:'Financial Autonomy Limit', ruleId:'POL-FIN-14', status:'passed', reason:'Mission cost cap estimated at $0.02, far below the $5.00 auto-approval threshold.' },
  { id:'p4', name:'Human-in-the-Loop Gate', ruleId:'POL-HITL-01', status:'passed', reason:'No irreversible database mutations or external emails detected.' },
  { id:'p5', name:'Ethical Risk Boundaries', ruleId:'POL-ETH-05', status:'passed', reason:'Zero harmful, illegal, or anti-competitive intent patterns detected.' },
];
const MATRIX_CHECKS: SecurityCheck[] = [
  { id:'s1', component:'gVisor Kernel Sandbox', status:'active', sandboxType:'gVisor Container', details:'Isolated system call interception active with zero root privileges.' },
  { id:'s2', component:'Secrets Isolation Engine', status:'isolated', sandboxType:'HashiCorp Vault', details:'Ephemeral API tokens injected in memory; zero disk persistence.' },
  { id:'s3', component:'Network Isolation Tunnel', status:'active', sandboxType:'mTLS Tunnel', details:'Outbound HTTP strictly whitelist-restricted to verified AI provider endpoints.' },
  { id:'s4', component:'Credential Verification', status:'verified', sandboxType:'OAuth 2.0 PKCE', details:'All enterprise service tokens cryptographically verified.' },
];
const CONNECTED_RESOURCES: ResourceItem[] = [
  { id:'r1', name:'Internal Knowledge Base', type:'Vector Index', status:'Indexed', purpose:'Provides domain-specific policy context and past mission logs.', permissions:'Read-Only', connectionType:'Pinecone Vector DB', icon:Database },
  { id:'r2', name:'GitHub Enterprise', type:'Code Repository', status:'Connected', purpose:'Retrieves architectural specifications and schema definitions.', permissions:'Read-Only', connectionType:'GitHub OAuth API', icon:Globe },
  { id:'r3', name:'Notion Workspace', type:'Documentation', status:'Verified', purpose:'Parses team requirements and mission operational guidelines.', permissions:'Read-Only', connectionType:'Notion Integration API', icon:FileText },
  { id:'r4', name:'Financial Records DB', type:'Database', status:'Connected', purpose:'Queries budget parameters if financial agent is enabled.', permissions:'Restricted Read', connectionType:'PostgreSQL TLS Tunnel', icon:Server },
];

const NODE_META: Record<NodeId, { label: string; icon: any; desc: string }> = {
  CORE:      { label:'NEXUS CORE', icon:Brain,      desc:'Orchestration Engine' },
  HELIX:     { label:'HELIX',      icon:ShieldCheck, desc:'Governance Engine' },
  NEXUS:     { label:'NEXUS',      icon:Cpu,         desc:'Intelligence Layer' },
  RESOURCES: { label:'RESOURCES',  icon:Database,    desc:'External Dependencies' },
  MATRIX:    { label:'MATRIX',     icon:Lock,        desc:'Security Environment' },
};

// ─── SVG Defs ─────────────────────────────────────────────────────────────────
const SVGDefs = () => (
  <defs>
    <filter id="glow-strong" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="6" result="b1"/><feGaussianBlur stdDeviation="14" result="b2"/>
      <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-soft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="glow-particle" x="-200%" y="-200%" width="500%" height="500%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="bloom-node" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="center-light" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="30" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="hsl(var(--ink) / 0.04)"/>
      <stop offset="100%" stopColor="hsl(var(--surface) / 0)"/>
    </radialGradient>
    {/* Engineering grid pattern */}
    <pattern id="eng-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--ink) / 0.015)" strokeWidth="0.5"/>
    </pattern>
  </defs>
);

// ─── Ambient Background ───────────────────────────────────────────────────────
const BackgroundLayer = () => {
  const dustParticles = useMemo(() => Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: (i * 137.5) % 100,
    y: (i * 97.3) % 100,
    size: 0.8 + (i % 3) * 0.6,
    opacity: 0.03 + (i % 4) * 0.02,
    dur: 8 + (i % 7) * 3,
    dx: (i % 2 === 0 ? 8 : -8),
    delay: i * 0.35,
  })), []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Ambient center radial */}
      <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 60% 55% at 42% 50%, hsl(var(--ink) / 0.025) 0%, transparent 60%)' }}/>
      {/* Edge vignette */}
      <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 130% 130% at 50% 50%, transparent 36%, hsl(var(--surface) / 0.75) 100%)' }}/>
      {/* Floating dust — multi-depth parallax */}
      {dustParticles.map(d => (
        <motion.div key={d.id}
          className="absolute rounded-full bg-ink"
          style={{ left:`${d.x}%`, top:`${d.y}%`, width:d.size, height:d.size, opacity:0 }}
          animate={{ opacity:[0, d.opacity, 0], y:[0, -20, 0], x:[0, d.dx, 0] }}
          transition={{ duration:d.dur, repeat:Infinity, ease:'easeInOut', delay:d.delay }}
        />
      ))}
    </div>
  );
};

// ─── Expanding Halo Rings (Active Node Pulse) ─────────────────────────────────
function ExpandingHalo({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <>
      {[0, 1.5, 3].map((delay, i) => (
        <motion.circle key={i} cx={x} cy={y} r={50}
          fill="none" stroke={color} strokeWidth={0.8}
          animate={{ r:[52, 100], opacity:[0.5, 0] }}
          transition={{ duration:3, repeat:Infinity, ease:'easeOut', delay, repeatDelay:1 }}
        />
      ))}
    </>
  );
}

// ─── Ambient Heartbeat Particles (on ready edges) ────────────────────────────
function HeartbeatParticle({ from, to, delayOffset }: { from: NodeId; to: NodeId; delayOffset: number }) {
  const s = NODE_POS[from]; const t = NODE_POS[to];
  return (
    <motion.circle r={1.2} fill="white" filter="url(#glow-particle)"
      initial={{ cx:s.x, cy:s.y, opacity:0 }}
      animate={{ cx:[s.x, t.x], cy:[s.y, t.y], opacity:[0, 0.5, 0.5, 0] }}
      transition={{ duration:3.5, ease:'easeInOut', repeat:Infinity, repeatDelay:4 + delayOffset, times:[0,0.1,0.9,1], delay:delayOffset }}
    />
  );
}

// ─── Data Edge with Animated Gradient ────────────────────────────────────────
function DataEdge({ from, to, status }: { from: NodeId; to: NodeId; status: NodeStatus }) {
  const s = NODE_POS[from]; const t = NODE_POS[to];
  const active = status === 'initializing';
  const ready  = status === 'ready';
  const lineColor = ready ? '#10b981' : '#3b82f6';

  return (
    <g>
      {/* Ghost base line */}
      <line x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="white" strokeWidth={0.5}
        opacity={ready ? 0.15 : 0.05}/>
      {/* Strong glow line — permanent after ready */}
      <motion.line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
        stroke={lineColor} strokeWidth={3} filter="url(#glow-strong)"
        animate={{ opacity: ready ? 0.9 : active ? 0.95 : 0 }}
        transition={{ duration:0.7 }}
      />
      {/* Crisp core line */}
      <motion.line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
        stroke={lineColor} strokeWidth={1.2}
        animate={{ opacity: ready ? 0.95 : active ? 1 : 0 }}
        transition={{ duration:0.7 }}
      />
      {/* Active init particle */}
      <AnimatePresence>
        {active && (
          <motion.circle r={2.5} fill="white" filter="url(#glow-particle)"
            initial={{ cx:s.x, cy:s.y, opacity:0 }}
            animate={{ cx:[s.x,t.x], cy:[s.y,t.y], opacity:[0,1,1,0] }}
            transition={{ duration:2.2, ease:[0.22,1,0.36,1], repeat:Infinity, times:[0,0.1,0.88,1] }}
            exit={{ opacity:0 }}
          />
        )}
      </AnimatePresence>
      {/* Ambient heartbeat particles after ready */}
      {ready && (
        <>
          <HeartbeatParticle from={to} to={from} delayOffset={0} />
          <HeartbeatParticle from={to} to={from} delayOffset={2.5} />
        </>
      )}
    </g>
  );
}

// ─── Orbital Ring System for Core ─────────────────────────────────────────────
function OrbitalRings({ syncPulse }: { syncPulse: number }) {
  return (
    <g>
      {/* Ring 1 — slow clockwise */}
      <motion.ellipse cx={0} cy={0} rx={74} ry={18}
        fill="none" stroke="hsl(var(--ink) / 0.06)" strokeWidth={0.6}
        animate={{ rotate: 360 }}
        style={{ originX:'0px', originY:'0px' }}
        transition={{ duration:70, repeat:Infinity, ease:'linear' }}
      />
      {/* Ring 2 — counter-clockwise, different tilt */}
      <motion.ellipse cx={0} cy={0} rx={100} ry={25}
        fill="none" stroke="hsl(var(--ink) / 0.04)" strokeWidth={0.5}
        animate={{ rotate: -360 }}
        style={{ originX:'0px', originY:'0px' }}
        transition={{ duration:120, repeat:Infinity, ease:'linear' }}
      />
      {/* Ring 3 — breathing radar circle */}
      {[76, 110, 150].map((r, i) => (
        <motion.circle key={r} cx={0} cy={0} r={r}
          fill="none" stroke="white" strokeWidth={0.35}
          animate={{
            opacity: syncPulse > 0
              ? [0.012, 0.06, 0.012]
              : [0.008, 0.025, 0.008],
            scale: syncPulse > 0 ? [1, 1.04, 1] : [1, 1.01, 1]
          }}
          transition={{ duration: syncPulse > 0 ? 1.2 : 5+i*1.8, repeat:Infinity, ease:'easeInOut', delay:i*0.5 }}
        />
      ))}
    </g>
  );
}

// ─── Sync Pulse Ripple ────────────────────────────────────────────────────────
function SyncRipple({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <>
          {[0, 0.3, 0.6].map((delay, i) => (
            <motion.circle key={i} cx={0} cy={0} r={48}
              fill="none" stroke="hsl(var(--ink) / 0.5)" strokeWidth={1}
              initial={{ r:48, opacity:0.6 }}
              animate={{ r:180, opacity:0 }}
              transition={{ duration:1.8, ease:'easeOut', delay }}
              exit={{}}
            />
          ))}
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Core Node ────────────────────────────────────────────────────────────────
function CoreNode({
  status, onClick, selected, syncPulse, magneticOffset
}: {
  status: NodeStatus; onClick: () => void; selected: boolean;
  syncPulse: number; magneticOffset: {x:number;y:number};
}) {
  const { x, y } = NODE_POS.CORE;
  const R = 46;
  const isReady = status === 'ready';
  const [showSyncRipple, setShowSyncRipple] = useState(false);

  useEffect(() => {
    if (syncPulse > 0) {
      setShowSyncRipple(true);
      const t = setTimeout(() => setShowSyncRipple(false), 2000);
      return () => clearTimeout(t);
    }
  }, [syncPulse]);

  return (
    // Static SVG position via plain g — avoids double-transform with framer-motion
    <g transform={`translate(${x},${y})`}>
      {/* Inner motion.g carries ONLY the tiny magnetic micro-offset */}
      <motion.g
        animate={{ x: magneticOffset.x, y: magneticOffset.y }}
        transition={{ type:'spring', stiffness:180, damping:20 }}
      >
      <g onClick={onClick} style={{ cursor:'pointer' }}>
        {/* Ambient center light */}
        <circle cx={0} cy={0} r={120} fill="url(#center-glow)" filter="url(#center-light)" opacity={0.8}/>

        {/* Orbital ring system */}
        <OrbitalRings syncPulse={syncPulse} />

        {/* Sync ripple */}
        <SyncRipple active={showSyncRipple} />

        {/* Expanding halo when ready */}
        {isReady && <ExpandingHalo x={0} y={0} color="rgba(16,185,129,0.4)" />}

        {/* Orbiting micro-particles */}
        {[0, 120, 240].map((a, i) => (
          <motion.circle key={i} r={1.5} fill="white" opacity={0.3}
            animate={{ rotate: 360 }}
            style={{ originX:'0px', originY:'0px' }}
            transformTemplate={() => `rotate(${a}) translate(${R + 12}px, 0px)`}
            transition={{ duration:10+i*3, repeat:Infinity, ease:'linear', delay:i*1.2 }}
          />
        ))}

        {/* Ambient bloom */}
        {isReady && (
          <motion.circle cx={0} cy={0} r={R+24} fill="rgba(16,185,129,0.06)" filter="url(#bloom-node)"
            animate={{ opacity:[0.4,0.9,0.4] }} transition={{ duration:3.5, repeat:Infinity, ease:'easeInOut' }}
          />
        )}

        {/* Node body */}
        <motion.rect x={-R} y={-R} width={R*2} height={R*2} rx={24}
          fill="rgba(5,5,5,0.97)"
          stroke={isReady ? '#10b981' : selected ? '#ffffff' : 'hsl(var(--ink) / 0.22)'}
          strokeWidth={isReady ? 1.5 : selected ? 1.5 : 1}
          animate={{ scale:[1, 1.012, 1] }}
          transition={{ duration:5.5, repeat:Infinity, ease:'easeInOut' }}
        />
        {/* Glass reflection */}
        <line x1={-R+8} y1={-R+4} x2={R-8} y2={-R+4} stroke="white" strokeWidth={0.5} opacity={0.08}/>

        {/* Selected ring */}
        {selected && (
          <motion.rect x={-R-5} y={-R-5} width={(R+5)*2} height={(R+5)*2} rx={29}
            fill="none" stroke="white" strokeWidth={0.8} strokeOpacity={0.4} strokeDasharray="6 4"
            animate={{ rotate:360 }} style={{ originX:'0px', originY:'0px' }}
            transition={{ duration:16, repeat:Infinity, ease:'linear' }}
          />
        )}

        {/* Heartbeat icon */}
        <motion.g
          animate={{ x: magneticOffset.x * 1.5, y: magneticOffset.y * 1.5 }}
          transition={{ type:'spring', stiffness:200, damping:15 }}
        >
          <motion.g
            animate={{ scale:[1, 1.10, 1] }}
            transition={{ duration:2.6, repeat:Infinity, ease:'easeInOut' }}
          >
            <foreignObject x={-13} y={-13} width={26} height={26}>
              <div className="w-full h-full flex items-center justify-center">
                <Brain size={22} className={isReady ? 'text-emerald-400' : 'text-ink/70'} />
              </div>
            </foreignObject>
          </motion.g>
        </motion.g>

        {/* Ready dot */}
        {isReady && (
          <motion.circle cx={R-7} cy={-R+7} r={3.5} fill="#10b981"
            initial={{ scale:0,opacity:0 }} animate={{ scale:1,opacity:1 }}
          />
        )}

        <text x={0} y={R+18} textAnchor="middle" fill="white" fontSize={10}
          fontFamily="'SF Mono','Fira Code',monospace" letterSpacing="0.22em" fontWeight={600} opacity={0.8}>
          NEXUS CORE
        </text>
        <text x={0} y={R+30} textAnchor="middle"
          fill={isReady ? '#34d399' : 'white'} fontSize={8}
          fontFamily="'SF Mono','Fira Code',monospace" letterSpacing="0.14em"
          opacity={isReady ? 0.7 : 0.3}>
          {isReady ? 'READY' : 'BOOTING'}
        </text>
      </g>
      </motion.g>
    </g>
  );
}

// ─── Subsystem Node ────────────────────────────────────────────────────────────
function SubsystemNode({
  id, status, onClick, selected, magneticOffset
}: {
  id: NodeId; status: NodeStatus; onClick: () => void; selected: boolean;
  magneticOffset: {x:number;y:number};
}) {
  const { x, y } = NODE_POS[id];
  const { label, icon: Icon } = NODE_META[id];
  const R = 36;
  const active = status === 'initializing';
  const ready  = status === 'ready';
  const waiting = status === 'waiting';
  const borderColor = ready ? '#10b981' : active ? '#3b82f6' : selected ? '#ffffff' : 'hsl(var(--ink) / 0.1)';

  return (
    // Static SVG position via plain g — avoids double-transform with framer-motion
    <g transform={`translate(${x},${y})`}>
      {/* Inner motion.g carries ONLY the tiny magnetic micro-offset */}
      <motion.g
        animate={{ x: magneticOffset.x, y: magneticOffset.y }}
        transition={{ type:'spring', stiffness:180, damping:20 }}
      >
      <g onClick={onClick} style={{ cursor:'pointer' }}>
        {/* Ambient glow — permanent after status */}
        {!waiting && (
          <motion.circle cx={0} cy={0} r={R+22}
            fill={ready ? 'rgba(16,185,129,0.07)' : 'rgba(59,130,246,0.07)'}
            filter="url(#bloom-node)"
            animate={{ opacity: ready ? [0.5,1,0.5] : [0.3,0.8,0.3] }}
            transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}
          />
        )}

        {/* Expanding halo when ready */}
        {ready && <ExpandingHalo x={0} y={0} color="rgba(16,185,129,0.35)" />}

        {/* Idle breathing body */}
        <motion.rect x={-R} y={-R} width={R*2} height={R*2} rx={20}
          fill="rgba(7,7,7,0.95)"
          stroke={borderColor}
          strokeWidth={ready || active || selected ? 1.5 : 1}
          animate={{
            opacity: waiting ? 0.4 : 1,
            scale: [1, 1.015, 1],
          }}
          transition={{ scale:{ duration:6, repeat:Infinity, ease:'easeInOut', delay: Math.random() * 2 } }}
          whileHover={{ scale:1.06 }}
        />
        {/* Glass reflection */}
        <line x1={-R+6} y1={-R+4} x2={R-6} y2={-R+4} stroke="white" strokeWidth={0.4} opacity={0.07}/>

        {/* Selected ring */}
        {selected && (
          <motion.rect x={-R-5} y={-R-5} width={(R+5)*2} height={(R+5)*2} rx={25}
            fill="none" stroke="white" strokeWidth={0.8} strokeOpacity={0.4} strokeDasharray="5 4"
            animate={{ rotate:360 }} style={{ originX:'0px', originY:'0px' }}
            transition={{ duration:12, repeat:Infinity, ease:'linear' }}
          />
        )}

        {/* Floating icon — micro-animation per node type */}
        <motion.g
          animate={{ x: magneticOffset.x * 1.5, y: magneticOffset.y * 1.5 }}
          transition={{ type:'spring', stiffness:200, damping:15 }}
        >
          <motion.g
            animate={{
              y: [-2, 2, -2],
              rotate: active ? [-3, 3, -3] : id === 'HELIX' ? [-1, 1, -1] : 0,
            }}
            transition={{ y:{ duration:3.5+Number(id.charCodeAt(0)%3)*0.5, repeat:Infinity, ease:'easeInOut' }, rotate:{ duration:2, repeat:Infinity, ease:'easeInOut' } }}
          >
            <foreignObject x={-11} y={-11} width={22} height={22}>
              <div className="w-full h-full flex items-center justify-center">
                <Icon size={20} className={cn('transition-colors duration-500',
                  ready ? 'text-emerald-400' : active ? 'text-blue-400' : 'text-ink/25'
                )} />
              </div>
            </foreignObject>
          </motion.g>
        </motion.g>

        {/* Status dot */}
        {!waiting && (
          <motion.circle cx={R-6} cy={-R+6} r={3.5}
            fill={ready ? '#10b981' : '#3b82f6'}
            transition={active ? { duration:1.2,repeat:Infinity } : {}}
            initial={{ scale:0,opacity:0 }}
            animate={active ? { scale:1, opacity:[1,0.3,1] } : { scale:1, opacity:1 }}
          />
        )}

        <text x={0} y={R+18} textAnchor="middle" fill="white" fontSize={10}
          fontFamily="'SF Mono','Fira Code',monospace" letterSpacing="0.2em" fontWeight={600}
          opacity={waiting ? 0.18 : 0.78}>{label}</text>
        <text x={0} y={R+30} textAnchor="middle"
          fill={ready ? '#34d399' : active ? '#60a5fa' : 'white'}
          fontSize={8} fontFamily="'SF Mono','Fira Code',monospace" letterSpacing="0.14em"
          opacity={waiting ? 0.1 : 0.6}>
          {ready ? 'READY' : active ? 'INITIALIZING' : 'WAITING'}
        </text>
      </g>
      </motion.g>
    </g>
  );
}

// ─── Agent Satellite ──────────────────────────────────────────────────────────
function AgentSatellite({ agent, onSelect, selected, hovered, onHoverStart, onHoverEnd }: {
  agent: AgentDetail; onSelect: () => void; selected: boolean; hovered: boolean;
  onHoverStart: () => void; onHoverEnd: () => void;
}) {
  const { x, y } = agentPos(agent.angle);
  const Icon = agent.icon;
  const R = 18;
  return (
    <g>
      <line x1={NEXUS_X} y1={NEXUS_Y} x2={x} y2={y}
        stroke={hovered || selected ? '#3b82f6' : 'white'}
        strokeWidth={hovered || selected ? 1 : 0.5}
        opacity={hovered || selected ? 0.8 : agent.enabled ? 0.2 : 0.06}
        strokeDasharray={hovered || selected ? 'none' : '3 3'}
      />
      <g transform={`translate(${x},${y})`} onClick={onSelect}
        onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd} style={{ cursor:'pointer' }}>
        <motion.circle cx={0} cy={0} r={R}
          fill="rgba(8,8,8,0.94)"
          stroke={hovered ? '#3b82f6' : selected ? '#ffffff' : agent.enabled ? 'hsl(var(--ink) / 0.3)' : 'hsl(var(--ink) / 0.08)'}
          strokeWidth={hovered || selected ? 1.5 : 1}
          animate={{ opacity:agent.enabled ? 1 : 0.4, scale: hovered || selected ? 1.2 : 1 }}
          whileHover={{ scale:1.25 }}
          transition={{ type:'spring', stiffness:300, damping:20 }}
        />
        {(agent.enabled || hovered) && (
          <motion.circle cx={0} cy={0} r={R+8}
            fill={hovered ? 'rgba(59,130,246,0.12)' : 'hsl(var(--ink) / 0.04)'}
            filter="url(#glow-soft)"
            animate={{ opacity:[0.3,0.7,0.3] }} transition={{ duration:3,repeat:Infinity,ease:'easeInOut' }}
          />
        )}
        <foreignObject x={-8} y={-8} width={16} height={16}>
          <div className="w-full h-full flex items-center justify-center">
            <Icon size={12} className={hovered ? 'text-blue-400' : agent.enabled ? 'text-ink/80' : 'text-ink/20'} />
          </div>
        </foreignObject>
        <text x={0} y={R+12} textAnchor="middle" fill={hovered ? '#60a5fa' : 'white'}
          fontSize={7} fontFamily="'SF Mono','Fira Code',monospace"
          letterSpacing="0.1em" opacity={hovered ? 0.9 : agent.enabled ? 0.55 : 0.15}>
          {agent.name.split(' ')[0].toUpperCase()}
        </text>
      </g>
    </g>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function IntakePage() {
  const router = useRouter();

  // Escalated Brief State from Chat Mode
  const [escalatedBrief, setEscalatedBrief] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = sessionStorage.getItem('ethicalai.launchSnapshot');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.escalatedBrief) setEscalatedBrief(parsed.escalatedBrief);
          if (parsed.prompt) setOriginalPrompt(parsed.prompt);
        } catch (e) {
          console.error("Failed to parse launchSnapshot:", e);
        }
      }
    }
  }, []);

  // Boot state
  const [phase, setPhase] = useState<BootPhase>('IDLE');
  const [nodeStatuses, setNodeStatuses] = useState<Record<NodeId, NodeStatus>>({
    CORE:'waiting', NEXUS:'waiting', HELIX:'waiting', MATRIX:'waiting', RESOURCES:'waiting',
  });
  const [inspectedNode, setInspectedNode] = useState<NodeId>('CORE');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>('a1');
  const [agents, setAgents] = useState<AgentDetail[]>(FULL_AGENTS);
  const [revealedAgents, setRevealedAgents] = useState<string[]>([]);
  const [ctaKey, setCtaKey] = useState('CORE_BOOT');

  // Ambient intelligence state
  const [syncPulse, setSyncPulse] = useState(0);
  const [magneticOffsets, setMagneticOffsets] = useState<Record<NodeId, {x:number;y:number}>>({
    CORE:{x:0,y:0}, NEXUS:{x:0,y:0}, HELIX:{x:0,y:0}, MATRIX:{x:0,y:0}, RESOURCES:{x:0,y:0},
  });

  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const lastPointer = useRef({ x:0, y:0 });

  // Pan / Zoom — camera cinematic movement
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  const rawScale = useMotionValue(0.9);
  const springX = useSpring(panX, { stiffness:60, damping:18 });
  const springY = useSpring(panY, { stiffness:60, damping:18 });
  const springScale = useSpring(rawScale, { stiffness:80, damping:20 });

  const setNodeStatus = useCallback((id: NodeId, s: NodeStatus) => {
    setNodeStatuses(prev => ({ ...prev, [id]: s }));
  }, []);

  // ── Orchestration Engine ──────────────────────────────────────────────────
  useEffect(() => {
    const T = (fn: () => void, ms: number) => { const id = setTimeout(fn, ms); timersRef.current.push(id); };

    const bootSubsystem = (phaseKey: BootPhase, nodeId: NodeId, offset: number, nextCtaKey: string, onDone: () => void) => {
      T(() => {
        setPhase(phaseKey);
        setCtaKey(phaseKey);
        setNodeStatus(nodeId, 'initializing');
        setInspectedNode(nodeId);
        if (nodeId === 'NEXUS') setRevealedAgents([]);

        // ── CINEMATIC CAMERA MOVEMENT toward active node ──
        const pos = NODE_POS[nodeId];
        const dx = (pos.x - CX) * 0.15;
        const dy = (pos.y - CY) * 0.15;
        panX.set(-dx); panY.set(-dy); rawScale.set(0.95);
        T(() => { panX.set(0); panY.set(0); rawScale.set(0.9); }, 2200);

        T(() => {
          setNodeStatus(nodeId, 'ready');
          setCtaKey(nextCtaKey);
          // Core sync pulse acknowledgement
          setSyncPulse(prev => prev + 1);
          T(() => setSyncPulse(prev => prev + 1), 400); // second pulse
          onDone();
        }, 2000);

        if (nodeId === 'NEXUS') {
          FULL_AGENTS.forEach((a, i) => {
            T(() => setRevealedAgents(prev => [...prev, a.id]), 300 + i * 350);
          });
        }
      }, offset);
    };

    T(() => { setPhase('CORE_BOOT'); setNodeStatus('CORE', 'initializing'); }, 400);
    T(() => { setNodeStatus('CORE', 'ready'); setSyncPulse(1); }, 1400);

    let cur = 2000;
    bootSubsystem('BOOTING_RESOURCES', 'RESOURCES', cur, 'NEXUS_DONE', () => {});  cur += 2500;
    bootSubsystem('BOOTING_NEXUS',     'NEXUS',     cur, 'MATRIX_DONE',() => {});  cur += 2500;
    bootSubsystem('BOOTING_MATRIX',    'MATRIX',    cur, 'HELIX_DONE', () => {});  cur += 2500;
    bootSubsystem('BOOTING_HELIX',     'HELIX',     cur, 'SYNC',       () => {
      T(() => { 
        setPhase('SYNC');  setCtaKey('SYNC'); 
        panX.set(0); panY.set(0); rawScale.set(0.95);
      }, 300);
      T(() => {
        setPhase('READY'); setCtaKey('READY');
        panX.set(0); panY.set(0); rawScale.set(0.9);
        // Final synchronization ripple cascade
        setSyncPulse(p=>p+1);
        T(() => setSyncPulse(p=>p+1), 600);
        T(() => setSyncPulse(p=>p+1), 1200);
      }, 1200);
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  // ── Ambient sync pulse every 9 seconds ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncPulse(prev => prev + 1);
    }, 9000);
    return () => clearInterval(interval);
  }, []);

  // ── Mouse magnetic effect in SVG space ────────────────────────────────────
  const handleSVGMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * 700;
    const svgY = ((e.clientY - rect.top) / rect.height) * 540;

    const newOffsets: Record<NodeId, {x:number;y:number}> = {} as any;
    (Object.keys(NODE_POS) as NodeId[]).forEach(id => {
      const pos = NODE_POS[id];
      const dx = svgX - pos.x;
      const dy = svgY - pos.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const maxDist = 110;
      if (dist < maxDist && dist > 0) {
        const strength = (1 - dist / maxDist) * 2.8;
        newOffsets[id] = { x: (dx / dist) * strength, y: (dy / dist) * strength };
      } else {
        newOffsets[id] = { x:0, y:0 };
      }
    });
    setMagneticOffsets(newOffsets);
  }, []);

  const handleSVGMouseLeave = useCallback(() => {
    setMagneticOffsets({ CORE:{x:0,y:0}, NEXUS:{x:0,y:0}, HELIX:{x:0,y:0}, MATRIX:{x:0,y:0}, RESOURCES:{x:0,y:0} });
  }, []);

  // Pan/zoom handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    lastPointer.current = { x:e.clientX, y:e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    panX.set(panX.get() + e.clientX - lastPointer.current.x);
    panY.set(panY.get() + e.clientY - lastPointer.current.y);
    lastPointer.current = { x:e.clientX, y:e.clientY };
  };
  const handlePointerUp = () => { isDragging.current = false; };
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    rawScale.set(Math.min(1.7, Math.max(0.6, rawScale.get() + e.deltaY * -0.001)));
  };
  const handleDoubleClick = () => { panX.set(0); panY.set(0); rawScale.set(0.9); };

  const allReady = BOOT_ORDER.every(id => nodeStatuses[id] === 'ready');

  const [isLaunchingExecution, setIsLaunchingExecution] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const handleBeginExecution = async () => {
    if (!allReady || isLaunchingExecution) return;

    // The backend owns the mission: its id, plan (Decision Engine -> Planner ->
    // HELIX -> MATRIX) and verdict. Create it there before navigating.
    const topic = (originalPrompt || "").trim();
    const missionPrompt = topic
      ? `Research the current state of ${topic} and prepare a summary of the key findings.`
      : (escalatedBrief || "").trim();
    if (!missionPrompt) {
      setLaunchError("No research topic carried over from chat -- go back and describe what you want researched.");
      return;
    }

    setIsLaunchingExecution(true);
    setLaunchError(null);

    try {
      const result = await createNexusMission(missionPrompt);
      if (!result) {
        setLaunchError("Could not reach the NEXUS backend. The mission was not created.");
        return;
      }

      const stepsToSave = result.steps.map((s) => ({
        name: s.action,
        assigned_agent_id: AGENT_ID_MAP[s.agent] ?? "execution_agent",
        // Governance decided this, not a keyword match on the prompt.
        is_legal: !s.destructive,
        legality_reason: s.destructive
          ? `Irreversible operation (${s.operation}) -- requires approval`
          : s.purpose || s.description,
      }));

      await saveMission(
        result.mission_id,
        missionPrompt,
        result.intent ?? "Research & Analysis",
        result.risk_level ?? "Low",
        70,
        stepsToSave,
        agents.map(a => ({ id: a.id, enabled: a.enabled })),
        {
          confidence: result.confidence ?? undefined,
          complexity: result.complexity_band ?? undefined,
          riskReason: result.risk_reason ?? undefined,
          decisionId: result.decision_id ?? undefined,
        }
      );

      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('ethicalai.launchSnapshot', JSON.stringify({
          missionId: result.mission_id,
          missionDescription: missionPrompt,
          status: result.status,
          statusReason: result.status_reason,
          planId: result.plan_id,
          executionStrategy: result.execution_strategy,
          requiresApproval: result.requires_human_approval,
          launchedAt: new Date().toISOString(),
        }));
      }

      router.push('/execution');
    } catch (err) {
      console.error("Mission launch failed:", err);
      setLaunchError(err instanceof Error ? err.message : "Mission launch failed for an unknown reason.");
    } finally {
      setIsLaunchingExecution(false);
    }
  };
  const EDGES: [NodeId,NodeId][] = [
    ['CORE','RESOURCES'],
    ['CORE','NEXUS'],
    ['CORE','MATRIX'],
    ['CORE','HELIX']
  ];
  const ctaLabel = CTA_LABEL[ctaKey] ?? 'Initializing…';

  return (
    <div className="relative flex h-full w-full overflow-hidden bg-brand-ink text-ink select-none">
      <BackgroundLayer />

      {/* ── GRAPH CANVAS ──────────────────────────────────────────────────── */}
      <div
        className="relative z-10 flex-grow overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        style={{ cursor:isDragging.current ? 'grabbing' : 'grab' }}
      >
        {/* Header */}
        <div className="absolute top-8 left-10 z-20 pointer-events-none">
          <div className="flex items-center gap-3 mb-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inset-0 rounded-full bg-ink opacity-40"/>
              <span className="relative rounded-full h-1.5 w-1.5 bg-ink/50"/>
            </span>
            <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-ink/45">Nexus Architecture Explorer</span>
          </div>
          <h1 className="text-[24px] font-display font-medium tracking-tight text-ink/90 leading-none mb-1">
            <AnimatePresence mode="wait">
              <motion.span key={phase}
                initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
                transition={{ duration:0.3 }}
                className="block"
              >
                {phase === 'READY' ? 'Mission Architecture Verified.' : phase === 'SYNC' ? 'Synchronising Architecture…' : 'Constructing Mission Architecture'}
              </motion.span>
            </AnimatePresence>
          </h1>
          <p className="text-[11px] text-ink/45 font-body">
            {phase === 'READY' ? 'All subsystems synchronized. Ready for autonomous execution.' : 'Select any node to inspect intelligence, governance, security, and resources.'}
          </p>
        </div>
        <div className="absolute top-8 right-10 z-20 text-[8px] font-mono text-ink/20 pointer-events-none">
          scroll to zoom · drag to pan · double-click to reset
        </div>

        {/* Escalated Executive Research Brief Banner from Chat Mode */}
        {escalatedBrief && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="absolute top-24 left-10 z-30 max-w-xl pointer-events-auto"
          >
            <div className="rounded-2xl border border-purple-500/30 bg-surface/95 backdrop-blur-2xl p-5 shadow-2xl shadow-purple-950/50">
              <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-purple-500/20">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-purple-400" />
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-purple-300">
                    Escalated Executive Research Brief
                  </span>
                </div>
                <button
                  onClick={() => setEscalatedBrief(null)}
                  className="text-[10px] font-mono text-ink/55 hover:text-ink transition-colors bg-ink/5 hover:bg-ink/10 px-2 py-0.5 rounded border border-ink/10"
                >
                  Dismiss
                </button>
              </div>

              {originalPrompt && (
                <div className="mb-3 p-2.5 rounded-lg bg-ink/[0.03] border border-ink/5">
                  <span className="text-[9px] font-mono uppercase tracking-wider text-ink/55 block mb-1">Original User Query</span>
                  <p className="text-[11px] text-ink/80 font-body italic">&quot;{originalPrompt}&quot;</p>
                </div>
              )}

              <div className="text-[11.5px] max-h-[55vh] overflow-y-auto scrollbar-hide p-4 bg-surface/50 rounded-lg border border-ink/[0.04]">
                <MarkdownRenderer content={escalatedBrief} />
              </div>
            </div>
          </motion.div>
        )}

        {/* SVG Graph */}
        <motion.svg
          ref={svgRef}
          viewBox="0 0 700 540"
          className="absolute inset-0 w-full h-full"
          style={{ x:springX, y:springY, scale:springScale }}
          onMouseMove={handleSVGMouseMove}
          onMouseLeave={handleSVGMouseLeave}
        >
          <SVGDefs />

          {/* Background engineering grid */}
          <rect x={-1000} y={-1000} width={3000} height={3000} fill="url(#eng-grid)" opacity={0.7}/>

          {/* Center ambient light */}
          <ellipse cx={CX} cy={CY} rx={260} ry={210} fill="url(#center-glow)" filter="url(#center-light)" opacity={1}/>

          {/* Edges */}
          {EDGES.map(([f,t]) => {
            let edgeStatus = nodeStatuses[t];
            return <DataEdge key={`${f}-${t}`} from={f} to={t} status={edgeStatus}/>
          })}

          {/* Agent Satellites around NEXUS */}
          <AnimatePresence>
            {revealedAgents.map(aid => {
              const ag = agents.find(a => a.id === aid);
              if (!ag) return null;
              const pos = agentPos(ag.angle);
              return (
                // Use opacity-only entrance — scale with CSS originX in SVG space causes misalignment
                <motion.g key={ag.id}
                  initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                  transition={{ duration:0.5, ease:[0.22,1,0.36,1] }}
                >
                  <AgentSatellite
                    agent={ag}
                    hovered={hoveredAgentId === ag.id}
                    selected={selectedAgentId === ag.id}
                    onSelect={() => { 
                      setAgents(prev => prev.map(a => a.id === ag.id ? { ...a, enabled: !a.enabled } : a));
                      setSelectedAgentId(ag.id); 
                      setInspectedNode('NEXUS'); 
                      setExpandedAgentId(ag.id); 
                    }}
                    onHoverStart={() => setHoveredAgentId(ag.id)}
                    onHoverEnd={() => setHoveredAgentId(null)}
                  />
                </motion.g>
              );
            })}
          </AnimatePresence>

          {/* Subsystem Nodes */}
          {BOOT_ORDER.map(id => (
            <SubsystemNode key={id} id={id} status={nodeStatuses[id]}
              onClick={() => { setInspectedNode(id); setSelectedAgentId(null); }}
              selected={inspectedNode === id && !selectedAgentId}
              magneticOffset={magneticOffsets[id]}
            />
          ))}

          {/* Core (topmost) */}
          <CoreNode
            status={nodeStatuses.CORE}
            onClick={() => { setInspectedNode('CORE'); setSelectedAgentId(null); }}
            selected={inspectedNode === 'CORE' && !selectedAgentId}
            syncPulse={syncPulse}
            magneticOffset={magneticOffsets.CORE}
          />
        </motion.svg>

        {/* Launch failure -- real backend error, never silently swallowed */}
        <AnimatePresence>
          {launchError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-28 left-10 right-10 z-30 rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-[12px] font-body text-ink/85"
              role="alert"
            >
              {launchError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Orchestration Timeline */}
        <div className="absolute bottom-0 left-0 right-0 px-10 pb-8 z-20">
          <div className="rounded-2xl border border-ink/[0.04] bg-surface/80 backdrop-blur-lg px-8 py-5 flex items-center justify-between">
            {/* Sequence steps with moving particle */}
            <div className="flex items-center gap-0">
              {['RESOURCES','NEXUS','MATRIX','HELIX','DEPLOY'].map((step, i) => {
                const nodeId = step as NodeId;
                const isDeploy = step === 'DEPLOY';
                const status = isDeploy ? (allReady ? 'ready' : 'waiting') : nodeStatuses[nodeId];
                const isActive = !isDeploy && PHASE_TO_NODE[phase] === nodeId;
                const prevReady = i === 0 ? nodeStatuses.CORE === 'ready' : nodeStatuses[BOOT_ORDER[i-1]] === 'ready';
                return (
                  <React.Fragment key={step}>
                    {i > 0 && (
                      <div className="relative h-[1px] w-12 mx-1">
                        <div className={cn("absolute inset-0 transition-colors duration-700",
                          prevReady && status !== 'waiting' ? "bg-emerald-500/40" : "bg-ink/8"
                        )}/>
                        {/* Timeline moving particle */}
                        {isActive && (
                          <motion.div className="absolute top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-blue-400"
                            animate={{ x:[-4, 48] }}
                            transition={{ duration:2.5, repeat:Infinity, ease:'easeInOut' }}
                          />
                        )}
                      </div>
                    )}
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={cn(
                        "flex items-center justify-center h-5 w-5 rounded-full text-[8px] font-mono border transition-all duration-500",
                        status === 'ready'  ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400" :
                        isActive           ? "border-blue-500/50 bg-blue-500/10 text-blue-400" :
                                             "border-ink/8 text-ink/15"
                      )}>{isDeploy ? <Rocket size={9}/> : i+1}</div>
                      <p className={cn("text-[8px] font-mono uppercase transition-colors duration-500",
                        status === 'ready' ? "text-emerald-400/60" : isActive ? "text-ink/60" : "text-ink/15"
                      )}>
                        {isDeploy ? 'Deploy' : NODE_META[nodeId]?.label}
                      </p>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Evolving CTA */}
            <AnimatePresence mode="wait">
              <motion.button key={ctaLabel}
                initial={{ opacity:0, scale:0.92, x:14 }}
                animate={{ opacity:1, scale:1, x:0 }}
                exit={{ opacity:0, scale:0.92, x:-14 }}
                transition={{ duration:0.3, ease:[0.22,1,0.36,1] }}
                onClick={handleBeginExecution}
                disabled={phase !== 'READY' || isLaunchingExecution}
                className={cn(
                  "flex items-center gap-2.5 h-10 px-7 rounded-xl text-[10px] font-mono font-bold uppercase tracking-widest transition-all cursor-pointer",
                  allReady
                    ? "bg-ink text-brand-ink hover:bg-ink/90 active:scale-95 shadow-[0_0_30px_hsl(var(--ink) / 0.1)]"
                    : "bg-ink/[0.03] border border-ink/[0.04] text-ink/35 cursor-default"
                )}
              >
                {allReady && <Rocket className="h-3 w-3 animate-pulse"/>}
                {isLaunchingExecution ? "Initializing Pipeline…" : ctaLabel}
              </motion.button>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ───────────────────────────────────────────────────── */}
      <div className="relative z-10 w-[420px] shrink-0 border-l border-ink/[0.04] bg-surface flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={selectedAgentId || inspectedNode}
            initial={{ opacity:0, x:20 }}
            animate={{ opacity:1, x:0 }}
            exit={{ opacity:0, x:-20 }}
            transition={{ duration:0.25, ease:[0.22,1,0.36,1] }}
            className="flex flex-col h-full"
          >
            {/* Panel Header */}
            <div className="px-8 pt-9 pb-5 border-b border-ink/[0.04] shrink-0">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={cn("h-1.5 w-1.5 rounded-full transition-colors duration-500",
                    nodeStatuses[inspectedNode] === 'ready' ? 'bg-emerald-400' :
                    nodeStatuses[inspectedNode] === 'initializing' ? 'bg-blue-400 animate-pulse' : 'bg-ink/20'
                  )}/>
                  <span className={cn("text-[9px] font-mono uppercase tracking-[0.25em]",
                    nodeStatuses[inspectedNode] === 'ready' ? 'text-emerald-400' :
                    nodeStatuses[inspectedNode] === 'initializing' ? 'text-blue-400' : 'text-ink/45'
                  )}>
                    {NODE_META[inspectedNode]?.label}
                  </span>
                </div>
                <span className="text-[9px] font-mono text-ink/45 uppercase tracking-widest">
                  [{nodeStatuses[inspectedNode]}]
                </span>
              </div>
              <h2 className="text-[16px] font-display font-medium text-ink/90">{NODE_META[inspectedNode]?.desc}</h2>
            </div>

            {/* Panel Body */}
            <div className="flex-grow overflow-y-auto scrollbar-hide px-8 py-6 space-y-6">

              {/* NEXUS — Agents */}
              {inspectedNode === 'NEXUS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-ink/45">Intelligence Modules ({agents.length})</p>
                    <span className="text-[9px] font-mono text-ink/45">{agents.filter(a=>a.enabled).length} Enabled</span>
                  </div>
                  <div className="space-y-3">
                    {agents.map(ag => {
                      const isExpanded = expandedAgentId === ag.id;
                      const isHovered = hoveredAgentId === ag.id;
                      const getRec = (r: RecommendationStatus) => r === 'Recommended'
                        ? <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">🟢 Recommended</span>
                        : r === 'Optional'
                        ? <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-blue-400">🔵 Optional</span>
                        : <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-500">🟠 Not Recommended</span>;

                      const getRuntime = (rt: RuntimeType) => {
                        const icons: Record<RuntimeType, any> = { 'Cloud API': Cloud, 'Local': HardDrive, 'MCP Tool': Terminal, 'Enterprise Service': Building };
                        const RT = icons[rt];
                        return <span className="text-[8px] font-mono px-2 py-0.5 rounded border border-ink/10 bg-ink/[0.03] text-ink/60 flex items-center gap-1"><RT size={9}/>{rt}</span>;
                      };

                      return (
                        <motion.div key={ag.id}
                          onMouseEnter={() => setHoveredAgentId(ag.id)}
                          onMouseLeave={() => setHoveredAgentId(null)}
                          animate={{ borderColor: isHovered ? 'rgba(59,130,246,0.4)' : ag.enabled ? 'hsl(var(--ink) / 0.1)' : 'hsl(var(--ink) / 0.03)' }}
                          className={cn("rounded-xl border overflow-hidden transition-all duration-200",
                            isHovered ? "bg-ink/[0.025]" : ag.enabled ? "bg-ink/[0.015]" : "bg-surface/60 opacity-45"
                          )}
                        >
                          <div onClick={() => setExpandedAgentId(isExpanded ? null : ag.id)}
                            className="p-4 cursor-pointer flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="h-8 w-8 rounded-lg bg-ink/[0.04] border border-ink/10 flex items-center justify-center shrink-0 mt-0.5">
                                <ag.icon size={14} className="text-ink/80"/>
                              </div>
                              <div>
                                <h3 className="text-[12px] font-display font-medium text-ink">{ag.name}</h3>
                                <p className="text-[9px] font-mono text-ink/55 mt-0.5">{ag.model} · {ag.provider}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={e => { e.stopPropagation(); setAgents(prev => prev.map(a => a.id===ag.id?{...a,enabled:!a.enabled}:a)); }}
                                className={cn("relative h-4 w-7 rounded-full transition-colors", ag.enabled ? "bg-ink" : "bg-ink/15")}>
                                <motion.div animate={{ x: ag.enabled ? 12 : 0 }} transition={{ type:'spring',stiffness:400,damping:25 }}
                                  className="absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-brand-ink"/>
                              </button>
                              {isExpanded ? <ChevronUp size={13} className="text-ink/45"/> : <ChevronDown size={13} className="text-ink/45"/>}
                            </div>
                          </div>
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }} exit={{ height:0,opacity:0 }}
                                transition={{ duration:0.2 }} className="px-4 pb-4 border-t border-ink/[0.04] pt-3 space-y-3">
                                <p className="text-[11px] font-body text-ink/55 leading-relaxed">{ag.shortDesc}</p>
                                <div className="flex flex-wrap gap-1.5">{getRec(ag.recStatus)}{getRuntime(ag.runtimeType)}</div>
                                <div className="p-3 rounded-lg border border-ink/[0.04] bg-ink/[0.01]">
                                  <span className="text-[8px] font-mono uppercase tracking-widest text-ink/45 block mb-1">Classification Rationale</span>
                                  <p className="text-[10px] font-body text-ink/55 leading-relaxed">{ag.recReason}</p>
                                </div>
                                <div className="p-3 rounded-lg border border-ink/[0.04] bg-ink/[0.01]">
                                  <span className="text-[8px] font-mono uppercase tracking-widest text-ink/45 block mb-1">Model Selection Rationale</span>
                                  <p className="text-[10px] font-body text-ink/55 leading-relaxed">{ag.whyModel}</p>
                                </div>
                                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-ink/[0.03]">
                                  <div><span className="block text-[8px] font-mono uppercase tracking-widest text-ink/45">Runtime</span><span className="text-[11px] font-mono text-ink">{ag.estRuntime}</span></div>
                                  <div><span className="block text-[8px] font-mono uppercase tracking-widest text-ink/45">Cost</span><span className="text-[11px] font-mono text-ink">{ag.estCost}</span></div>
                                  <div><span className="block text-[8px] font-mono uppercase tracking-widest text-ink/45">Confidence</span><span className="text-[11px] font-mono text-emerald-400">{ag.confidence}%</span></div>
                                </div>
                                <div>
                                  <span className="block text-[8px] font-mono uppercase tracking-widest text-ink/45 mb-1">Resources</span>
                                  <div className="flex flex-wrap gap-1">
                                    {ag.resourcesUsed.map((r,i) => <span key={i} className="text-[9px] font-mono text-ink/60 px-2 py-0.5 rounded bg-ink/[0.03] border border-ink/5">{r}</span>)}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* HELIX — Governance */}
              {inspectedNode === 'HELIX' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-emerald-500/15 bg-emerald-500/5 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-bold">Governance Clearance: Granted</span>
                      <span className="text-[9px] font-mono text-emerald-400/80">Risk: Low</span>
                    </div>
                    <p className="text-[11px] font-body text-ink/55 leading-relaxed">5 organisational policy rules verified. Zero compliance violations detected.</p>
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-ink/45">Policy Checks</p>
                  {HELIX_POLICIES.map(p => (
                    <div key={p.id} className="p-3.5 rounded-xl border border-ink/10 bg-ink/[0.015] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><CheckCircle2 size={12} className="text-emerald-400"/><span className="text-[12px] font-display font-medium text-ink">{p.name}</span></div>
                        <span className="text-[8px] font-mono text-ink/45 border border-ink/5 px-1.5 py-0.5 rounded">{p.ruleId}</span>
                      </div>
                      <p className="text-[10px] font-body text-ink/55 leading-relaxed pl-5">{p.reason}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* MATRIX — Security */}
              {inspectedNode === 'MATRIX' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-ink/10 bg-ink/[0.02] space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-ink font-bold">Runtime: Isolated</span>
                      <span className="text-[9px] font-mono text-emerald-400">Status: Secure</span>
                    </div>
                    <p className="text-[11px] font-body text-ink/55 leading-relaxed">gVisor sandboxing, memory-only secrets, and strict TLS network filtering enforced.</p>
                  </div>
                  <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-ink/45">Security Validations</p>
                  {MATRIX_CHECKS.map(s => (
                    <div key={s.id} className="p-3.5 rounded-xl border border-ink/10 bg-ink/[0.015] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><Lock size={12} className="text-emerald-400"/><span className="text-[12px] font-display font-medium text-ink">{s.component}</span></div>
                        <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">{s.status}</span>
                      </div>
                      <p className="text-[10px] font-body text-ink/55 leading-relaxed">{s.details}</p>
                      <p className="text-[9px] font-mono text-ink/45">Sandbox: {s.sandboxType}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* RESOURCES */}
              {inspectedNode === 'RESOURCES' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] font-mono uppercase tracking-[0.25em] text-ink/45">Connected Resources ({CONNECTED_RESOURCES.length})</p>
                    <span className="text-[9px] font-mono text-emerald-400">All Verified</span>
                  </div>
                  {CONNECTED_RESOURCES.map(r => (
                    <div key={r.id} className="p-3.5 rounded-xl border border-ink/10 bg-ink/[0.015] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5"><r.icon size={13} className="text-ink/80"/><div><h3 className="text-[12px] font-display font-medium text-ink">{r.name}</h3><span className="text-[9px] font-mono text-ink/45">{r.type}</span></div></div>
                        <span className="text-[8px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">{r.status}</span>
                      </div>
                      <p className="text-[10px] font-body text-ink/55 leading-relaxed">{r.purpose}</p>
                      <div className="flex justify-between pt-1.5 border-t border-ink/[0.03] text-[9px] font-mono text-ink/45">
                        <span>Permissions: {r.permissions}</span>
                        <span>Via: {r.connectionType}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CORE — Mission Overview */}
              {inspectedNode === 'CORE' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl border border-ink/10 bg-ink/[0.02] space-y-3">
                    <span className="text-[9px] font-mono uppercase tracking-widest text-ink/45 block">Mission Architecture Summary</span>
                    <h3 className="text-[15px] font-display font-bold text-ink">EthicalAI Autonomous Workforce</h3>
                    <p className="text-[11px] font-body text-ink/55 leading-relaxed">Orchestration engine initialized with 2 active intelligence agents, 5 governance validations, 4 isolated security runtimes, and 4 verified data resources.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label:'Active Agents', value:'2 Allocated' },
                      { label:'Policies Passed', value:'5 / 5', color:'text-emerald-400' },
                      { label:'Est. Runtime', value:'~1.2 Min' },
                      { label:'Est. Cost', value:'~$0.020' },
                    ].map((d,i) => (
                      <div key={i} className="p-3 rounded-xl border border-ink/5 bg-ink/[0.01] space-y-1">
                        <span className="text-[8px] font-mono uppercase tracking-widest text-ink/45 block">{d.label}</span>
                        <span className={cn("text-[13px] font-display font-bold block", d.color || "text-ink")}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                  <motion.div
                    animate={{ boxShadow: allReady ? ['0 0 0px rgba(16,185,129,0)', '0 0 20px rgba(16,185,129,0.1)', '0 0 0px rgba(16,185,129,0)'] : 'none' }}
                    transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}
                    className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-emerald-400 font-bold">Mission Confidence Score</span>
                      <span className="text-[12px] font-mono font-bold text-emerald-400">97.5%</span>
                    </div>
                    <p className="text-[10px] font-body text-ink/55 leading-relaxed">High confidence based on verified data sources, strict policy compliance, and optimal model allocation.</p>
                  </motion.div>
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
