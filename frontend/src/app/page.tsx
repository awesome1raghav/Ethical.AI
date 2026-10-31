"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { 
  Paperclip, 
  Mic, 
  Rocket, 
  Link2,
  Target,
  BarChart3,
  Activity,
  Clock,
  DollarSign,
  Shield,
  Dna,
  Database,
  Cpu,
  MessageSquare,
  Workflow,
  Send,
  Trash2,
  Sparkles,
  Bot,
  User,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  Check,
  ArrowRight,
  Zap,
  Globe,
  Gauge
} from "lucide-react";
import { cn } from "@/lib/utils";

import { naturalLanguageMissionIntake, type NaturalLanguageMissionIntakeOutput } from "@/ai/flows/natural-language-mission-intake";
import { saveMission, getChatHistory, saveChatTurn, clearChatHistory } from "@/app/actions/db-actions";
import { createNexusMission, detectNexusIntent, checkNexusBackendHealth, createDecision, recommendAgents, type NexusDecision, type AgentAdvice } from "@/app/actions/nexus-backend-bridge";
import { generateCompletion, synthesizeResearchBrief, resolveResearchContext, type TokenUsage } from "@/app/actions/ai-models-bridge";

import { ContextBuilder, type AttachedItem } from "@/components/ContextBuilder";
import { ExecutionEnvironmentModal }    from "@/components/ExecutionEnvironmentModal";
import { ALL_CONNECTIONS }             from "@/components/ExecutionEnvironmentPanel";
import { PopButton } from "@/components/ui/PopButton";
import { VoiceInput } from "@/components/VoiceInput";
import { AVAILABLE_MODELS, type AIModelOption } from "@/constants/models";
import { renderMessageContent } from "@/components/MarkdownRenderer";

const MISSION_SNAPSHOT_KEY = "ethicalai.launchSnapshot";

// Backend AgentType names -> the agent ids seeded in agents_registry.
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

const GLOBAL_CHAT_ID = "global-chat";

// ─── Fast Local Pre-Analysis ──────────────────────────────────────────────────
function localFastAnalysis(text: string): Partial<NaturalLanguageMissionIntakeOutput> | null {
  const trimmed = text.trim();
  if (trimmed.length < 5) return null;

  const lower     = trimmed.toLowerCase();
  const wordCount = trimmed.split(/\s+/).length;

  let primary_intent = "General Operations";
  if (/research|analyz|find|search|investigat|study/i.test(lower))  primary_intent = "Research & Analysis";
  else if (/financ|budget|money|refund|pay|invoice/i.test(lower))    primary_intent = "Finance & Billing";
  else if (/secur|hack|audit|threat|vulnerab/i.test(lower))          primary_intent = "Cybersecurity";
  else if (/code|software|develop|deploy|git/i.test(lower))          primary_intent = "Engineering";

  const confidenceScore = Math.min(98, Math.round(Math.min(1, wordCount / 20) * 85 + (wordCount > 8 ? 13 : 0)));
  
  let complexity = "Low";
  if (wordCount > 30 || /architect|deploy|audit|comprehensive/i.test(lower)) complexity = "High";
  else if (wordCount > 12) complexity = "Moderate";

  const estimatedDuration = wordCount > 30 ? "18–24 min" : wordCount > 15 ? "5–10 min" : "1–3 min";
  const cost = wordCount > 30 ? "$0.082" : wordCount > 15 ? "$0.042" : "$0.012";

  return {
    primary_intent,
    confidence: confidenceScore,
    workflow: { complexity, steps: 3 } as any,
    estimatedDuration,
    suggested_agents: [],
    ...( { cost } as any ),
  };
}

/**
 * A panel row that discloses its own reasoning.
 *
 * Every number the panel shows is derived, and until now the derivation was
 * invisible. Tapping a row reveals the explanation the backend computed for
 * that specific signal.
 */
