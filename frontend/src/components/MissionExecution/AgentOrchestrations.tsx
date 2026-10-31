"use client";

import React from "react";
import { motion } from "framer-motion";
import { Activity, Cpu, Database, Lock, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Agent {
  id: string;
  name: string;
  role: string;
  icon: React.ReactNode;
  status: "waiting" | "running" | "completed";
  progress: number;
  enabled: boolean;
  isOptional: boolean;
  onToggle?: () => void;
}

interface AgentOrchestrationProps {
  agents: Agent[];
}

export const AgentOrchestrations: React.FC<AgentOrchestrationProps> = ({
  agents,
}) => {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-ink/90 tracking-tight">
        AGENT ORCHESTRATIONS
      </h2>

      {/* Core Agents Section */}
      <div className="space-y-3">
        <p className="text-xs text-ink/50 uppercase tracking-wider">
          3 Core Agents (Always Active)
        </p>
        {agents
          .filter((agent) => !agent.isOptional)
          .map((agent, index) => (
            <AgentCard key={agent.id} agent={agent} isOptional={false} />
          ))}
      </div>

      {/* Optional Agents Section */}
      <div className="mt-8 space-y-3">
        <p className="text-xs text-ink/50 uppercase tracking-wider">
          2 Optional Agents (Toggle ON/OFF)
        </p>
        {agents
          .filter((agent) => agent.isOptional)
          .map((agent, index) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              isOptional={true}
              onToggle={agent.onToggle}
            />
          ))}
      </div>
    </div>
  );
};

interface AgentCardProps {
  agent: Agent;
  isOptional: boolean;
  onToggle?: () => void;
}

const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  isOptional,
  onToggle,
}) => {
  const statusColors = {
    waiting: "text-ink/50",
    running: "text-green-400/80",
    completed: "text-green-500/80",
  };

  const statusText = {
    waiting: "WAITING",
    running: "RUNNING",
    completed: "COMPLETED",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "border border-ink/10 bg-ink/[0.02] backdrop-blur-sm",
        "rounded-lg p-4 space-y-3",
        "hover:border-ink/20 hover:bg-ink/[0.03] transition-all duration-300",
        agent.enabled && "border-ink/20 bg-ink/[0.04]"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="text-ink/60 mt-0.5 flex-shrink-0">{agent.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-ink tracking-tight">
              {agent.name}
            </h3>
            <p className="text-xs text-ink/50 mt-0.5">{agent.role}</p>
          </div>
        </div>
      </div>

      {/* Status and Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className={cn("uppercase tracking-wider", statusColors[agent.status])}>
            Status: {statusText[agent.status]}
          </span>
          <span className="text-ink/40">{agent.progress}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-ink/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${agent.progress}%` }}
            transition={{ duration: 0.6 }}
            className={cn(
              "h-full rounded-full",
              agent.status === "running" && "bg-green-400/60",
              agent.status === "completed" && "bg-green-500/60",
              agent.status === "waiting" && "bg-ink/20"
            )}
          />
        </div>
      </div>

      {/* Footer */}
      {isOptional ? (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-ink/40">Optional Agent</p>
          <button
            onClick={onToggle}
            className={cn(
              "px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider",
              "border transition-all duration-200",
              agent.enabled
                ? "border-green-400/40 bg-green-400/5 text-green-400/80 hover:bg-green-400/10"
                : "border-ink/20 bg-ink/5 text-ink/50 hover:bg-ink/10"
            )}
          >
            {agent.enabled ? "ON" : "OFF"}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-ink/40">Core Agent</p>
          <span className="px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider border border-ink/20 bg-ink/5 text-ink/60">
            ON
          </span>
        </div>
      )}
    </motion.div>
  );
};
