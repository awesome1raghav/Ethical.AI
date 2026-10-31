"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import {
  Brain, Cpu, Database, Search, Globe, Network, Zap,
  CheckCircle2, XCircle, Loader2, Lock, User, Play,
  ShieldCheck, FileText, AlertTriangle, Sparkles, CheckCheck,
  Terminal as TerminalIcon, ZoomIn, ZoomOut, Maximize, Minimize, RotateCcw, ArrowRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  getLatestMission,
  updateStepStatusAction,
  updateAgentStatusAction,
  insertChatMessage,
  getChatHistory
} from "@/app/actions/db-actions";
import { getMissionState, approveMission, cancelMission, type NexusPlanStep } from "@/app/actions/nexus-backend-bridge";
import { useSidebar } from "@/context/SidebarContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DBStep {
  id: string; mission_id: string; step_index: number; name: string;
  is_legal: boolean; legality_reason: string; assigned_agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'awaiting_approval';
  // Real fields from the backend's per-step execution -- absent until the
  // backend has actually reported on this step.
  operation?: string;
  output?: string | null;
  error?: string | null;
  requiresApproval?: boolean;
  destructive?: boolean;
}
interface DBAgent {
  id: string; name: string; role: string; description: string;
  type: 'required' | 'optional'; enabled: number; status: 'idle' | 'running' | 'completed' | 'error';
}
interface ChatMessage {
  id: string; mission_id: string; sender: string; agent_name: string | null; message: string; created_at: string;
}

type PhaseId = 'ANALYSIS' | 'CONTEXT' | 'ORCHESTRATION' | 'TRUST' | 'EXECUTION' | 'RESPONSE';
type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed';

interface PhaseDef {
  id: PhaseId;
  title: string;
  icon: React.ElementType;
  bullets: { id: string; title: string; agent?: string; icon?: React.ElementType }[];
}

const PHASES: PhaseDef[] = [
  { id: 'ANALYSIS', title: 'Mission Analysis', icon: Search, bullets: [
    { id: 'a1', title: 'Prompt Received', icon: FileText },
    { id: 'a2', title: 'Intent Identified', icon: Brain }
  ]},
  { id: 'CONTEXT', title: 'Context Preparation', icon: Database, bullets: [
    { id: 'c1', title: 'APIs & Resources Identified', icon: Network },
    { id: 'c2', title: 'Knowledge Memory Loaded', icon: Database }
  ]},
  { id: 'ORCHESTRATION', title: 'Intelligent Orchestration', icon: Cpu, bullets: [
    { id: 'o1', title: 'EthicalAI Generates Workflow', icon: Network },
    { id: 'o2', title: 'Agents Assigned', icon: User }
  ]},
  { id: 'TRUST', title: 'Trust Verification', icon: ShieldCheck, bullets: [
    { id: 't1', title: 'Helix Governance Check', agent: 'Helix Governance', icon: ShieldCheck },
    { id: 't2', title: 'Matrix Security Validation', agent: 'Matrix Security', icon: Lock },
    { id: 't3', title: 'Human Approval Gate', icon: User }
  ]},
  { id: 'EXECUTION', title: 'Mission Execution', icon: Zap, bullets: [] },
  { id: 'RESPONSE', title: 'Trusted Response', icon: CheckCircle2, bullets: [
    { id: 'r1', title: 'Response Generated', icon: Sparkles },
    { id: 'r2', title: 'Mission Completed', icon: CheckCheck }
  ]}
];

