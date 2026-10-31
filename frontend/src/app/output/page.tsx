"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Loader2, CheckCircle2, ShieldCheck, X,
  AlertTriangle, Clock, BrainCircuit, Globe, BookOpen, Layers, RefreshCw, Download
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getLatestMission } from "@/app/actions/db-actions";
import { getMissionState, type NexusMissionResponse, type NexusPlanStep } from "@/app/actions/nexus-backend-bridge";
import { useSidebar } from "@/context/SidebarContext";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface Comment {
  id: string;
  blockId: string;
  text: string;
  status: 'pending' | 'resolved';
}

// The report document is ReportAgent's output (nexus-backend
// app/agents/report_agent.py), shown exactly as produced.
function findDocumentStep(steps: NexusPlanStep[]): NexusPlanStep | null {
  return steps.find(s => s.agent === "ReportAgent" || s.operation === "GENERATE_ARTIFACT") ?? null;
}

export default function OutputDashboard() {
  const router = useRouter();
  const { setSidebarHidden } = useSidebar();

  const [missionLocal, setMissionLocal] = useState<any>(null);
  const [state, setState] = useState<NexusMissionResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [comments, setComments] = useState<Comment[]>([]);
  const [selectedText, setSelectedText] = useState<{ text: string, blockId: string, top: number, left: number } | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  async function load() {
    setLoading(true);
    setLoadError(null);
    const data = await getLatestMission();
    if (!data || !data.mission) {
      setMissionLocal(null);
      setLoading(false);
      return;
    }
    setMissionLocal(data.mission);
    const backendState = await getMissionState(data.mission.id);
    if (!backendState) {
      setLoadError("Could not reach the NEXUS backend to load this mission's real output.");
      setState(null);
    } else {
      setState(backendState);
    }
    setLoading(false);
  }

  useEffect(() => {
    setSidebarHidden(false);
    load();
  }, [setSidebarHidden]);

  const handleHighlightComment = () => {
    if (!selectedText) return;
    setComments(prev => [...prev, {
      id: Date.now().toString(),
      blockId: selectedText.blockId,
      text: selectedText.text.length > 80 ? selectedText.text.substring(0, 80) + '...' : selectedText.text,
      status: 'pending',
    }]);
    setSelectedText(null);
    window.getSelection()?.removeAllRanges();
  };

  const resolveComment = (id: string) => {
    setComments(prev => prev.map(c => c.id === id ? { ...c, status: 'resolved' } : c));
  };

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        const target = e.target as HTMLElement;
        if (!target.closest('#selection-toolbar')) setSelectedText(null);
        return;
      }
      const text = selection.toString().trim();
      if (!text) return;
      const anchorNode = selection.anchorNode;
      const blockEl = anchorNode?.parentElement?.closest('.document-block');
      if (!blockEl) return;
      const blockId = blockEl.getAttribute('data-block-id');
      if (!blockId) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText({ text, blockId, top: rect.top - 60, left: rect.left + (rect.width / 2) });
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (loading) {
    return <div className="h-full w-full flex items-center justify-center bg-transparent"><Loader2 className="animate-spin text-ink/20" /></div>;
  }

  if (!missionLocal) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-transparent">
        <div className="text-center">
          <h2 className="text-ink text-lg font-medium">No Mission Found</h2>
          <button onClick={() => router.push('/')} className="mt-4 px-6 py-2 rounded-xl border border-ink/10 text-ink/60 hover:bg-ink/5 transition-colors text-[12px] font-mono">Return to Intake</button>
        </div>
      </div>
    );
  }

  if (loadError || !state) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-transparent">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto mb-4 text-red-400" size={28} />
          <h2 className="text-ink text-lg font-medium">{loadError ?? "Could not load this mission's output."}</h2>
          <button onClick={load} className="mt-4 px-6 py-2 rounded-xl border border-ink/10 text-ink/60 hover:bg-ink/5 transition-colors text-[12px] font-mono inline-flex items-center gap-2">
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const documentStep = findDocumentStep(state.steps);
  const completedSteps = state.steps.filter(s => s.status === "completed" && s.output);
  const isTerminalFailure = state.status === "failed" || state.status === "blocked";
  const isComplete = state.status === "completed";
  const noPlan = state.steps.length === 0;

  // What actually goes on the page: the real document step's real output if
  // one exists; otherwise every real completed step's output, concatenated
  // and labeled -- never a fabricated paragraph standing in for content that
  // was never produced.
  let documentBody: { heading: string; text: string }[] = [];
  if (documentStep?.output) {
    documentBody = [{ heading: documentStep.action, text: documentStep.output }];
  } else if (completedSteps.length > 0) {
    documentBody = completedSteps.map(s => ({ heading: `${s.action} (${s.agent})`, text: s.output as string }));
  }

  return (
    <div className="relative flex h-full w-full bg-surface text-ink overflow-hidden">

      {/* ── LEFT PANEL: REVIEW WORKSPACE ── */}
      <div className="w-[380px] h-full flex flex-col border-r border-ink/[0.04] bg-surface shrink-0">

        <div className="h-16 px-6 border-b border-ink/[0.04] flex items-center shrink-0">
          <span className="text-[12px] font-mono uppercase tracking-widest text-ink/40 flex items-center gap-2">
            {isComplete ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
            Review Workspace
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8 scrollbar-hide">

          {/* Real mission status -- never a fixed "all checks passed" */}
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-ink/30 mb-4">Mission Status</h3>
            <div className={`p-4 rounded-xl border ${isComplete ? 'border-emerald-500/20 bg-emerald-500/[0.06]' : isTerminalFailure ? 'border-red-500/20 bg-red-500/[0.06]' : 'border-amber-500/20 bg-amber-500/[0.06]'}`}>
              <span className={`text-[11px] font-mono uppercase tracking-widest ${isComplete ? 'text-emerald-400' : isTerminalFailure ? 'text-red-400' : 'text-amber-400'}`}>
                {state.status}
              </span>
              {state.status_reason && (
                <div className="text-[12px] text-ink/60 leading-relaxed mt-2 space-y-1">
                  <MarkdownRenderer content={state.status_reason} />
                </div>
              )}
              {isTerminalFailure && documentStep?.output && (
                <p className="text-[11px] text-red-400/80 leading-relaxed mt-3 italic">
                  A document was produced below, but this mission did not pass -- treat it as a draft, not an approved deliverable.
                </p>
              )}
            </div>
          </div>

          {/* Real classification data */}
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-ink/30 mb-4">Classification</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Intent</span> {state.intent ?? "—"}</div>
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Confidence</span> {state.confidence != null ? `${state.confidence}%` : "—"}</div>
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Complexity</span> {state.complexity_band ?? "—"}</div>
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Execution Mode</span> {state.execution_mode ?? "—"}</div>
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Risk Level</span> {state.risk_level ?? (noPlan ? "N/A (conversational)" : "—")}</div>
            </div>
          </div>

          {/* Notes -- honest highlight/flag tool, no fabricated AI rewrite */}
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-ink/30 mb-4 flex items-center gap-2">
              Flagged Passages {comments.filter(c => c.status === 'pending').length > 0 && <span className="bg-ink/10 px-1.5 py-0.5 rounded text-ink">{comments.filter(c => c.status === 'pending').length}</span>}
            </h3>
            {comments.length === 0 ? (
              <div className="p-4 border border-ink/[0.04] bg-surface rounded-xl text-center">
                <p className="text-[12px] text-ink/40">Highlight text in the document to flag it for follow-up. This records a note only -- there is no automated rewrite.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className={`p-4 border rounded-xl flex flex-col gap-2 ${c.status === 'pending' ? 'border-amber-500/20 bg-amber-500/5' : 'border-ink/[0.04] bg-surface opacity-50'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] font-medium">
                        {c.status === 'pending' ? <Clock size={12} className="text-amber-500" /> : <CheckCircle2 size={12} className="text-emerald-500" />}
                        <span className={c.status === 'pending' ? 'text-amber-500' : 'text-ink/40'}>{c.status === 'pending' ? 'Flagged' : 'Resolved'}</span>
                      </div>
                      {c.status === 'pending' && (
                        <button onClick={() => resolveComment(c.id)} className="text-[10px] text-ink/40 hover:text-ink underline">Mark resolved</button>
                      )}
                    </div>
                    <p className="text-[13px] text-ink/80">"{c.text}"</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-ink/[0.04]">
            <h3 className="text-[10px] font-mono uppercase tracking-widest text-ink/30 mb-4">Mission Metadata</h3>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Mission ID</span> {state.mission_id}</div>
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Trace ID</span> {state.trace_id}</div>
              <div className="flex justify-between text-ink/60"><span className="text-ink/30">Steps Completed</span> {completedSteps.length} / {state.steps.length}</div>
            </div>
          </div>

        </div>
      </div>

      {/* ── RIGHT PANEL: DOCUMENT ── */}
      <div className="flex-1 flex flex-col h-full bg-surface overflow-hidden relative">

        <div className="h-16 px-8 border-b border-ink/[0.04] flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-4">
            <span className="text-[14px] font-medium text-ink/80 flex items-center gap-2">
              <FileText size={16} className="text-ink/40" /> {documentStep ? documentStep.action : "Mission Output"}
            </span>
            <span className={`px-2 py-0.5 rounded border text-[10px] font-mono tracking-widest uppercase ${
              isComplete ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : isTerminalFailure ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20"
            }`}>
              {isComplete ? "Ready for Review" : isTerminalFailure ? "Did Not Complete" : state.status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {state.has_app_files && (
              <a
                href={`/api/mission/${state.mission_id}/download`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink text-brand-ink hover:bg-ink/90 text-[11px] font-medium transition-colors"
              >
                <Download size={14} /> Download App
              </a>
            )}
            <button onClick={() => setIsDrawerOpen(!isDrawerOpen)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink/5 hover:bg-ink/10 text-ink/80 text-[11px] font-medium transition-colors border border-ink/[0.04]">
              <Layers size={14} /> Agent Timeline
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-12 bg-surface">
          <div className="max-w-3xl mx-auto pb-32">
            <h1 className="text-[32px] font-display text-ink mb-8 border-b border-ink/[0.04] pb-6">
              {missionLocal.description || "Mission Output"}
            </h1>

            {documentBody.length === 0 ? (
              <div className="p-6 rounded-xl border border-ink/10 bg-ink/[0.02] text-[13px] text-ink/60 leading-relaxed">
                {noPlan
                  ? "This request was handled conversationally (no plan, no document-generating step) -- there is no document artifact to show here."
                  : "No step has produced output yet for this mission."}
              </div>
            ) : (
              <div className="space-y-10">
                {documentBody.map((section, i) => (
                  <div key={i}>
                    {documentBody.length > 1 && (
                      <h2 className="text-[13px] font-mono uppercase tracking-widest text-ink/40 mb-3">{section.heading}</h2>
                    )}
                    <div
                      data-block-id={`block-${i}`}
                      className="document-block relative group rounded-xl"
                    >
                      {comments.some(c => c.blockId === `block-${i}` && c.status === 'pending') && (
                        <div className="absolute -left-6 top-1"><div className="h-2 w-2 rounded-full bg-amber-500" /></div>
                      )}
                      <div className="font-body">
                        <MarkdownRenderer content={section.text} variant="document" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Selection Toolbar -- flag only, no fake AI actions */}
      <AnimatePresence>
        {selectedText && (
          <motion.div
            id="selection-toolbar"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed z-50 flex items-center gap-1 p-1 bg-surface border border-ink/10 rounded-xl shadow-[0_10px_30px_hsl(var(--surface) / 0.8)]"
            style={{ top: selectedText.top, left: selectedText.left, transform: 'translateX(-50%)' }}
          >
            <button onClick={handleHighlightComment} className="px-3 py-1.5 rounded-lg hover:bg-ink/10 text-ink/80 hover:text-ink text-[11px] font-medium transition-colors whitespace-nowrap">
              Flag for review
            </button>
            <div className="w-px h-4 bg-ink/10 mx-1" />
            <button onClick={() => setSelectedText(null)} className="p-1.5 rounded-lg hover:bg-ink/10 text-ink/40 hover:text-ink transition-colors">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── AGENT TIMELINE DRAWER: real steps, real status, no fixed durations ── */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute right-0 top-0 bottom-0 w-[380px] bg-surface border-l border-ink/[0.04] shadow-[-20px_0_40px_hsl(var(--surface) / 0.8)] flex flex-col z-40"
          >
            <div className="h-16 px-6 border-b border-ink/[0.04] flex items-center justify-between shrink-0">
              <h2 className="text-[12px] font-mono uppercase tracking-widest text-ink/80">How this was generated</h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 rounded-lg text-ink/40 hover:text-ink hover:bg-ink/5 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {state.steps.length === 0 ? (
                <p className="text-[12px] text-ink/40 italic">No plan or agent steps -- this request was handled conversationally.</p>
              ) : (
                <div className="relative border-l border-ink/10 ml-4 space-y-8 pb-8">
                  {state.steps.map(step => {
                    const Icon = step.agent === "ResearchAgent" ? Globe
                      : step.agent === "ReportAgent" ? FileText
                      : step.agent === "ReasoningAgent" ? BrainCircuit
                      : BookOpen;
                    const isDone = step.status === "completed";
                    const isFailed = step.status === "failed";
                    return (
                      <div key={step.step_id} className="relative pl-6">
                        <div className={`absolute -left-3 top-0 h-6 w-6 rounded-full bg-surface border flex items-center justify-center ${isFailed ? 'border-red-500/40' : isDone ? 'border-emerald-500/40' : 'border-ink/20'}`}>
                          <Icon size={12} className={isFailed ? "text-red-400" : isDone ? "text-emerald-500" : "text-ink/40"} />
                        </div>
                        <h4 className="text-[13px] font-medium text-ink/90">{step.action}</h4>
                        <p className="text-[11px] text-ink/40 mt-1">{step.agent} &middot; {step.operation}</p>
                        {step.error && (
                          <div className="text-[11px] text-red-400/80 mt-1 leading-relaxed">
                            <MarkdownRenderer content={step.error} />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] font-mono px-1.5 rounded border ${
                            isFailed ? "text-red-400 bg-red-500/10 border-red-500/20"
                              : isDone ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                              : "text-ink/40 bg-ink/5 border-ink/10"
                          }`}>
                            {step.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="relative pl-6">
                    <div className={`absolute -left-3 top-0 h-6 w-6 rounded-full bg-surface border flex items-center justify-center ${isComplete ? 'border-emerald-500/40' : isTerminalFailure ? 'border-red-500/40' : 'border-ink/20'}`}>
                      <ShieldCheck size={12} className={isComplete ? "text-emerald-500" : isTerminalFailure ? "text-red-400" : "text-ink/40"} />
                    </div>
                    <h4 className="text-[13px] font-medium text-ink/90">Mission Outcome</h4>
                    <div className="text-[11px] text-ink/40 mt-1 leading-relaxed">
                      {state.status_reason ? <MarkdownRenderer content={state.status_reason} /> : "—"}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`text-[10px] font-mono px-1.5 rounded border ${
                        isComplete ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                          : "text-red-400 bg-red-500/10 border-red-500/20"
                      }`}>
                        {state.status}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
