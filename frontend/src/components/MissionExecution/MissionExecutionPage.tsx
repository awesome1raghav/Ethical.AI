"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Cpu,
  Database,
  Lock,
  Brain,
  Zap,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AgentOrchestrations, type Agent as AgentType } from "./AgentOrchestrations";
import {
  MissionExecutionTimeline,
  type ExecutionStep,
} from "./MissionExecutionTimeline";
import { MissionEnhancements } from "./MissionEnhancements";

type MissionStatus = "idle" | "running" | "paused" | "completed" | "failed";

export default function MissionExecutionPage() {
  const [missionStatus, setMissionStatus] = useState<MissionStatus>("idle");
  const [citadelEnabled, setCitadelEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number | null>(null);

  // Initialize agents
  const [agents, setAgents] = useState<AgentType[]>([
    {
      id: "research-agent",
      name: "ResearchAgent",
      role: "Research & Retrieval",
      icon: <Activity className="w-5 h-5" />,
      status: "waiting",
      progress: 0,
      enabled: true,
      isOptional: false,
    },
    {
      id: "sovereign-agent",
      name: "SovereignAgent",
      role: "Governance Layer",
      icon: <Lock className="w-5 h-5" />,
      status: "waiting",
      progress: 0,
      enabled: true,
      isOptional: false,
    },
    {
      id: "analysis-agent",
      name: "AnalysisAgent",
      role: "Intelligence Synthesis",
      icon: <Cpu className="w-5 h-5" />,
      status: "waiting",
      progress: 0,
      enabled: true,
      isOptional: false,
    },
    {
      id: "citadel-agent",
      name: "CitadelAgent",
      role: "Security Verification",
      icon: <Lock className="w-5 h-5" />,
      status: "waiting",
      progress: 0,
      enabled: citadelEnabled,
      isOptional: true,
      onToggle: () => setCitadelEnabled(!citadelEnabled),
    },
    {
      id: "memory-agent",
      name: "MemoryAgent",
      role: "Knowledge Persistence",
      icon: <Brain className="w-5 h-5" />,
      status: "waiting",
      progress: 0,
      enabled: memoryEnabled,
      isOptional: true,
      onToggle: () => setMemoryEnabled(!memoryEnabled),
    },
  ]);

  // Initialize execution steps
  const [steps, setSteps] = useState<ExecutionStep[]>([
    {
      id: "login",
      number: 1,
      title: "(LOGIN) Checking mission permissions...",
      status: "pending",
      requiresApproval: false,
    },
    {
      id: "classification",
      number: 2,
      title: "Mission classified",
      status: "pending",
      details: ["Intent detected: Research + Analysis", "ResearchAgent initializing..."],
    },
    {
      id: "deploy-research",
      number: 3,
      title: "Deploying ResearchAgent",
      status: "pending",
      details: [
        "Researching: Government documents",
        "Researching: Reports",
        "Researching: Policies",
        "Researching: Knowledge sources",
        "Status: Running...",
        "Progress: 12 sources analyzed",
      ],
    },
    {
      id: "memory-sync",
      number: 4,
      title: "If MemoryAgent ON: Synchronizing Knowledge Graph",
      status: "pending",
      conditionalOn: "MemoryAgent",
      isConditional: true,
      details: ["+12 references linked", "+34 memory nodes updated"],
    },
    {
      id: "sovereign-validation",
      number: 5,
      title: "Sovereign governance validation running",
      status: "pending",
      details: [
        "Checking: Ethical Risk",
        "Checking: Compliance Risk",
        "Checking: Legal Risk",
        "Checking: Execution Risk",
      ],
    },
    {
      id: "citadel-verification",
      number: 6,
      title: "If CitadelAgent ON: Citadel verification running",
      status: "pending",
      conditionalOn: "CitadelAgent",
      isConditional: true,
      details: [
        "Checking: Prompt Injection",
        "Checking: Unsafe Outputs",
        "Checking: Tool Misuse",
      ],
    },
    {
      id: "analysis-synthesis",
      number: 7,
      title: "AnalysisAgent synthesizing intelligence",
      status: "pending",
      details: ["Processing findings...", "Confidence Score: 91%", "Sources Verified: 47"],
    },
    {
      id: "mission-ready",
      number: 8,
      title: "Mission Ready",
      status: "pending",
      details: ["✓ Swarm execution complete"],
    },
  ]);

  // Update agents when optional toggles change
  useEffect(() => {
    setAgents((prev) =>
      prev.map((agent) => ({
        ...agent,
        enabled:
          agent.id === "citadel-agent"
            ? citadelEnabled
            : agent.id === "memory-agent"
              ? memoryEnabled
              : agent.enabled,
      }))
    );
  }, [citadelEnabled, memoryEnabled]);

  // Simulate mission execution
  useEffect(() => {
    if (missionStatus !== "running") return;

    const executionSequence = async () => {
      const stepSequence = [
        { stepIndex: 0, agentIndex: -1, delay: 1000 },
        { stepIndex: 1, agentIndex: -1, delay: 2000 },
        { stepIndex: 2, agentIndex: 0, delay: 2000 }, // ResearchAgent
        { stepIndex: 3, agentIndex: 4, delay: 1500, conditional: memoryEnabled },
        { stepIndex: 4, agentIndex: 1, delay: 2000 }, // SovereignAgent
        { stepIndex: 5, agentIndex: 3, delay: 1500, conditional: citadelEnabled },
        { stepIndex: 6, agentIndex: 2, delay: 2000 }, // AnalysisAgent
        { stepIndex: 7, agentIndex: -1, delay: 1000 },
      ];

      for (const seq of stepSequence) {
        if (seq.conditional === false) continue;

        await new Promise((resolve) => setTimeout(resolve, seq.delay));

        // Update step status
        setSteps((prev) => {
          const updated = [...prev];
          updated[seq.stepIndex].status = "running";
          return updated;
        });

        // Update agent status if applicable
        if (seq.agentIndex >= 0) {
          setAgents((prev) => {
            const updated = [...prev];
            updated[seq.agentIndex].status = "running";
            return updated;
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Mark complete
        setSteps((prev) => {
          const updated = [...prev];
          updated[seq.stepIndex].status = "completed";
          return updated;
        });

        if (seq.agentIndex >= 0) {
          setAgents((prev) => {
            const updated = [...prev];
            updated[seq.agentIndex].status = "completed";
            updated[seq.agentIndex].progress = 100;
            return updated;
          });
        }
      }

      setMissionStatus("completed");
    };

    executionSequence();
  }, [missionStatus, citadelEnabled, memoryEnabled]);

  const handleStartMission = () => {
    setMissionStatus("running");
    setSteps((prev) =>
      prev.map((step) => ({ ...step, status: "pending" }))
    );
    setAgents((prev) =>
      prev.map((agent) => ({ ...agent, status: "waiting", progress: 0 }))
    );
  };

  const isDeployDisabled =
    missionStatus === "idle" || missionStatus === "running";

  return (
    <div className="min-h-screen bg-brand-ink text-ink p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
              MISSION EXECUTION CENTER
            </h1>
            <p className="text-ink/50 text-sm">
              Orchestrate, monitor, and execute swarm intelligence missions
            </p>
          </div>
          <Link
            href="/missions"
            className="flex items-center gap-2 text-sm text-ink/60 hover:text-ink/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Missions
          </Link>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Agent Orchestrations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-1"
          >
            <div className="border border-ink/10 bg-ink/[0.02] rounded-lg p-6 backdrop-blur-sm sticky top-8">
              <AgentOrchestrations agents={agents} />

              {/* Mission Enhancements */}
              <div className="mt-8 pt-8 border-t border-ink/10">
                <MissionEnhancements
                  citadelEnabled={citadelEnabled}
                  memoryEnabled={memoryEnabled}
                  onCitadelToggle={() => setCitadelEnabled(!citadelEnabled)}
                  onMemoryToggle={() => setMemoryEnabled(!memoryEnabled)}
                  isExecutionComplete={missionStatus === "completed"}
                />
              </div>
            </div>
          </motion.div>

          {/* Right Column - Mission Execution Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="space-y-8">
              {/* Timeline */}
              <div className="border border-ink/10 bg-ink/[0.02] rounded-lg p-6 backdrop-blur-sm">
                <MissionExecutionTimeline
                  steps={steps}
                  citadelEnabled={citadelEnabled}
                  memoryEnabled={memoryEnabled}
                />
              </div>

              {/* Control Buttons */}
              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartMission}
                  disabled={missionStatus !== "idle"}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-lg font-semibold uppercase tracking-wider",
                    "border transition-all duration-200",
                    missionStatus === "idle"
                      ? "border-green-400/40 bg-green-400/10 text-green-400/90 hover:bg-green-400/20"
                      : "border-ink/20 bg-ink/5 text-ink/50 cursor-not-allowed"
                  )}
                >
                  {missionStatus === "idle" && "Start Mission"}
                  {missionStatus === "running" && "Mission Running..."}
                  {missionStatus === "completed" && "Mission Complete"}
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isDeployDisabled}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-lg font-semibold uppercase tracking-wider",
                    "border transition-all duration-200 flex items-center justify-center gap-2",
                    isDeployDisabled
                      ? "border-ink/20 bg-ink/5 text-ink/50 cursor-not-allowed"
                      : "border-blue-400/40 bg-blue-400/10 text-blue-400/90 hover:bg-blue-400/20"
                  )}
                >
                  <span>Deploy to Execution</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Status Message */}
              <AnimatePresence>
                {missionStatus === "completed" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="border border-green-400/30 bg-green-400/5 rounded-lg p-4 text-center"
                  >
                    <p className="text-sm text-green-400/80">
                      ✓ Mission execution complete and ready for deployment
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>

        {/* Timeline Summary (Footer) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 border border-ink/10 bg-ink/[0.02] rounded-lg p-6 backdrop-blur-sm"
        >
          <h2 className="text-lg font-semibold text-ink/90 tracking-tight mb-4">
            EXECUTION TIMELINE
          </h2>

          <div className="space-y-2 text-sm text-ink/60">
            {steps.map((step, idx) => {
              const isVisible =
                (step.conditionalOn !== "CitadelAgent" || citadelEnabled) &&
                (step.conditionalOn !== "MemoryAgent" || memoryEnabled);

              if (!isVisible) return null;

              const statusIcon =
                step.status === "completed"
                  ? "✓"
                  : step.status === "running"
                    ? "⟳"
                    : "○";

              return (
                <div key={step.id} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-5 text-center",
                      step.status === "completed" && "text-green-400",
                      step.status === "running" && "text-green-400 animate-pulse",
                      step.status === "pending" && "text-ink/30"
                    )}
                  >
                    {statusIcon}
                  </span>
                  <span className="text-ink/60">{step.title}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
