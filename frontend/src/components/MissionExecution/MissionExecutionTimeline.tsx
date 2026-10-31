"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader,
  Lock,
  Shield,
  Database,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExecutionStep {
  id: string;
  number: number;
  title: string;
  status: "pending" | "running" | "completed" | "skipped";
  details?: string[];
  conditionalOn?: "MemoryAgent" | "CitadelAgent" | null;
  isConditional?: boolean;
  requiresApproval?: boolean;
}

interface MissionExecutionTimelineProps {
  steps: ExecutionStep[];
  citadelEnabled: boolean;
  memoryEnabled: boolean;
}

export const MissionExecutionTimeline: React.FC<
  MissionExecutionTimelineProps
> = ({ steps, citadelEnabled, memoryEnabled }) => {
  // Filter steps based on optional agent toggles
  const visibleSteps = steps.filter((step) => {
    if (step.conditionalOn === "CitadelAgent" && !citadelEnabled) {
      return false;
    }
    if (step.conditionalOn === "MemoryAgent" && !memoryEnabled) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-ink/90 tracking-tight">
        MISSION EXECUTION PLAN
      </h2>

      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {visibleSteps.map((step, index) => (
            <ExecutionStepCard
              key={step.id}
              step={step}
              isLast={index === visibleSteps.length - 1}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

interface ExecutionStepCardProps {
  step: ExecutionStep;
  isLast: boolean;
  index: number;
}

const ExecutionStepCard: React.FC<ExecutionStepCardProps> = ({
  step,
  isLast,
  index,
}) => {
  const statusConfig = {
    pending: {
      icon: Circle,
      color: "text-ink/30",
      bgColor: "bg-ink/5",
      borderColor: "border-ink/10",
      label: "PENDING",
      animating: false,
    },
    running: {
      icon: Loader,
      color: "text-green-400/80",
      bgColor: "bg-green-400/5",
      borderColor: "border-green-400/20",
      label: "RUNNING",
      animating: true,
    },
    completed: {
      icon: CheckCircle2,
      color: "text-green-500/80",
      bgColor: "bg-green-500/5",
      borderColor: "border-green-500/20",
      label: "COMPLETED",
      animating: false,
    },
    skipped: {
      icon: AlertCircle,
      color: "text-ink/40",
      bgColor: "bg-ink/[0.02]",
      borderColor: "border-ink/10",
      label: "SKIPPED",
      animating: false,
    },
  };

  const config = statusConfig[step.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="relative"
    >
      {/* Timeline connector */}
      {!isLast && (
        <div
          className={cn(
            "absolute left-[19px] top-12 w-0.5 h-8",
            step.status === "completed"
              ? "bg-green-500/30"
              : step.status === "running"
                ? "bg-green-400/30"
                : "bg-ink/10"
          )}
        />
      )}

      {/* Step Card */}
      <div
        className={cn(
          "border rounded-lg p-4 space-y-3 transition-all duration-300",
          config.borderColor,
          config.bgColor,
          step.status === "running" && "border-green-400/30 bg-green-400/[0.03]"
        )}
      >
        {/* Header with icon and status */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-1">
            {config.animating ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Icon className={cn("w-5 h-5", config.color)} />
              </motion.div>
            ) : (
              <Icon className={cn("w-5 h-5", config.color)} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink tracking-tight">
                STEP {step.number}
              </h3>
              {step.isConditional && (
                <span className="text-xs text-ink/40 bg-ink/5 px-2 py-0.5 rounded border border-ink/10">
                  OPTIONAL
                </span>
              )}
            </div>

            <p className="text-xs text-ink/60 mt-1">{step.title}</p>
          </div>

          <div className="text-xs font-semibold uppercase tracking-wider text-ink/50">
            {config.label}
          </div>
        </div>

        {/* Details section */}
        {step.details && step.details.length > 0 && (
          <div className="space-y-2 pl-8 pt-2 border-t border-ink/10">
            {step.details.map((detail, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="text-xs text-ink/50 flex items-center gap-2"
              >
                <span className="text-ink/30">•</span>
                <span>{detail}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Approval required indicator */}
        {step.requiresApproval && step.status === "pending" && (
          <div className="mt-4 pt-4 border-t border-ink/10">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-yellow-400/60" />
              <p className="text-xs text-yellow-400/70 font-semibold uppercase tracking-wider">
                Human In The Loop Required
              </p>
            </div>
            <p className="text-xs text-ink/50 mb-3">
              Waiting for approval to proceed with mission execution.
            </p>
            <button className="w-full px-3 py-2 rounded bg-green-400/10 border border-green-400/30 text-xs font-semibold text-green-400/80 uppercase tracking-wider hover:bg-green-400/20 transition-all duration-200">
              Approve Mission
            </button>
          </div>
        )}

        {/* Output section for completed steps */}
        {step.status === "completed" && (
          <div className="mt-3 pt-3 border-t border-green-500/20 space-y-1">
            {step.title.includes("Sovereign") && (
              <>
                <p className="text-xs text-ink/50">
                  <span className="text-ink/70 font-semibold">Trust Score:</span> 92%
                </p>
                <p className="text-xs text-green-400/70">
                  <span className="text-green-400/90 font-semibold">Risk Level:</span> LOW
                </p>
              </>
            )}
            {step.title.includes("Citadel") && (
              <>
                <p className="text-xs text-ink/50">
                  <span className="text-ink/70 font-semibold">Security Confidence:</span> 97%
                </p>
                <p className="text-xs text-green-400/70">
                  <span className="text-green-400/90 font-semibold">Status:</span> No threats detected
                </p>
              </>
            )}
            {step.title.includes("Analysis") && (
              <>
                <p className="text-xs text-ink/50">
                  <span className="text-ink/70 font-semibold">Confidence Score:</span> 91%
                </p>
                <p className="text-xs text-ink/50">
                  <span className="text-ink/70 font-semibold">Sources Verified:</span> 47
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};
