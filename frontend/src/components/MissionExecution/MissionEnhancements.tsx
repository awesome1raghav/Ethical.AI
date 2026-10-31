"use client";

import React from "react";
import { motion } from "framer-motion";
import { Shield, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissionEnhancementsProps {
  citadelEnabled: boolean;
  memoryEnabled: boolean;
  onCitadelToggle: () => void;
  onMemoryToggle: () => void;
  isExecutionComplete: boolean;
}

export const MissionEnhancements: React.FC<MissionEnhancementsProps> = ({
  citadelEnabled,
  memoryEnabled,
  onCitadelToggle,
  onMemoryToggle,
  isExecutionComplete,
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-ink/70 uppercase tracking-wider">
        Mission Enhancements
      </h3>

      <div className="space-y-2">
        {/* CitadelAgent Toggle */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className={cn(
            "border rounded-lg p-3 flex items-center justify-between",
            "transition-all duration-300",
            citadelEnabled
              ? "border-green-400/30 bg-green-400/[0.03]"
              : "border-ink/10 bg-ink/[0.02]"
          )}
        >
          <div className="flex items-center gap-2">
            <Shield className={cn(
              "w-4 h-4",
              citadelEnabled ? "text-green-400/60" : "text-ink/40"
            )} />
            <span className="text-xs font-semibold text-ink/70">
              CitadelAgent
            </span>
          </div>

          <button
            onClick={onCitadelToggle}
            disabled={isExecutionComplete}
            className={cn(
              "px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider",
              "border transition-all duration-200 disabled:opacity-50",
              citadelEnabled
                ? "border-green-400/40 bg-green-400/5 text-green-400/80 hover:bg-green-400/10 disabled:hover:bg-green-400/5"
                : "border-ink/20 bg-ink/5 text-ink/50 hover:bg-ink/10 disabled:hover:bg-ink/5"
            )}
          >
            {citadelEnabled ? "ON" : "OFF"}
          </button>
        </motion.div>

        {/* MemoryAgent Toggle */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className={cn(
            "border rounded-lg p-3 flex items-center justify-between",
            "transition-all duration-300",
            memoryEnabled
              ? "border-green-400/30 bg-green-400/[0.03]"
              : "border-ink/10 bg-ink/[0.02]"
          )}
        >
          <div className="flex items-center gap-2">
            <Brain className={cn(
              "w-4 h-4",
              memoryEnabled ? "text-green-400/60" : "text-ink/40"
            )} />
            <span className="text-xs font-semibold text-ink/70">
              MemoryAgent
            </span>
          </div>

          <button
            onClick={onMemoryToggle}
            disabled={isExecutionComplete}
            className={cn(
              "px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider",
              "border transition-all duration-200 disabled:opacity-50",
              memoryEnabled
                ? "border-green-400/40 bg-green-400/5 text-green-400/80 hover:bg-green-400/10 disabled:hover:bg-green-400/5"
                : "border-ink/20 bg-ink/5 text-ink/50 hover:bg-ink/10 disabled:hover:bg-ink/5"
            )}
          >
            {memoryEnabled ? "ON" : "OFF"}
          </button>
        </motion.div>
      </div>

      <p className="text-xs text-ink/40 pt-2">
        Enabling agents automatically injects their steps into the workflow.
        Disabling removes their steps.
      </p>
    </div>
  );
};
