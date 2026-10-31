"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Globe, Shield, Terminal, Code, RefreshCw } from "lucide-react";
import { saveMission } from "@/app/actions/db-actions";
import { createNexusMission } from "@/app/actions/nexus-backend-bridge";

const MISSION_SNAPSHOT_KEY = "ethicalai.launchSnapshot";

export default function NewMission() {
  const [missionDescription, setMissionDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleInitialiseMission = async () => {
    if (missionDescription.trim().length < 5 || isSubmitting) return;
    setIsSubmitting(true);

    const missionId = `M-${Math.floor(100 + Math.random() * 900)}`;
    const steps = [
      { name: "Analyse mission requirements", assigned_agent_id: "compliance_enforcer", is_legal: true, legality_reason: "Standard intake" },
      { name: "Execute ethical audit", assigned_agent_id: "threat_detector", is_legal: true, legality_reason: "Governance pass" }
    ];

    try {
      // 1. Save to frontend SQLite database
      await saveMission(missionId, missionDescription.trim(), "General Operations", "Low", 85, steps, []);

      // 2. Dispatch to nexus-backend (saves to nexus.db)
      await createNexusMission(missionDescription.trim());

      // 3. Store snapshot
      window.sessionStorage.setItem(MISSION_SNAPSHOT_KEY, JSON.stringify({
        missionId,
        missionDescription: missionDescription.trim(),
        launchedAt: new Date().toISOString(),
      }));

      setTimeout(() => {
        router.push("/history");
      }, 800);
    } catch (err) {
      console.error("Failed to initialise mission:", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 md:py-24 px-6">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
        <div className="mb-12">
          <p className="font-body font-semibold text-[11px] tracking-[0.3em] text-ink/40 uppercase mb-4">Mission Definition</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-ink">What do you want to accomplish?</h1>
        </div>

        <div className="relative group">
          <Textarea 
            placeholder="Describe your goal in plain language... e.g. Research competitors in the AI agent space."
            value={missionDescription}
            onChange={(e) => setMissionDescription(e.target.value)}
            className="min-h-[240px] bg-surface/60 border-ink/10 rounded-2xl p-8 text-xl font-body text-ink placeholder:text-ink/40 focus:border-ink/20 transition-all outline-none"
          />
        </div>

        {missionDescription.length > 20 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 rounded-xl border border-ink/10 bg-ink/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="h-4 w-4 text-ink" />
              <p className="text-sm font-body text-ink/55">AI will decompose this into autonomous agent steps.</p>
            </div>
          </motion.div>
        )}

        <div className="mt-16 pt-16 border-t border-ink/5 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex flex-wrap gap-3">
            {[
              { icon: Globe, label: "Web Intelligence" },
              { icon: Shield, label: "Governance Audit" },
              { icon: Code, label: "Logic Synthesis" },
              { icon: Terminal, label: "System Execution" },
            ].map((cap, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-ink/10 bg-ink/5 text-xs text-ink/55">
                <cap.icon className="h-3.5 w-3.5" />
                {cap.label}
              </div>
            ))}
          </div>

          <Button 
            onClick={handleInitialiseMission}
            disabled={missionDescription.trim().length < 5 || isSubmitting} 
            className="nexus-button min-w-[200px]"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Initialising...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text">Initialise Mission</span>
                <Send className="h-4 w-4" />
              </div>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