export default function ExecutionPage() {
  const router = useRouter();
  const { setSidebarHidden } = useSidebar();

  const [mission, setMission] = useState<any>(null);
  const [dbSteps, setDbSteps] = useState<DBStep[]>([]);
  const [agents, setAgents] = useState<DBAgent[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [hasNoMissions, setHasNoMissions] = useState(false);

  const [phaseStatuses, setPhaseStatuses] = useState<Record<PhaseId, PhaseStatus>>({
    ANALYSIS: 'pending', CONTEXT: 'pending', ORCHESTRATION: 'pending', TRUST: 'pending', EXECUTION: 'pending', RESPONSE: 'pending'
  });
  
  const execRunningRef = useRef(false);
  // True for the whole "accepted"/"running" span across every poll tick
  // (see startPolling below), not just while an individual fetch is in
  // flight -- this is what the "Streaming" indicator and related UI key off.
  const [missionInProgress, setMissionInProgress] = useState(false);
  
  const [hitlPendingStep, setHitlPendingStep] = useState<DBStep | null>(null);
  const [hitlPanelOpen, setHitlPanelOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedDbStep, setSelectedDbStep] = useState<DBStep | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const previousOutputs = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Dedupe guards for log lines. React's Strict Mode double-invokes effects
  // on mount in dev, which fires two concurrent syncMission() calls against
  // the same already-completed mission -- without these, every "once per
  // outcome" log line (terminal status, per-step output/error, the approval
  // gate notice) gets written to chat history twice.
  const terminalLoggedRef = useRef(false);
  const loggedStepIdsRef = useRef<Set<string>>(new Set());
  const loggedPendingStepIdRef = useRef<string | null>(null);

  // The backend runs missions in a background task and returns "accepted"
  // immediately. missionStatusRef holds the latest status so the poll loop
  // knows whether to continue or stop (terminal state or approval pause).
  const missionStatusRef = useRef<string | null>(null);
  const pollingActiveRef = useRef(false);

  // Load mission
  useEffect(() => {
    async function load() {
      const data = await getLatestMission();
      if (data) {
        setMission(data.mission);
        setDbSteps(data.steps);
        setAgents(data.agents);
        const history = await getChatHistory(data.mission.id);
        setChatHistory(history);
      } else {
        setHasNoMissions(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const isComplete = phaseStatuses.RESPONSE === 'completed';
    setSidebarHidden(!isComplete);
    return () => setSidebarHidden(false);
  }, [phaseStatuses.RESPONSE, setSidebarHidden]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  async function insertLog(sender: string, agentName: string | null, message: string) {
    if (!mission) return;
    await insertChatMessage(mission.id, sender, agentName, message);
    const updated = await getChatHistory(mission.id);
    setChatHistory(updated);
  }

  /**
   * Fetch the mission's REAL current state from the backend and render it.
   *
   * This replaces a local simulation that ran fixed setTimeout delays, called
   * a nonexistent "Citadel" service, silently swallowed the resulting fetch
   * failure, and then marked every step "completed" regardless. Nothing here
   * decides or fabricates anything: the backend is the only thing that
   * actually ran the mission's steps, so it is the only valid source for
   * whether they succeeded.
   */
  const applyBackendState = useCallback(async (state: Awaited<ReturnType<typeof getMissionState>>) => {
    if (!state) {
      setSyncError("Could not reach the NEXUS backend to read mission state.");
      return;
    }
    setSyncError(null);
    missionStatusRef.current = state.status;

    const mappedSteps: DBStep[] = state.steps.map((s: NexusPlanStep, idx: number) => ({
      id: `${mission?.id ?? state.mission_id}-step-${idx}`,
      mission_id: state.mission_id,
      step_index: idx,
      name: s.action,
      is_legal: !s.destructive,
      legality_reason: s.destructive
        ? `Irreversible operation (${s.operation}) -- requires approval`
        : s.purpose,
      assigned_agent_id: dbSteps[idx]?.assigned_agent_id ?? "execution_agent",
      status: s.status,
      operation: s.operation,
      output: s.output,
      error: s.error,
      requiresApproval: s.requires_human_approval,
      destructive: s.destructive,
    }));
    if (mappedSteps.length > 0) setDbSteps(mappedSteps);

    // Phases map onto stages that already ran synchronously on the backend by
    // the time any response comes back -- there is no separate "in progress"
    // state to animate for them, only real completed/failed outcomes.
    const hasPlan = !!state.plan_id;
    const hardBlocked = state.status === "blocked";
    const terminal = ["completed", "failed", "blocked", "needs_clarification", "cancelled"].includes(state.status);

    // Chat-routed requests have no plan or per-step execution, so those stages
    // are marked skipped once the mission is terminal instead of staying pending.
    const skippedStageStatus = terminal
      ? (state.status === "completed" ? "completed" : "failed")
      : null;

    setPhaseStatuses(prev => ({
      ...prev,
      ANALYSIS: "completed",
      CONTEXT: hasPlan ? "completed"
        : state.status === "needs_clarification" ? "failed"
        : skippedStageStatus ?? "pending",
      ORCHESTRATION: mappedSteps.length > 0 ? "completed" : (skippedStageStatus ?? prev.ORCHESTRATION),
      TRUST: hardBlocked ? "failed" : (state.risk_level || hasPlan ? "completed" : (skippedStageStatus ?? prev.TRUST)),
    }));

    // The first poll can arrive before planning finishes (plan_id is still null).
    // Only log a governance line once a risk verdict exists or the mission is
    // terminal, so a plan that appears moments later is not misreported.
    if (!execRunningRef.current) {
      if (state.risk_level) {
        execRunningRef.current = true;
        await insertLog("agent", "Helix Governance",
          `Governance evaluated: risk=${state.risk_level}. ${state.risk_reason ?? ""}`.trim());
      } else if (terminal) {
        execRunningRef.current = true;
        await insertLog("agent", "Helix Governance",
          !hasPlan
            ? "No governance evaluation applies -- this request was handled conversationally, with no plan to govern."
            : "Mission reached a terminal state with no governance risk recorded.");
      }
    }

    const anyFailed = mappedSteps.some(s => s.status === "failed");
    const allDone = mappedSteps.length > 0 && mappedSteps.every(s => s.status === "completed");

    setPhaseStatuses(prev => ({
      ...prev,
      EXECUTION: hardBlocked ? "failed"
        : anyFailed ? "failed"
        : allDone ? "completed"
        : mappedSteps.length > 0 ? "running"
        : (skippedStageStatus ?? prev.EXECUTION),
    }));

    // Log real per-step outcomes once each -- guarded by step id so a second
    // concurrent sync (Strict Mode's double-invoke, or a manual refresh)
    // never re-appends the same step's output/error to chat history.
    for (const step of mappedSteps) {
      if (loggedStepIdsRef.current.has(step.id)) continue;
      if (step.status === "completed" && step.output) {
        const preview = step.output.length > 500 ? step.output.slice(0, 500) + "…" : step.output;
        await insertLog("agent", agents.find(a => a.id === step.assigned_agent_id)?.name ?? "Agent",
          `✓ ${step.name}\n\n${preview}`);
        loggedStepIdsRef.current.add(step.id);
      } else if (step.status === "failed" && step.error) {
        await insertLog("agent", agents.find(a => a.id === step.assigned_agent_id)?.name ?? "Agent",
          `✗ ${step.name} -- ${step.error}`);
        loggedStepIdsRef.current.add(step.id);
      }
    }

    if (hardBlocked) {
      if (!terminalLoggedRef.current) {
        terminalLoggedRef.current = true;
        await insertLog("system", null, `Mission blocked: ${state.status_reason ?? "governance denied execution"}.`);
      }
      setPhaseStatuses(prev => ({ ...prev, RESPONSE: "failed" }));
      setHitlPendingStep(null);
      setHitlPanelOpen(false);
      return;
    }

    if (state.status === "awaiting_approval") {
      const pendingStep = mappedSteps.find(s => s.status === "awaiting_approval")
        ?? (state.pending_step_id ? mappedSteps.find((_, i) => state.steps[i]?.step_id === state.pending_step_id) : null);
      const pendingId = pendingStep?.id ?? "mission-gate";
      if (loggedPendingStepIdRef.current !== pendingId) {
        loggedPendingStepIdRef.current = pendingId;
        await insertLog("system", null,
          `⏸ Human authorization required${pendingStep ? `: "${pendingStep.name}"` : ""}. ${state.status_reason ?? ""}`.trim());
      }
      setHitlPendingStep(pendingStep ?? {
        id: "mission-gate", mission_id: state.mission_id, step_index: -1,
        name: "Begin mission execution", is_legal: true,
        legality_reason: state.status_reason ?? "", assigned_agent_id: "execution_agent",
        status: "awaiting_approval",
      });
      setHitlPanelOpen(true);
      setPhaseStatuses(prev => ({ ...prev, RESPONSE: "pending" }));
      return;
    }

    setHitlPendingStep(null);
    setHitlPanelOpen(false);

    if (state.status === "failed") {
      if (!terminalLoggedRef.current) {
        terminalLoggedRef.current = true;
        await insertLog("system", null, `Mission failed: ${state.status_reason ?? "a step could not complete"}.`);
      }
      setPhaseStatuses(prev => ({ ...prev, RESPONSE: "failed" }));
      return;
    }

    if (state.status === "cancelled") {
      if (!terminalLoggedRef.current) {
        terminalLoggedRef.current = true;
        await insertLog("system", null, `Mission cancelled. ${state.status_reason ?? ""}`.trim());
      }
      setPhaseStatuses(prev => ({ ...prev, RESPONSE: "failed" }));
      return;
    }

    if (state.status === "completed") {
      if (!terminalLoggedRef.current) {
        terminalLoggedRef.current = true;
        await insertLog("system", null, "Mission execution complete.");
      }
      setPhaseStatuses(prev => ({ ...prev, RESPONSE: "completed" }));
    }
  }, [mission, dbSteps, agents]);

  const syncMission = useCallback(async () => {
    if (!mission) return;
    const state = await getMissionState(mission.id);
    await applyBackendState(state);
  }, [mission, applyBackendState]);

  // Poll every few seconds while the mission is in flight; stop at a terminal
  // state or an approval pause, since nothing changes until a human acts.
  const startPolling = useCallback(() => {
    if (pollingActiveRef.current) return;
    pollingActiveRef.current = true;
    setMissionInProgress(true);
    const tick = async () => {
      if (!pollingActiveRef.current) return;
      await syncMission();
      const status = missionStatusRef.current;
      // Stop on a known set of settled statuses and keep polling for anything
      // else, so a new in-progress status on the backend never ends polling early.
      const settled = ["completed", "failed", "blocked", "needs_clarification", "awaiting_approval", "cancelled"];
      if (pollingActiveRef.current && status && !settled.includes(status)) {
        setTimeout(tick, 2500);
      } else {
        pollingActiveRef.current = false;
        setMissionInProgress(false);
      }
    };
    tick();
  }, [syncMission]);

  const handleApprove = useCallback(async () => {
    if (!mission || isApproving) return;
    setIsApproving(true);
    try {
      // No step_id passed: the backend already knows exactly which step it
      // paused on and resolves the mismatch check itself.
      const state = await approveMission(mission.id);
      if (!state) {
        setSyncError("Approval request failed -- could not reach the NEXUS backend. Nothing was changed.");
        return;
      }
      await insertLog("system", null, "▶ Authorization granted. Resuming execution.");
      execRunningRef.current = false;  // allow the governance log line to fire again for the new state
      terminalLoggedRef.current = false;  // resuming can reach a new terminal outcome worth logging
      await applyBackendState(state);
      // Resuming also now runs in the background on the server -- keep
      // polling if there's more of the mission left to watch.
      startPolling();
    } finally {
      setIsApproving(false);
    }
  }, [mission, hitlPendingStep, isApproving, applyBackendState, startPolling]);

  // Shared by the approval panel's Cancel button and the toolbar cancel action.
  // A mission paused for approval is finalized immediately; a running mission
  // stops at its next step boundary (see cancel_mission in app/api/mission.py).
  const handleCancel = useCallback(async () => {
    if (!mission || isCancelling) return;
    setIsCancelling(true);
    try {
      const state = await cancelMission(mission.id);
      if (!state) {
        setSyncError("Cancel request failed -- could not reach the NEXUS backend. Nothing was changed.");
        return;
      }
      setHitlPanelOpen(false);
      await applyBackendState(state);
    } finally {
      setIsCancelling(false);
    }
  }, [mission, isCancelling, applyBackendState]);

  // Start watching the mission as soon as it's known. syncMission() itself is
  // idempotent-safe against Strict Mode's double-invoke (dedup refs above);
  // startPolling()'s own pollingActiveRef guard prevents a second concurrent
  // poll loop from that same double-invoke.
  useEffect(() => {
    if (mission) {
      startPolling();
    }
  }, [mission, startPolling]);


  // ─── SVG Canvas Tracking ──────────────────────────────────────────────────────
  const [nodeRects, setNodeRects] = useState<Record<string, {x: number, y: number, w: number, h: number}>>({});

  useLayoutEffect(() => {
    if (!wrapperRef.current || !containerRef.current) return;
    const updateRects = () => {
      if (!wrapperRef.current) return;
      const nodes = wrapperRef.current.querySelectorAll('[data-node-id]');
      const rects: Record<string, any> = {};
      nodes.forEach(n => {
         const id = n.getAttribute('data-node-id')!;
         let el = n as HTMLElement;
         let x = 0;
         let y = 0;
         while (el && el !== wrapperRef.current) {
            x += el.offsetLeft;
            y += el.offsetTop;
            el = el.offsetParent as HTMLElement;
         }
         rects[id] = {
           x,
           y,
           w: (n as HTMLElement).offsetWidth,
           h: (n as HTMLElement).offsetHeight
         };
      });
      setNodeRects(rects);
    };
    
    updateRects();
    setTimeout(updateRects, 100);
    setTimeout(updateRects, 500);
    
    const obs = new ResizeObserver(updateRects);
    obs.observe(containerRef.current);
    window.addEventListener('resize', updateRects);
    return () => { obs.disconnect(); window.removeEventListener('resize', updateRects); };
  }, [dbSteps.length, hitlPendingStep]);

  const activePhaseIndex = useMemo(() => {
    const idx = PHASES.findIndex(p => phaseStatuses[p.id] === 'running' || phaseStatuses[p.id] === 'failed');
    if (idx !== -1) return idx;
    if (phaseStatuses.RESPONSE === 'completed') return 5;
    return -1;
  }, [phaseStatuses]);

  const particleTargetId = useMemo(() => {
    if (activePhaseIndex >= 0) return PHASES[activePhaseIndex].id;
    if (phaseStatuses.RESPONSE === 'completed') return 'RESPONSE';
    return 'ANALYSIS';
  }, [activePhaseIndex, phaseStatuses.RESPONSE]);

  const targetRect = nodeRects[particleTargetId];
  const particleX = useSpring(0, { stiffness: 60, damping: 20 });
  const particleY = useSpring(0, { stiffness: 60, damping: 20 });

  useEffect(() => {
    if (targetRect) {
      particleX.set(targetRect.x + targetRect.w / 2);
      particleY.set(targetRect.y + targetRect.h / 2);
    }
  }, [targetRect, particleX, particleY]);

  // Auto-scroll logic to keep active node in view
  useEffect(() => {
    if (targetRect && containerRef.current && phaseStatuses.RESPONSE !== 'completed') {
      const containerW = containerRef.current.clientWidth;
      const targetScrollX = targetRect.x - (containerW / 2) + (targetRect.w / 2);
      containerRef.current.scrollTo({ left: targetScrollX, behavior: 'smooth' });
    }
  }, [targetRect, phaseStatuses.RESPONSE]);


  // Shrink Graph when complete or manual zoom
  const [graphScale, setGraphScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (phaseStatuses.RESPONSE === 'completed') {
      if (containerRef.current && wrapperRef.current) {
         // CSS transforms do not change layout size, so scrollWidth is the graph's
         // unscaled width. Scaling from the measured width keeps the final phase
         // visible however many mission steps the graph contains.
         const sw = containerRef.current.clientWidth;
         const contentWidth = wrapperRef.current.scrollWidth;
         // A small safety margin: this measurement can run a frame before the
         // graph's own ResizeObserver-driven layout has fully settled, so an
         // exact-fit scale occasionally left the last node's right edge a few
         // pixels past the container's right edge.
         const targetScale = Math.min((sw / contentWidth) * 0.92, 0.85);
         setGraphScale(targetScale);
         containerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
      }
    } else {
      setGraphScale(1);
    }
  }, [phaseStatuses.RESPONSE]);

  const handleZoomIn = () => setGraphScale(prev => Math.min(prev + 0.15, 2.5));
  const handleZoomOut = () => setGraphScale(prev => Math.max(prev - 0.15, 0.2));
  const handleZoomReset = () => setGraphScale(1);


  if (hasNoMissions) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <Database size={32} className="text-ink/20" />
          <div className="text-center">
            <h2 className="text-[16px] font-semibold text-ink mb-1">No Active Mission</h2>
            <p className="text-[11px] font-mono text-ink/40">Please return to the intake page.</p>
          </div>
          <button onClick={() => router.push('/')} className="mt-2 text-ink/70 text-[10px] uppercase font-mono border border-ink/10 px-6 py-2 rounded-xl hover:bg-ink/5 transition-colors">Go to Intake</button>
        </div>
      </div>
    );
  }
  if (!mission) {
    return <div className="h-full w-full flex items-center justify-center bg-surface"><Loader2 className="animate-spin text-ink/20" /></div>;
  }

  const getChildrenForPhase = (phaseId: PhaseId) => {
    if (phaseId === 'EXECUTION') {
      return dbSteps.map(s => ({
        id: s.id,
        title: s.name,
        agent: agents.find(a => a.id === s.assigned_agent_id)?.name,
        status: s.status,
        icon: deriveStepMeta(s, agents.find(a => a.id === s.assigned_agent_id)).icon,
        isDbStep: true,
        step: s
      }));
    }
    const phaseStatus = phaseStatuses[phaseId];
    return PHASES.find(p => p.id === phaseId)!.bullets.map(b => ({
      ...b,
      status: phaseStatus === 'completed' ? 'completed' : phaseStatus === 'running' ? 'running' : 'pending',
      isDbStep: false,
      step: null
    }));
  };

  return (
    <div className="relative flex h-full w-full bg-surface overflow-hidden text-ink font-body p-2 gap-2">
      
      {/* ── FLOWCHART AREA (LEFT) ── */}
      <div className={cn(
         "relative overflow-hidden flex flex-col transition-all duration-500 rounded-2xl border border-ink/[0.04] bg-surface",
         isFullscreen ? "fixed inset-0 z-[100] bg-surface rounded-none border-none p-0 m-0" : "flex-1 h-full"
      )}>
        
        {/* AMBIENT BACKGROUND */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {hitlPendingStep && <div className="absolute inset-0 bg-amber-500/10 blur-[100px] transition-all duration-1000" />}
        </div>

        <AnimatePresence>
          {hitlPendingStep && <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="absolute inset-0 bg-surface/60 backdrop-blur-[4px] z-30 pointer-events-none" />}
        </AnimatePresence>

        {/* CANVAS */}
        <div ref={containerRef} className="absolute inset-0 overflow-auto scrollbar-hide z-10 select-none">
          <motion.div 
            ref={wrapperRef}
            animate={{ scale: graphScale }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} 
            style={{ transformOrigin: "left center" }}
            className="relative w-max h-max p-[120px]"
          >
            {/* ── SVG EDGES OVERLAY ── */}
            <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
              
              {/* Draw Spine Edges between Parent Nodes */}
              {PHASES.map((phase, i) => {
                if (i === PHASES.length - 1) return null;
                const p1 = nodeRects[phase.id];
                const p2 = nodeRects[PHASES[i+1].id];
                if (!p1 || !p2) return null;

                const x1 = p1.x + p1.w;
                const y1 = p1.y + p1.h / 2;
                const x2 = p2.x;
                const y2 = p2.y + p2.h / 2;

                const isCompleted = phaseStatuses[phase.id] === 'completed' && phaseStatuses[PHASES[i+1].id] !== 'pending';
                const isRunning = phaseStatuses[phase.id] === 'running' || phaseStatuses[PHASES[i+1].id] === 'running';

                return (
                  <line key={`spine-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} 
                    stroke={isCompleted ? "rgba(16,185,129,0.3)" : isRunning ? "rgba(59,130,246,0.3)" : "hsl(var(--ink) / 0.06)"} 
                    strokeWidth={isCompleted || isRunning ? 3 : 2} 
                    strokeDasharray={isCompleted || isRunning ? "none" : "6 6"}
                    className="transition-colors duration-700"
                  />
                );
              })}

              {/* Draw Branch Edges to Child Nodes */}
              {PHASES.map(phase => {
                const p = nodeRects[phase.id];
                if (!p) return null;
                const px = p.x + p.w / 2;
                const py = p.y + p.h; // Bottom center of parent

                const children = getChildrenForPhase(phase.id);
                return children.map(child => {
                  const c = nodeRects[child.id];
                  if (!c) return null;
                  const cx = c.x + c.w / 2;
                  const cy = c.y; // Top center of child

                  const isChildCompleted = child.status === 'completed';
                  const isChildRunning = child.status === 'running';

                  // Bezier curve connecting parent bottom to child top
                  const path = `M ${px} ${py} C ${px} ${py + 40}, ${cx} ${cy - 40}, ${cx} ${cy}`;

                  return (
                    <path key={`edge-${child.id}`} d={path}
                      stroke={isChildCompleted ? "rgba(16,185,129,0.4)" : isChildRunning ? "rgba(59,130,246,0.6)" : "hsl(var(--ink) / 0.06)"} 
                      strokeWidth={isChildCompleted || isChildRunning ? 2 : 1.5}
                      strokeDasharray={isChildCompleted || isChildRunning ? "none" : "4 4"}
                      fill="none"
                      className="transition-colors duration-700"
                    />
                  );
                });
              })}

              {/* The Orchestrator Particle */}
              {(missionInProgress || hitlPendingStep || phaseStatuses.RESPONSE === 'completed') && (
                <motion.circle 
                  cx={particleX} cy={particleY} r={6} 
                  fill={phaseStatuses.RESPONSE === 'completed' ? '#10b981' : hitlPendingStep ? '#f59e0b' : '#3b82f6'}
                  style={{ filter: `drop-shadow(0 0 15px ${phaseStatuses.RESPONSE === 'completed' ? '#10b981' : hitlPendingStep ? '#f59e0b' : '#3b82f6'})` }}
                />
              )}
            </svg>

            {/* ── FLOWCHART NODES ── */}
            <div className="relative z-10 flex items-start gap-24">
              {PHASES.map((phase) => {
                const status = phaseStatuses[phase.id];
                const isCompleted = status === 'completed';
                const isRunning = status === 'running';
                const isFailed = status === 'failed';
                const isPending = status === 'pending';
                const isHITL = hitlPendingStep && phase.id === 'TRUST';

                const children = getChildrenForPhase(phase.id);
                const PhaseIcon = phase.icon;

                return (
                  <div key={phase.id} className={cn("flex flex-col items-center gap-16 transition-all duration-700", isHITL ? "z-40" : "")}>
                    
                    {/* Parent Node */}
                    <div data-node-id={phase.id} className={cn("relative w-72 rounded-2xl border transition-all duration-700 flex flex-col p-5 shadow-2xl overflow-hidden",
                        isPending ? "border-ink/10 bg-surface opacity-60" : "",
                        isRunning && !isHITL ? "border-blue-500/40 bg-surface shadow-[0_0_30px_rgba(59,130,246,0.15)] scale-105" : "",
                        isCompleted && !isHITL ? "border-emerald-500/30 bg-surface" : "",
                        isFailed ? "border-red-500/50 bg-surface" : "",
                        isHITL ? "border-amber-500/60 bg-surface shadow-[0_0_50px_rgba(245,158,11,0.2)] scale-110" : ""
                    )}>
                      {/* Inner glowing header */}
                      <div className={cn("absolute top-0 left-0 right-0 h-1", 
                         isCompleted && !isHITL ? "bg-gradient-to-r from-emerald-500/50 to-emerald-500/10" :
                         isRunning && !isHITL ? "bg-gradient-to-r from-blue-500 to-blue-500/10" :
                         isHITL ? "bg-gradient-to-r from-amber-500 to-amber-500/10" : "bg-ink/5"
                      )} />

                      <div className="flex justify-between items-center mb-4">
                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center border",
                           isCompleted && !isHITL ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" :
                           isRunning && !isHITL ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
                           isHITL ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-ink/10 bg-ink/5 text-ink/40"
                        )}>
                          <PhaseIcon size={18} />
                        </div>
                        
                        {isCompleted && !isHITL && <CheckCircle2 size={18} className="text-emerald-400" />}
                        {isRunning && !isHITL && <Loader2 size={16} className="text-blue-400 animate-spin" />}
                        {isHITL && <AlertTriangle size={16} className="text-amber-400 animate-pulse" />}
                      </div>

                      <h3 className={cn("text-[18px] font-display font-medium tracking-wide",
                          isHITL ? "text-amber-400" : isRunning ? "text-ink" : isCompleted ? "text-emerald-400" : "text-ink/80"
                        )}>
                        {phase.title}
                      </h3>
                      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-ink/30 mt-2">
                         {status}
                      </p>

                      {/* HITL Arrow Overlay */}
                      {isHITL && (
                        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                          className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-amber-400 pointer-events-none"
                        >
                          <span className="text-[10px] font-mono uppercase tracking-[0.2em] font-bold whitespace-nowrap bg-surface px-2">Action Required</span>
                        </motion.div>
                      )}
                    </div>

                    {/* Child Nodes Container */}
                    {children.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-6 w-[500px]">
                        {children.map((child, idx) => {
                          const ChildIcon = child.icon || FileText;
                          const isChildRun = child.status === 'running';
                          const isChildDone = child.status === 'completed' || child.status === 'skipped';
                          const isChildFail = child.status === 'failed';
                          const isSkipped = child.status === 'skipped';

                          return (
                            <div key={child.id} data-node-id={child.id} onClick={() => child.isDbStep && setSelectedDbStep(child.step)}
                                 className={cn("w-56 p-4 rounded-xl border transition-all duration-500 bg-surface flex flex-col gap-3",
                                   child.isDbStep ? "cursor-pointer hover:bg-ink/[0.04]" : "",
                                   isChildRun ? "border-blue-500/40 shadow-[0_0_15px_rgba(59,130,246,0.1)] scale-105" :
                                   isChildDone ? "border-emerald-500/20" :
                                   isChildFail ? "border-red-500/40" : "border-ink/5 opacity-70"
                                 )}>
                              <div className="flex items-center gap-3">
                                 <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                                    isChildRun ? "bg-blue-500/10 text-blue-400" :
                                    isChildDone ? "bg-emerald-500/10 text-emerald-400" : "bg-ink/5 text-ink/30"
                                 )}>
                                    <ChildIcon size={12} />
                                 </div>
                                 <span className={cn("text-[12px] font-medium leading-tight",
                                    isChildRun ? "text-blue-100" :
                                    isChildDone ? "text-emerald-50" : "text-ink/60"
                                 )}>
                                    {child.title}
                                 </span>
                              </div>
                              
                              {child.agent && (
                                 <div className="flex justify-between items-center pt-2 border-t border-ink/5 mt-1">
                                    <span className="text-[9px] font-mono uppercase tracking-widest text-ink/30">Agent</span>
                                    <span className={cn("text-[9px] font-mono", isChildRun ? "text-blue-400" : "text-ink/50")}>{child.agent}</span>
                                 </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── TOOLBAR (ZOOM & FULLSCREEN) ── */}
        <div className="absolute bottom-8 right-8 z-20 flex items-center gap-1.5 bg-surface/90 backdrop-blur-md border border-ink/10 rounded-2xl p-1.5 shadow-2xl">
          <button onClick={handleZoomOut} className="p-2.5 hover:bg-ink/10 rounded-xl text-ink/60 hover:text-ink transition-colors" title="Zoom Out">
            <ZoomOut size={16}/>
          </button>
          <div className="text-[11px] font-mono text-ink/50 w-12 text-center select-none">
            {Math.round(graphScale * 100)}%
          </div>
          <button onClick={handleZoomIn} className="p-2.5 hover:bg-ink/10 rounded-xl text-ink/60 hover:text-ink transition-colors" title="Zoom In">
            <ZoomIn size={16}/>
          </button>
          
          <div className="w-px h-5 bg-ink/10 mx-1" />
          
          <button onClick={handleZoomReset} className="p-2.5 hover:bg-ink/10 rounded-xl text-ink/60 hover:text-ink transition-colors" title="Reset Zoom">
            <RotateCcw size={16}/>
          </button>
          
          <div className="w-px h-5 bg-ink/10 mx-1" />
          
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-2.5 hover:bg-ink/10 rounded-xl text-ink/60 hover:text-emerald-400 transition-colors" title="Toggle Fullscreen">
            {isFullscreen ? <Minimize size={16}/> : <Maximize size={16}/>}
          </button>
        </div>
      </div>

      {/* ── EXECUTION TERMINAL (RIGHT PANEL) ── */}
      <div className="w-[440px] h-full bg-surface border border-ink/[0.04] rounded-2xl flex flex-col relative z-20 shrink-0 overflow-hidden">
        <div className="px-6 py-5 border-b border-ink/[0.04] bg-ink/[0.01] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <TerminalIcon size={16} className="text-ink/40" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-ink/60">Execution Log</span>
          </div>
          {missionInProgress && !hitlPendingStep && phaseStatuses.RESPONSE !== 'completed' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[9px] font-mono uppercase tracking-widest text-blue-400">Streaming</span>
              </div>
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                title="Stops at the next step boundary -- a step already in flight cannot be interrupted mid-call"
                className="text-[9px] font-mono uppercase tracking-widest text-ink/40 hover:text-red-400 transition-colors disabled:opacity-40"
              >
                {isCancelling ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          )}
          {hitlPendingStep && (
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[9px] font-mono uppercase tracking-widest text-amber-400">Paused</span>
            </div>
          )}
          {phaseStatuses.RESPONSE === 'completed' ? (
            <button onClick={() => router.push('/output')} className="h-8 px-5 rounded-lg bg-emerald-500 text-brand-ink text-[10px] font-mono font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              View Output <ArrowRight size={12}/>
            </button>
          ) : !missionInProgress && (
            <button onClick={syncMission} className="h-8 px-5 rounded-lg bg-ink text-brand-ink text-[10px] font-mono font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2">
              <Play size={10}/> Refresh Status
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'none' }}>
          {syncError && (
            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] text-[11px] font-mono text-red-400 leading-relaxed">
              {syncError} Press "Refresh Status" to try again.
            </div>
          )}
          {chatHistory.length === 0 && !missionInProgress && !syncError && (
            <div className="text-[11px] font-mono text-ink/30 italic text-center mt-20">System ready. Awaiting execution command.</div>
          )}
          {chatHistory.map((c) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-[11px] font-mono">
              <div className="flex items-center gap-2 mb-2 opacity-50 text-[9px] uppercase tracking-widest">
                <span>{new Date(c.created_at).toLocaleTimeString()}</span>
                <span>|</span>
                <span className={c.sender === 'agent' ? 'text-emerald-400' : 'text-blue-400'}>{c.agent_name || c.sender.toUpperCase()}</span>
              </div>
              <div className="text-ink/80 leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-ink/10 ml-1 py-0.5">
                {c.message}
              </div>
            </motion.div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* ── HITL PANEL ── */}
      <AnimatePresence>
        {hitlPendingStep && hitlPanelOpen && (
           <HITLPanel
             step={hitlPendingStep}
             isApproving={isApproving}
             isCancelling={isCancelling}
             onApprove={handleApprove}
             onCancel={handleCancel}
           />
        )}
      </AnimatePresence>

      {/* ── PREMIUM INSPECTOR ── */}
      <AnimatePresence>
        {selectedDbStep && (
          <motion.div 
            initial={{ x: '100%', opacity: 0 }} 
            animate={{ x: 0, opacity: 1 }} 
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 w-[440px] bg-surface border-l border-ink/10 z-50 shadow-2xl flex flex-col pointer-events-auto"
          >
            <div className="px-8 py-8 border-b border-ink/[0.04] bg-ink/[0.01]">
              <div className="flex justify-between items-start mb-4">
                <div className="h-8 w-8 rounded-xl bg-ink/5 flex items-center justify-center border border-ink/10"><Search size={14} className="text-ink/60"/></div>
                <button onClick={() => setSelectedDbStep(null)} className="text-ink/30 hover:text-ink transition-colors"><XCircle size={20}/></button>
              </div>
              <h2 className="text-[16px] font-display font-medium text-ink leading-snug">{selectedDbStep.name}</h2>
              <p className="text-[10px] font-mono text-ink/40 mt-2 uppercase tracking-widest">Task Details</p>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              <InspectorRow label="Status" value={
                <span className={cn("uppercase px-2 py-0.5 rounded",
                  selectedDbStep.status === 'completed' && "text-emerald-400 bg-emerald-500/10",
                  selectedDbStep.status === 'failed' && "text-red-400 bg-red-500/10",
                  selectedDbStep.status === 'awaiting_approval' && "text-amber-400 bg-amber-500/10",
                  selectedDbStep.status === 'pending' && "text-ink/50 bg-ink/5",
                )}>{selectedDbStep.status}</span>
              } />
              <InspectorRow label="Assigned Agent" value={agents.find(a => a.id === selectedDbStep.assigned_agent_id)?.name || 'Unknown'} />
              <InspectorRow label="Operation" value={selectedDbStep.operation || 'Unknown'} />
              <InspectorRow label="Model" value={deriveStepMeta(selectedDbStep, agents.find(a => a.id === selectedDbStep.assigned_agent_id)).model} />
              <InspectorRow label="Provider" value={deriveStepMeta(selectedDbStep, agents.find(a => a.id === selectedDbStep.assigned_agent_id)).provider} />
              {selectedDbStep.output && (
                <div className="p-4 rounded-xl border border-ink/10 bg-ink/[0.02]">
                  <span className="block text-[9px] font-mono uppercase tracking-widest text-ink/40 mb-2">Real Output</span>
                  <p className="text-[11px] font-mono text-ink/70 leading-relaxed whitespace-pre-wrap">{selectedDbStep.output}</p>
                </div>
              )}
              {selectedDbStep.error && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                  <span className="block text-[9px] font-mono uppercase tracking-widest text-red-400 mb-2">Real Error</span>
                  <p className="text-[11px] font-mono text-ink/70 leading-relaxed whitespace-pre-wrap">{selectedDbStep.error}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

function InspectorRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 pb-4 border-b border-ink/[0.03]">
      <span className="text-[9px] font-mono uppercase tracking-widest text-ink/30">{label}</span>
      <span className="text-[12px] font-body text-ink/80">{value}</span>
    </div>
  );
}

// ─── HITL Panel Component ───────────────────────────────────────────────────────
// Shows the real operation this gate is about and why it needs a human --
// never a fabricated credential field. There is nothing to "enter": this is
// an authorization decision on a real, declared, irreversible-or-external
// operation, not a login form.
function HITLPanel({ step, isApproving, isCancelling, onApprove, onCancel }: {
  step: DBStep; isApproving: boolean; isCancelling: boolean; onApprove: () => void; onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute right-0 top-0 bottom-0 w-[440px] bg-surface border-l border-ink/10 z-40 shadow-2xl flex flex-col pointer-events-auto"
    >
      <div className="px-10 pt-16 pb-8 border-b border-ink/[0.04]">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20"><Lock size={18} className="text-amber-400"/></div>
          <div>
            <h2 className="text-[18px] font-display font-medium text-ink">{step.name}</h2>
            <p className="text-[11px] font-mono text-amber-400 mt-1 uppercase tracking-widest">Authorization Required</p>
          </div>
        </div>
        <p className="text-[12px] font-body text-ink/50 leading-relaxed">
          {step.legality_reason || "This step needs explicit human approval before it runs. Silence is never treated as approval."}
        </p>
      </div>

      <div className="flex-1 p-10 overflow-y-auto space-y-6">
        {step.operation && (
          <div>
            <span className="block text-[9px] font-mono uppercase tracking-widest text-ink/40 mb-2">Operation</span>
            <span className="inline-block text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded">
              {step.operation}
            </span>
          </div>
        )}
        {step.destructive && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
            <span className="block text-[9px] font-mono uppercase tracking-widest text-red-400 mb-2">Irreversible</span>
            <p className="text-[11px] font-body text-ink/60 leading-relaxed">
              This operation cannot be undone once it runs.
            </p>
          </div>
        )}
        <div className="p-4 rounded-xl border border-ink/5 bg-ink/[0.01]">
          <span className="block text-[9px] font-mono uppercase tracking-widest text-ink/40 mb-2">What happens if you approve</span>
          <p className="text-[11px] font-body text-ink/60 leading-relaxed">
            Execution resumes from exactly this step. Steps already completed are not re-run.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-ink/5 bg-ink/[0.01]">
          <span className="block text-[9px] font-mono uppercase tracking-widest text-ink/40 mb-2">What happens if you cancel</span>
          <p className="text-[11px] font-body text-ink/60 leading-relaxed">
            The mission stops here for good -- there is no resume after cancelling. Steps already completed are not undone.
          </p>
        </div>
      </div>

      <div className="p-8 border-t border-ink/[0.04] bg-surface flex gap-4">
        <button onClick={onCancel} disabled={isApproving || isCancelling} className="flex-1 h-12 rounded-xl border border-ink/10 text-ink/60 text-[11px] font-mono uppercase tracking-widest hover:bg-ink/5 transition-colors disabled:opacity-40">
          {isCancelling ? "Cancelling…" : "Cancel Mission"}
        </button>
        <button onClick={onApprove} disabled={isApproving || isCancelling} className="flex-1 h-12 rounded-xl bg-amber-500 text-brand-ink font-bold text-[11px] font-mono uppercase tracking-widest hover:bg-amber-400 transition-colors disabled:opacity-50">
          {isApproving ? "Resuming…" : "Authorize & Continue"}
        </button>
      </div>
    </motion.div>
  );
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function deriveStepMeta(dbStep: DBStep, agent?: DBAgent) {
  const aid = dbStep.assigned_agent_id;

  let icon = FileText;
  if (aid === 'research_agent') icon = Search;
  if (aid === 'knowledge_agent') icon = Database;
  if (aid === 'execution_agent') icon = Zap;
  if (aid === 'validation_agent') icon = ShieldCheck;
  if (aid === 'browser_agent') icon = Globe;

  // Approval state comes from the backend's requiresApproval/status fields.
  const hitl = dbStep.status === 'awaiting_approval' || !!dbStep.requiresApproval;

  // Reasoning, coding and chat steps call Gemma (nexus-backend
  // app/services/llm); research steps are browser-based and deterministic.
  const modelBacked = ['knowledge_agent', 'execution_agent'].includes(aid);
  const model = modelBacked ? 'Gemma 4 12B' : 'Deterministic (no LLM)';
  const provider = modelBacked ? 'Ollama (local)' : '—';

  return {
    agent: agent?.name ?? 'Autonomous Agent',
    hitl,
    model,
    provider,
    icon
  };
}