function PanelRow({
  icon: Icon,
  label,
  value,
  explanation,
  delay = 0,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  explanation?: string;
  delay?: number;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const interactive = Boolean(explanation);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "rounded-xl bg-ink/[0.01] border border-ink/[0.03] transition-colors",
        interactive && "hover:bg-ink/[0.03]"
      )}
    >
      <button
        type="button"
        disabled={!interactive}
        aria-expanded={interactive ? open : undefined}
        onClick={() => interactive && setOpen((v) => !v)}
        className={cn(
          "w-full p-4 flex flex-col gap-3 text-left",
          interactive ? "cursor-pointer" : "cursor-default"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="h-3.5 w-3.5 text-ink/45 shrink-0" />
            <span className="text-[10px] font-mono text-ink/55 uppercase tracking-wide truncate">
              {label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[12px] font-body font-medium text-ink">{value}</span>
            {interactive && (
              <ChevronDown
                className={cn(
                  "h-3 w-3 text-ink/35 transition-transform duration-200",
                  open && "rotate-180"
                )}
              />
            )}
          </div>
        </div>
        {children}
      </button>

      <AnimatePresence initial={false}>
        {open && explanation && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-4 pt-0 text-[11.5px] leading-relaxed font-body text-ink/60 border-t border-ink/[0.04] mt-1 pt-3">
              {explanation}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

type InteractionMode = "chat" | "agentic";

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  agent_name?: string | null;
  message: string;
  created_at: string;
  usage?: TokenUsage;
  latency_ms?: number;
  isDeepResearch?: boolean;
  // The user turn that triggered deep research, used to fetch an agent
  // recommendation for that exact message.
  sourcePrompt?: string;
}

export default function MissionControlPage() {
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("agentic");

  const [input,           setInput]           = useState("");
  const [contextItems,    setContextItems]    = useState<AttachedItem[]>([]);
  const [connections,     setConnections]     = useState<Record<string, boolean>>(
    Object.fromEntries(ALL_CONNECTIONS.map((c) => [c.id, false]))
  );

  const [aiResult,     setAiResult]     = useState<NaturalLanguageMissionIntakeOutput | null>(null);
  const [localResult,  setLocalResult]  = useState<Partial<NaturalLanguageMissionIntakeOutput> | null>(null);
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [decision,     setDecision]     = useState<NexusDecision | null>(null);
  const [agentAdvice,  setAgentAdvice]  = useState<AgentAdvice | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);
  const recommendPromptRef = useRef<string>("");

  // Per-message agent recommendations for the chat-mode "Execute with Agents"
  // card, keyed by message id, from the /api/agents/recommend pipeline.
  const [chatAgentAdvice, setChatAgentAdvice] = useState<Record<string, AgentAdvice>>({});
  const [chatAdviceState, setChatAdviceState] = useState<Record<string, 'loading' | 'error'>>({});
  const chatAdviceRequested = useRef<Set<string>>(new Set());
  // Which recommended agents are currently toggled on per message -- starts
  // with every real recommendation selected, click to deselect.
  const [chatSelectedAgents, setChatSelectedAgents] = useState<Record<string, Set<string>>>({});
  const [expandedChatAgent, setExpandedChatAgent] = useState<string | null>(null);

  const [isLaunching,  setIsLaunching]  = useState(false);
  const [launchError,  setLaunchError]  = useState<string | null>(null);
  const [envModalOpen, setEnvModalOpen] = useState(false);
  const [contextOpen,  setContextOpen]  = useState(false);
  
  // ── Chatbot & Model Selection State ─────────────────────────────────────────
  const [selectedModel, setSelectedModel] = useState<AIModelOption>(AVAILABLE_MODELS[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatMissionId, setChatMissionId] = useState<string>(() => `M-CHAT-${Math.floor(1000 + Math.random() * 9000)}`);
  const [isChatSending, setIsChatSending] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  // Load Chat History & Check Backend Health
  useEffect(() => {
    async function loadChat() {
      try {
        const history = await getChatHistory(chatMissionId);
        if (history && history.length > 0) {
          setChatMessages(history);
        } else {
          setChatMessages([
            {
              id: 'welcome-msg',
              sender: 'assistant',
              agent_name: 'NEXUS Copilot',
              message: 'Hello! I am NEXUS AI Copilot. I run on Gemma 4 12B locally, with every message checked by Helix (NVIDIA NeMo Guardrails).',
              created_at: new Date().toISOString(),
            }
          ]);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }

    async function checkHealth() {
      const res = await checkNexusBackendHealth();
      setBackendOnline(res.online);
    }

    loadChat();
    checkHealth();
  }, [chatMissionId]);

  // Close model dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-scroll chat stream
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatSending]);

  // ── AI Analysis for Agentic Mode ───────────────────────────────────────────
  useEffect(() => {
    if (interactionMode !== "agentic") return;
    if (input.trim().length < 5) { setLocalResult(null); setAiResult(null); return; }
    setLocalResult(localFastAnalysis(input));
  }, [input, interactionMode]);

  useEffect(() => {
    if (interactionMode !== "agentic") return;
    if (input.trim().length < 8) { setIsAnalyzing(false); setDecision(null); setAgentAdvice(null); return; }
    // A review describes one exact prompt; once it changes, drop it and release
    // the button so a stale in-flight call cannot keep it disabled.
    if (agentAdvice && agentAdvice.prompt !== input.trim()) {
      setAgentAdvice(null);
      setRecommendError(null);
    }
    recommendPromptRef.current = "";
    setIsRecommending(false);
    const timer = setTimeout(() => {
      setIsAnalyzing(true);
      // Two independent calls, deliberately NOT awaited together: the backend
      // Decision Engine answers in ~1ms and owns routing (intent, confidence,
      // complexity, mode), while the Genkit flow takes seconds and only supplies
      // governance enrichment the backend does not produce yet. Awaiting both
      // would hold the panel hostage to the slower one -- or to its failure.
      let pending = 2;
      const settle = () => { if (--pending === 0) setIsAnalyzing(false); };

      createDecision(input)
        .then((dec) => { if (dec) setDecision(dec); })
        .catch((err) => console.error("Decision Engine call failed:", err))
        .finally(settle);

      naturalLanguageMissionIntake({ missionDescription: input })
        .then((enrichment) => { if (enrichment) setAiResult(enrichment); })
        .catch((err) => console.error("Governance enrichment failed:", err))
        .finally(settle);
    }, 900);
    return () => clearTimeout(timer);
  }, [input, interactionMode]);

  // Real per-message agent recommendation for the chat "Execute with Agents"
  // card -- fires once per message id, keyed off sourcePrompt so it survives
  // re-renders without re-requesting.
  useEffect(() => {
    for (const msg of chatMessages) {
      if (!msg.isDeepResearch || !msg.sourcePrompt) continue;
      if (chatAdviceRequested.current.has(msg.id)) continue;
      chatAdviceRequested.current.add(msg.id);

      setChatAdviceState((prev) => ({ ...prev, [msg.id]: 'loading' }));
      recommendAgents(msg.sourcePrompt).then((advice) => {
        if (advice) {
          setChatAgentAdvice((prev) => ({ ...prev, [msg.id]: advice }));
          setChatSelectedAgents((prev) => ({
            ...prev,
            [msg.id]: new Set(advice.agents.recommendations.map((r) => r.agent)),
          }));
          setChatAdviceState((prev) => {
            const next = { ...prev };
            delete next[msg.id];
            return next;
          });
        } else {
          setChatAdviceState((prev) => ({ ...prev, [msg.id]: 'error' }));
        }
      }).catch((err) => {
        console.error("Chat agent recommendation failed:", err);
        setChatAdviceState((prev) => ({ ...prev, [msg.id]: 'error' }));
      });
    }
  }, [chatMessages]);

  const base = aiResult ?? localResult;
  // Backend decision wins on routing; enrichment fills the governance fields.
  const displayData = base || decision ? {
    ...(base as any),
    ...(decision ? {
      primary_intent: decision.intent_label,
      confidence: decision.confidence,
      workflow: { ...((base as any)?.workflow ?? {}), complexity: decision.complexity_band, steps: decision.estimated_steps },
      estimatedDuration: decision.estimated_duration,
      cost: decision.estimated_cost,
    } : {}),
  } as any : null;
  const canLaunch = input.trim().length >= 3;
  const activeConnCount = Object.values(connections).filter(Boolean).length;
  const showIntelligence = interactionMode === "agentic" && input.trim().length >= 5;

  const [isBriefSynthesizing, setIsBriefSynthesizing] = useState(false);

  // ── Handle Chat Submit ──────────────────────────────────────────────────────
  const handleSendChatMessage = async (customPrompt?: string) => {
    const promptToSend = (customPrompt || input).trim();
    if (!promptToSend || isChatSending) return;

    setInput("");
    setIsChatSending(true);

    const isDeepResearchIntent = /deep research|deep dive|in-depth|comprehensive analysis|thorough research|investigate|full report|research/i.test(promptToSend);

    const tempUserMsg: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sender: 'user',
      message: promptToSend,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, tempUserMsg]);

    try {
      // Prepare thread history for multi-turn conversational context
      const historyPayload = chatMessages.map(c => ({
        role: (c.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: c.message
      }));

      // Call Multi-LLM Bridge for completion and token metrics
      const result = await generateCompletion(
        promptToSend,
        selectedModel.id,
        selectedModel.name,
        selectedModel.provider,
        historyPayload
      );

      // Save turn to chat history (creates/updates Mission in database.db AND nexus.db with model maxContext)
      await saveChatTurn(
        chatMissionId, 
        promptToSend, 
        result.text, 
        result.agent, 
        selectedModel.name, 
        selectedModel.maxContext
      );

      const tempAiMsg: ChatMessage = {
        id: `temp-ai-${Date.now()}`,
        sender: 'assistant',
        agent_name: result.agent,
        message: result.text,
        created_at: new Date().toISOString(),
        usage: result.usage,
        latency_ms: result.latency_ms,
        isDeepResearch: isDeepResearchIntent,
        sourcePrompt: isDeepResearchIntent ? promptToSend : undefined,
      };

      setChatMessages((prev) => [...prev, tempAiMsg]);
    } catch (err) {
      console.error("Chat turn failed:", err);
      const tempErrMsg: ChatMessage = {
        id: `temp-err-${Date.now()}`,
        sender: 'assistant',
        agent_name: 'System Error',
        message: 'Unable to communicate with AI provider. Stored locally.',
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, tempErrMsg]);
    } finally {
      setIsChatSending(false);
    }
  };

  const toggleChatAgent = (msgId: string, agent: string) => {
    setChatSelectedAgents((prev) => {
      const current = new Set(prev[msgId] ?? []);
      if (current.has(agent)) current.delete(agent);
      else current.add(agent);
      return { ...prev, [msgId]: current };
    });
  };

  const handleExecuteWithAgents = async (aiMessageText?: string) => {
    setIsBriefSynthesizing(true);
    try {
      const historyText = chatMessages.map(m => `${m.sender.toUpperCase()}: ${m.message}`).join('\n\n');
      const lastUserPrompt = chatMessages.filter(m => m.sender === 'user').pop()?.message || input || 'Deep Research Mission';

      // 1. Resolve Reference Context
      const resolution = await resolveResearchContext(lastUserPrompt, historyText);
      if (resolution.state === 'CLARIFICATION_REQUIRED') {
        setChatMessages(prev => [
          ...prev,
          {
            id: `msg-clarify-${Date.now()}`,
            sender: 'assistant',
            agent_name: 'Context Resolver',
            message: resolution.message || "Sure — what topic would you like me to research?",
            created_at: new Date().toISOString()
          }
        ]);
        return; // Abort mission dispatch and stay in Chat Mode
      }

      const activeTopic = resolution.resolved_topic || lastUserPrompt;

      // 2. Synthesize Professional Executive Research Brief using LLM
      const professionalBrief = await synthesizeResearchBrief(activeTopic, historyText);

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('ethicalai.launchSnapshot', JSON.stringify({
          prompt: activeTopic,
          escalatedBrief: professionalBrief,
          timestamp: Date.now()
        }));
      }

      router.push('/intake');
    } catch (err) {
      console.error("Brief synthesis error:", err);
      router.push('/intake');
    } finally {
      setIsBriefSynthesizing(false);
    }
  };

  const handleClearChatHistory = async () => {
    const newMissionId = `M-CHAT-${Math.floor(1000 + Math.random() * 9000)}`;
    setChatMissionId(newMissionId);
    setChatMessages([
      {
        id: 'welcome-msg-reset',
        sender: 'assistant',
        agent_name: 'NEXUS Copilot',
        message: 'Chat history cleared. Select any model to start a new chat.',
        created_at: new Date().toISOString(),
      }
    ]);
  };

  // ── Handle Launch for Agentic Mode ──────────────────────────────────────────
  const handleRecommendAgents = async () => {
    const prompt = input.trim();
    if (isRecommending || !prompt) return;

    // Tie the result to the prompt it was requested for. If the user edits the
    // prompt while this is in flight, the late response is discarded instead of
    // being shown against text it does not describe.
    recommendPromptRef.current = prompt;
    setIsRecommending(true);
    setRecommendError(null);

    try {
      const advice = await recommendAgents(prompt);
      if (recommendPromptRef.current !== prompt) return;   // superseded
      if (advice) {
        setAgentAdvice(advice);
      } else {
        setRecommendError("Could not reach the review service. Nothing was changed.");
      }
    } catch (err) {
      if (recommendPromptRef.current !== prompt) return;
      console.error("Agent recommendation failed:", err);
      setRecommendError(
        err instanceof Error ? err.message : "Review failed for an unknown reason."
      );
    } finally {
      // Always clears, including on the superseded path — without this a lost
      // request leaves the button disabled forever.
      setIsRecommending(false);
    }
  };

  const handleLaunch = async () => {
    if (interactionMode === "chat") {
      await handleSendChatMessage();
      return;
    }

    if (!canLaunch || isLaunching) return;
    setIsLaunching(true);
    setLaunchError(null);

    try {
      // The backend owns the mission: its id, plan and governance verdict.
      const result = await createNexusMission(input.trim(), decision?.decision_id);

      if (!result) {
        setLaunchError(
          "Could not reach the NEXUS backend. The mission was not created."
        );
        setIsLaunching(false);
        return;
      }

      const steps = result.steps.map((s) => ({
        name: s.action,
        assigned_agent_id: AGENT_ID_MAP[s.agent] ?? "execution_agent",
        // Governance decided this, not a keyword match on the prompt.
        is_legal: !s.destructive,
        legality_reason: s.destructive
          ? `Irreversible operation (${s.operation}) — requires approval`
          : s.purpose || s.description,
      }));

      await saveMission(
        result.mission_id,
        input,
        displayData?.primary_intent ?? result.intent ?? "General",
        result.risk_level ?? displayData?.riskLevel ?? "Low",
        displayData?.clarityScore ?? 70,
        steps,
        [],
        {
          confidence: result.confidence ?? displayData?.confidence,
          complexity: result.complexity_band ?? displayData?.workflow?.complexity,
          riskReason: result.risk_reason ?? displayData?.riskReason,
          decisionId: result.decision_id ?? decision?.decision_id,
        }
      );

      window.sessionStorage.setItem(MISSION_SNAPSHOT_KEY, JSON.stringify({
        missionId: result.mission_id,
        missionDescription: input.trim(),
        status: result.status,
        statusReason: result.status_reason,
        planId: result.plan_id,
        executionStrategy: result.execution_strategy,
        requiresApproval: result.requires_human_approval,
        launchedAt: new Date().toISOString(),
      }));

      router.push("/execution");
    } catch (err) {
      // Surface launch failures instead of navigating away.
      console.error("Launch failed:", err);
      setLaunchError(
        err instanceof Error ? err.message : "Launch failed for an unknown reason."
      );
      setIsLaunching(false);
    }
  };

  return (
    <>
      <ExecutionEnvironmentModal
        isOpen={envModalOpen}
        onClose={() => setEnvModalOpen(false)}
        connections={connections}
        onToggle={(id) => setConnections((p) => ({ ...p, [id]: !p[id] }))}
      />

      <div className="flex flex-col h-full w-full gap-6 max-w-[1600px] mx-auto pt-6 relative">
        
        {/* TOP LEVEL MODE SWITCHER */}
        <div className="flex justify-center mb-2 shrink-0">
          <div className="inline-flex items-center p-1 rounded-lg bg-ink/[0.02] border border-ink/[0.04]">
            <button 
              onClick={() => setInteractionMode("chat")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-medium transition-all",
                interactionMode === "chat" ? "bg-ink/[0.06] text-ink shadow-sm" : "text-ink/45 hover:text-ink"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat Mode
            </button>
            <button 
              onClick={() => setInteractionMode("agentic")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-medium transition-all",
                interactionMode === "agentic" ? "bg-ink/[0.06] text-ink shadow-sm" : "text-ink/45 hover:text-ink"
              )}
            >
              <Workflow className="h-3.5 w-3.5" />
              Agentic Mode
            </button>
          </div>
        </div>

        <motion.div
          key="workspace"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-1 min-h-0 flex-col w-full gap-6"
        >
          {/* MAIN WORKSPACE AREA */}
          <div className={cn(
            "flex gap-6 flex-1 min-h-0 transition-all duration-500",
            interactionMode === "agentic" && !showIntelligence && "max-w-4xl mx-auto w-full"
          )}>
            
            {/* CENTRAL WORKSPACE / CHATBOT BOX */}
            <motion.div layout className="flex-grow bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col relative overflow-hidden">
              
              {interactionMode === "chat" ? (
                /* ─── CHATBOT INTERFACE WITH MODEL SELECTOR & TOKEN TRACKING ──────── */
                <div className="flex flex-col h-full w-full">
                  {/* Chat Header & Model Selector Dropdown */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-ink/[0.04] shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-ink/10 flex items-center justify-center border border-ink/10">
                        <Bot className="h-4 w-4 text-ink" />
                      </div>
                      <div>
                        <h2 className="text-[14px] font-display font-medium text-ink">NEXUS AI Chatbot</h2>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("h-1.5 w-1.5 rounded-full", backendOnline ? "bg-ink shadow-[0_0_8px_hsl(var(--ink) / 0.4)]" : "bg-amber-400")} />
                          <span className="text-[10px] font-mono text-ink/55">
                            {backendOnline ? "Backend Live (port 8000)" : "Local AI Active"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* MODEL SELECTOR DROPDOWN */}
                    <div className="flex items-center gap-3 relative" ref={dropdownRef}>
                      <button
                        onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-ink/[0.03] border border-ink/[0.08] hover:bg-ink/[0.06] transition-all text-ink shadow-sm"
                      >
                        <span className="text-sm">{selectedModel.icon}</span>
                        <div className="flex flex-col text-left">
                          <span className="text-[11px] font-mono font-bold text-ink leading-tight">
                            {selectedModel.name}
                          </span>
                          <span className="text-[9px] font-mono text-ink/55">
                            Provider: {selectedModel.provider}
                          </span>
                        </div>
                        <ChevronDown className={cn("h-3.5 w-3.5 text-ink/55 transition-transform", isModelDropdownOpen && "rotate-180")} />
                      </button>

                      {/* Dropdown Menu */}
                      <AnimatePresence>
                        {isModelDropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-12 z-50 w-[320px] bg-surface border border-ink/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl"
                          >
                            <div className="px-3 py-2 border-b border-ink/[0.05] mb-1 flex justify-between items-center">
                              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink/55">Select AI Model</span>
                              <span className="text-[9px] font-mono text-ink bg-ink/10 px-2 py-0.5 rounded">NeMo Guardrails On</span>
                            </div>

                            <div className="max-h-[300px] overflow-y-auto space-y-1 scrollbar-hide">
                              {['Ollama'].map((providerGroup) => {
                                const providerModels = AVAILABLE_MODELS.filter((m) => m.provider === providerGroup);
                                if (providerModels.length === 0) return null;

                                return (
                                  <div key={providerGroup} className="space-y-1 pt-1">
                                    <div className="px-2 py-1 text-[9px] font-mono font-bold uppercase text-ink/45">
                                      {providerGroup} Models
                                    </div>
                                    {providerModels.map((model) => {
                                      const isSelected = selectedModel.id === model.id;
                                      return (
                                        <button
                                          key={model.id}
                                          onClick={() => {
                                            setSelectedModel(model);
                                            setIsModelDropdownOpen(false);
                                          }}
                                          className={cn(
                                            "w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between group",
                                            isSelected
                                              ? "bg-ink/10 border border-ink/10 text-ink"
                                              : "hover:bg-ink/[0.04] text-ink/65 hover:text-ink"
                                          )}
                                        >
                                          <div className="flex items-center gap-2.5">
                                            <span className="text-base">{model.icon}</span>
                                            <div className="flex flex-col">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[12px] font-display font-medium text-ink">
                                                  {model.name}
                                                </span>
                                                {model.badge && (
                                                  <span className="text-[8px] font-mono px-1.5 py-0.2 rounded bg-ink/10 text-ink/80">
                                                    {model.badge}
                                                  </span>
                                                )}
                                              </div>
                                              <span className="text-[10px] font-body text-ink/55 line-clamp-1">
                                                {model.description}
                                              </span>
                                            </div>
                                          </div>
                                          {isSelected && <Check className="h-4 w-4 text-ink shrink-0" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <button
                        onClick={handleClearChatHistory}
                        title="Clear Chat History"
                        className="p-2 rounded-lg bg-ink/[0.02] border border-ink/[0.04] hover:bg-ink/[0.06] text-ink/55 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Scrollable Chat Stream */}
                  <div ref={chatScrollRef} className="flex-grow min-h-0 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                    {chatMessages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex gap-3 max-w-[85%]",
                          msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border text-[11px] font-mono",
                          msg.sender === 'user'
                            ? "bg-ink/10 border-ink/20 text-ink"
                            : "bg-ink/[0.04] border-ink/10 text-ink"
                        )}>
                          {msg.sender === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                        </div>

                        <div className={cn(
                          "p-4 rounded-2xl text-[13px] font-body leading-relaxed border shadow-sm flex flex-col gap-2",
                          msg.sender === 'user'
                            ? "bg-ink/[0.08] border-ink/10 text-ink rounded-tr-none"
                            : "bg-ink/[0.02] border-ink/[0.04] text-ink/88 rounded-tl-none"
                        )}>
                          {msg.agent_name && (
                            <div className="text-[10px] font-mono text-ink/55 flex items-center gap-1.5">
                              <Sparkles className="h-3 w-3 text-ink" />
                              <span>{msg.agent_name}</span>
                            </div>
                          )}
                          <div className="flex flex-col gap-2">{renderMessageContent(msg.message)}</div>

                          {/* Token Usage Badge */}
                          {msg.sender === 'assistant' && (
                            <div className="mt-1 pt-2 border-t border-ink/[0.04] flex items-center justify-between gap-4 text-[9px] font-mono text-ink/55">
                              <div className="flex items-center gap-2">
                                <Gauge className="h-3 w-3 text-ink" />
                                <span>{msg.usage?.total_tokens || Math.round(msg.message.length / 4)} tokens</span>
                                {msg.usage && (
                                  <span className="text-ink/45">
                                    (Prompt: {msg.usage.prompt_tokens} | Response: {msg.usage.completion_tokens})
                                  </span>
                                )}
                              </div>
                              {msg.latency_ms && (
                                <span className="text-ink/45">⚡ {(msg.latency_ms / 1000).toFixed(2)}s</span>
                              )}
                            </div>
                          )}

                          {/* Deep Research Agent Recommendation Card -- recolored to the
                              app's actual theme (ink/brand/signal, see globals.css) instead
                              of a one-off purple/blue gradient that matched nothing else. */}
                          {msg.sender === 'assistant' && msg.isDeepResearch && (
                            <div className="mt-3 p-4 rounded-xl border border-ink/10 bg-gradient-to-br from-ink/[0.05] to-transparent flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-ink/85">
                                  <Sparkles className="h-4 w-4 text-ink/70 animate-pulse" />
                                  <span>This task would benefit from Agent Execution</span>
                                </div>
                                <span className="text-[9px] font-mono bg-ink/[0.06] text-ink/55 px-2 py-0.5 rounded-full border border-ink/10">Deep Research Detected</span>
                              </div>

                              {/* Real, per-task recommendation from /api/agents/recommend --
                                  never a fixed checklist. Runs the same Decision Engine ->
                                  Planner -> HELIX -> MATRIX -> AgentFactory chain used
                                  elsewhere, so what's shown here is what would actually
                                  be assigned if this mission were launched. Click a chip to
                                  deselect it, hover to read why it was recommended. */}
                              {chatAdviceState[msg.id] === 'loading' && (
                                <div className="flex items-center gap-2 text-[10px] font-mono text-ink/40 p-2">
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  <span>Analyzing which agents this task actually needs...</span>
                                </div>
                              )}

                              {chatAdviceState[msg.id] === 'error' && (
                                <div className="text-[10px] font-mono text-ink/40 p-2 bg-ink/[0.02] rounded-lg border border-ink/5">
                                  Could not reach the agent review service -- showing no recommendation rather than a guess.
                                </div>
                              )}

                              {chatAgentAdvice[msg.id] && (() => {
                                const advice = chatAgentAdvice[msg.id];
                                const selected = chatSelectedAgents[msg.id] ?? new Set<string>();
                                const activeKey = expandedChatAgent?.startsWith(`${msg.id}:`)
                                  ? expandedChatAgent.slice(msg.id.length + 1) : null;
                                const activeRec = activeKey
                                  ? advice.agents.recommendations.find((r) => r.agent === activeKey)
                                  : null;
                                return (
                                  <div className="flex flex-col gap-2">
                                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-ink/70">
                                      {advice.agents.recommendations.map((r) => {
                                        const isSelected = selected.has(r.agent);
                                        return (
                                          <button
                                            key={r.agent}
                                            type="button"
                                            onClick={() => toggleChatAgent(msg.id, r.agent)}
                                            onMouseEnter={() => setExpandedChatAgent(`${msg.id}:${r.agent}`)}
                                            onMouseLeave={() => setExpandedChatAgent((cur) => cur === `${msg.id}:${r.agent}` ? null : cur)}
                                            className={cn(
                                              "flex flex-col gap-0.5 p-2 rounded-lg border text-left transition-colors cursor-pointer",
                                              isSelected
                                                ? "bg-ink/[0.06] border-ink/20 text-ink/90"
                                                : "bg-ink/[0.01] border-ink/5 text-ink/30"
                                            )}
                                          >
                                            <div className="flex items-center gap-1.5">
                                              <span className={cn("font-bold", isSelected ? "text-ink" : "text-ink/20")}>
                                                {isSelected ? "✓" : "○"}
                                              </span>
                                              <span>{r.agent}</span>
                                              <span className="text-[8px] text-ink/40 ml-auto">{r.confidence}</span>
                                            </div>
                                            {r.steps.length > 0 && (
                                              <span className="text-[8px] text-ink/35 pl-4">{r.steps.join(", ")}</span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {activeRec && (
                                      <div className="text-[10px] font-body text-ink/55 leading-relaxed px-2.5 py-2 bg-ink/[0.03] rounded-lg border border-ink/5">
                                        <span className="font-mono text-ink/40">{activeRec.agent}:</span> {activeRec.rationale}
                                      </div>
                                    )}

                                    {advice.agents.gaps.length > 0 && (
                                      <div className="text-[9px] font-mono text-amber-400/70 px-1">
                                        Unmatched: {advice.agents.gaps.join("; ")}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              <button
                                onClick={() => handleExecuteWithAgents(msg.message)}
                                disabled={isBriefSynthesizing}
                                className="w-full mt-1 py-2.5 px-4 rounded-lg bg-ink text-brand-ink hover:bg-ink/90 font-mono text-[11px] font-bold tracking-wide flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                              >
                                {isBriefSynthesizing ? (
                                  <>
                                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    <span>Synthesizing Professional Research Brief...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>
                                      Execute with Agents
                                      {chatAgentAdvice[msg.id] && ` (${(chatSelectedAgents[msg.id] ?? new Set()).size})`}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                  </>
                                )}
                              </button>
                            </div>
                          )}

                          <span className="text-[9px] font-mono text-ink/45 block text-right">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    ))}

                    {/* Thinking Indicator */}
                    {isChatSending && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3 mr-auto items-center text-ink/55 text-[12px] font-mono"
                      >
                        <div className="h-7 w-7 rounded-lg bg-ink/[0.04] border border-ink/10 flex items-center justify-center text-ink">
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        </div>
                        <span>{selectedModel.name} is generating & counting tokens...</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Chat Input Bar */}
                  <div className="mt-3 relative flex items-center rounded-xl border border-ink/[0.04] bg-ink/[0.02] p-2 shrink-0">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      placeholder={`Message ${selectedModel.name} (${selectedModel.provider})...`}
                      className="w-full bg-transparent border-none outline-none resize-none text-[14px] font-body text-ink placeholder:text-ink/20 px-3 py-1 h-10 leading-normal scrollbar-hide"
                    />
                    <div className="flex items-center gap-2 pr-1">
                      <VoiceInput 
                        value={input}
                        onChange={(val) => setInput(val)}
                      />
                      <button
                        onClick={() => handleSendChatMessage()}
                        disabled={!canLaunch || isChatSending}
                        className={cn(
                          "h-8 px-4 rounded-lg flex items-center gap-2 text-[12px] font-medium transition-all",
                          canLaunch && !isChatSending
                            ? "bg-ink text-brand-ink hover:bg-ink/90"
                            : "bg-ink/10 text-ink/30 cursor-not-allowed"
                        )}
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ─── AGENTIC MISSION EDITOR ─────────────────────────────────────── */
                <>
                  {/* Hero: oversized display headline, compact composer, subhead
                      beneath, capability strip last -- the reference's ordering. */}
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col items-center justify-center py-6">
                    <h1 className="text-center font-display font-bold text-ink tracking-[-0.04em] leading-[0.95] text-[clamp(2.5rem,6.5vw,5.25rem)] max-w-[16ch] mb-10">
                      Define your mission.
                    </h1>

                    <div className="w-full max-w-3xl rounded-3xl border border-ink/[0.06] bg-ink/[0.02] overflow-hidden focus-within:border-ink/15 transition-colors">
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe what you want to build..."
                        rows={4}
                        className="w-full bg-transparent border-none focus:ring-0 outline-none resize-none px-6 pt-6 pb-4 text-[17px] font-body text-ink placeholder:text-ink/30 leading-relaxed scrollbar-hide"
                      />

                      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-ink/[0.06]">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setContextOpen(!contextOpen)}
                            className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-ink/[0.05] transition-colors text-ink/55 hover:text-ink"
                          >
                            <Paperclip className="h-4 w-4" />
                            <span className="text-[12.5px] font-body font-medium">Attach</span>
                            {contextItems.length > 0 && (
                              <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-ink/10 text-[10px] font-mono text-ink">{contextItems.length}</span>
                            )}
                          </button>
                          <button
                            onClick={() => setEnvModalOpen(true)}
                            className="flex items-center gap-2 px-3 py-2 rounded-full hover:bg-ink/[0.05] transition-colors text-ink/55 hover:text-ink"
                          >
                            <Link2 className="h-4 w-4" />
                            <span className="text-[12.5px] font-body font-medium">Connections</span>
                            {activeConnCount > 0 && (
                              <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-ink/10 text-[10px] font-mono text-ink">{activeConnCount}</span>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <VoiceInput value={input} onChange={(val) => setInput(val)} />
                          <button
                            onClick={handleLaunch}
                            disabled={!canLaunch}
                            className={cn(
                              "flex items-center gap-2 pl-5 pr-4 py-2.5 rounded-full text-[13px] font-semibold transition-all",
                              "bg-brand text-brand-ink hover:opacity-90",
                              "disabled:bg-ink/10 disabled:text-ink/35 disabled:cursor-not-allowed"
                            )}
                          >
                            <span>Launch mission</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {launchError && (
                      <div
                        role="alert"
                        className="mt-4 w-full max-w-3xl rounded-xl border border-signal/40 bg-signal/[0.06] px-4 py-3 text-[13px] font-body text-ink/85"
                      >
                        {launchError}
                      </div>
                    )}

                    <p className="mt-7 max-w-[52ch] text-center text-[15.5px] leading-relaxed font-body text-ink/55">
                      Describe the objective. EthicalAI plans the work, routes it through
                      governance and security review, then runs the agent swarm with every
                      stage visible.
                    </p>

                  </div>

                  <AnimatePresence>
                    {contextOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -10 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        className="mt-4 pt-4 border-t border-ink/[0.04]"
                      >
                        <ContextBuilder
                          items={contextItems}
                          onAdd={(item) => setContextItems((p) => [...p, item])}
                          onRemove={(id) => setContextItems((p) => p.filter((i) => i.id !== id))}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>

            {/* RIGHT: Intelligence Panel */}
            <AnimatePresence mode="wait">
              {showIntelligence && (
                <motion.div 
                  key="intel-panel"
                  initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: 20, filter: "blur(4px)", width: 0, padding: 0, margin: 0, border: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="w-[360px] shrink-0 bg-surface border border-ink/[0.04] rounded-2xl p-6 flex flex-col overflow-hidden"
                >
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-ink/[0.04]">
                    <span className="font-display font-medium text-[13px] text-ink">Intelligence Panel</span>
                    <div className="flex items-center gap-1.5 bg-ink/[0.02] border border-ink/[0.04] px-2 py-0.5 rounded-md">
                      <div className={cn("h-1 w-1 rounded-full", displayData ? "bg-ink/80 animate-pulse" : "bg-ink/20")} />
                      <span className="text-[9px] font-mono font-medium uppercase tracking-widest text-ink">
                        {displayData ? "Live" : "Standby"}
                      </span>
                    </div>
                  </div>

                  <div className="flex-grow space-y-2 overflow-y-auto scrollbar-hide">
                    <PanelRow
                      icon={Target}
                      label="Detected Intent"
                      value={displayData?.primary_intent || "Awaiting Input..."}
                      explanation={decision?.explanations?.intent}
                      delay={0.1}
                    />

                    <PanelRow
                      icon={BarChart3}
                      label="Confidence Score"
                      value={`${displayData?.confidence ?? 0}%`}
                      explanation={decision?.explanations?.confidence}
                      delay={0.15}
                    >
                      <div className="h-1 w-full bg-ink/[0.04] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${displayData?.confidence ?? 0}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className="h-full bg-ink/80"
                        />
                      </div>
                    </PanelRow>

                    <PanelRow
                      icon={Activity}
                      label="Complexity"
                      value={displayData?.workflow?.complexity || "Unknown"}
                      explanation={decision?.explanations?.complexity}
                      delay={0.2}
                    >
                      <div className="flex gap-1 h-1">
                        {(() => {
                          // Band order comes from the backend's ComplexityBand enum,
                          // so the segments track the real scale rather than a
                          // three-level Low/Moderate/High guess.
                          const BANDS = ["TRIVIAL", "SIMPLE", "MODERATE", "COMPLEX", "MULTI_PHASE"];
                          const current = (displayData?.workflow?.complexity || "TRIVIAL").toUpperCase();
                          const idx = BANDS.indexOf(current);
                          return BANDS.map((band, i) => (
                            <div
                              key={band}
                              className={cn(
                                "flex-1 rounded-full transition-colors duration-500",
                                i <= idx ? "bg-ink/80" : "bg-ink/[0.04]"
                              )}
                            />
                          ));
                        })()}
                      </div>
                    </PanelRow>

                    <PanelRow
                      icon={Workflow}
                      label="Execution Mode"
                      value={decision?.execution_mode || "—"}
                      explanation={decision?.explanations?.mode}
                      delay={0.22}
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 }}
                      className="flex gap-2"
                    >
                      <div className="flex-1">
                        <PanelRow
                          icon={Clock}
                          label="Duration"
                          value={displayData?.estimatedDuration || "—"}
                          explanation={decision?.explanations?.duration}
                        />
                      </div>
                      <div className="flex-1">
                        <PanelRow
                          icon={DollarSign}
                          label="Cost"
                          value={(displayData as any)?.cost || "$0.00"}
                          explanation={decision?.explanations?.cost}
                        />
                      </div>
                    </motion.div>

                    <PanelRow
                      icon={Cpu}
                      label="Estimated Agents"
                      value={
                        decision?.estimated_agents?.length
                          ? `${decision.estimated_agents.length}`
                          : "—"
                      }
                      explanation={decision?.explanations?.agents}
                      delay={0.3}
                    >
                      {decision?.agent_breakdown?.length ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          {decision.agent_breakdown.map((a) => (
                            <div key={a.agent} className="flex items-start gap-2">
                              <span className="text-[11px] font-body font-medium text-ink/85 shrink-0">
                                {a.agent}
                              </span>
                              <span className="text-[10px] font-mono text-ink/40 shrink-0">
                                {a.steps} step{a.steps === "1" ? "" : "s"}
                              </span>
                              <span className="text-[10.5px] font-body text-ink/45 truncate">
                                {a.does}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </PanelRow>

                    {/* User-initiated: this is the only advisory call that spends
                        a model request, so it runs on a click, not on typing. */}
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 }}
                      className="pt-1"
                    >
                      <button
                        type="button"
                        onClick={handleRecommendAgents}
                        disabled={isRecommending || !decision}
                        className={cn(
                          "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl",
                          "text-[12px] font-body font-medium transition-all",
                          "border border-ink/10 hover:bg-ink/[0.05] text-ink/75 hover:text-ink",
                          "disabled:opacity-40 disabled:cursor-not-allowed"
                        )}
                      >
                        {isRecommending ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            Reviewing plan, governance and security…
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5" />
                            Recommend agents
                          </>
                        )}
                      </button>
                    </motion.div>

                    {recommendError && (
                      <div role="alert" className="mt-2 px-3 py-2 rounded-lg border border-signal/40 bg-signal/[0.06] text-[11px] font-body text-ink/80">
                        {recommendError}
                      </div>
                    )}

                    <AnimatePresence>
                      {agentAdvice && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 p-4 rounded-xl bg-ink/[0.02] border border-ink/[0.06] flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-ink/45">
                                Agent Review
                              </span>
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-ink/[0.06] text-ink/55">
                                {agentAdvice.agents.source === "llm" ? "Gemma 4 12B" : "Deterministic"}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                              <div className="p-2 rounded-lg bg-ink/[0.02]">
                                <div className="text-ink/40 uppercase mb-0.5">HELIX</div>
                                <div className="text-ink/85">
                                  {agentAdvice.helix.decision} · {agentAdvice.helix.risk}
                                </div>
                              </div>
                              <div className="p-2 rounded-lg bg-ink/[0.02]">
                                <div className="text-ink/40 uppercase mb-0.5">MATRIX</div>
                                <div className="text-ink/85">
                                  {agentAdvice.matrix.status} · {agentAdvice.matrix.threat}
                                </div>
                              </div>
                            </div>

                            <p className="text-[11.5px] leading-relaxed font-body text-ink/60">
                              {agentAdvice.agents.summary}
                            </p>

                            <div className="flex flex-col gap-2">
                              {agentAdvice.agents.recommendations.map((r) => (
                                <div key={r.agent} className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11.5px] font-body font-medium text-ink">
                                      {r.agent}
                                    </span>
                                    <span className="text-[9px] font-mono text-ink/40">
                                      {r.steps.join(", ")}
                                    </span>
                                    <span className="text-[9px] font-mono px-1 rounded bg-ink/[0.06] text-ink/50">
                                      {r.confidence}
                                    </span>
                                  </div>
                                  <p className="text-[10.5px] font-body text-ink/50 leading-relaxed">
                                    {r.rationale}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {agentAdvice.agents.gaps.length > 0 && (
                              <div className="pt-2 border-t border-ink/[0.06]">
                                <div className="text-[9px] font-mono uppercase text-ink/40 mb-1">
                                  Unmatched work
                                </div>
                                {agentAdvice.agents.gaps.map((g, i) => (
                                  <p key={i} className="text-[10.5px] font-body text-ink/55">
                                    {g}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </motion.div>
      </div>
    </>
  );
}

/* ─── Markdown rendering ──────────────────────────────────────────────────────
 * Block-level parser is now imported from @/components/MarkdownRenderer
 */
