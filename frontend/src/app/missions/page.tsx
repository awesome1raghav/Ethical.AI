"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Activity, 
  Target, 
  Plus,
  Filter,
  RefreshCw,
  Fingerprint,
  Trash2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { getMissionsHistory, deleteMission, type MissionRecord } from "@/app/actions/db-actions";

const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    running: "bg-ink/10 text-ink border-ink/20",
    analyzing: "bg-ink/5 text-ink/80 border-ink/10",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    queued: "bg-surface/40 text-ink/45 border-ink/5",
  };
  const key = status?.toLowerCase() || 'queued';
  return (
    <div className={cn("px-2 py-0.5 rounded-md border text-[9px] font-mono tracking-[0.15em] uppercase flex items-center gap-1.5", styles[key] || styles.queued)}>
      {key === "running" && <div className="h-1 w-1 rounded-full bg-ink animate-pulse" />}
      {status}
    </div>
  );
};

export default function ActiveMissionsPage() {
  const [missions, setMissions] = useState<MissionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

  const loadMissions = async () => {
    setLoading(true);
    try {
      const data = await getMissionsHistory();
      setMissions(data);
      if (data.length > 0) {
        setSelectedMissionId(data[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch active missions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMissions();
  }, []);

  const selectedMission = missions.find((m) => m.id === selectedMissionId) || missions[0];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-full lg:w-[72%] overflow-y-auto px-6 md:px-10 py-10 scrollbar-hide flex flex-col">
        <header className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 gap-6">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-[0.4em] text-ink/45 uppercase block mb-2">Operational Hub</span>
            <h1 className="text-3xl font-display font-bold tracking-tight text-ink mb-1">Active Missions</h1>
            <p className="text-[13px] text-ink/55 font-body">Synced live with SQLite SQLite storage</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button 
              onClick={loadMissions}
              variant="ghost" 
              className="h-9 px-4 border border-ink/5 bg-surface/40 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-ink/5"
            >
              <RefreshCw className={cn("h-3 w-3 mr-2", loading && "animate-spin")} /> Refresh
            </Button>
            <Link href="/">
              <Button className="h-9 bg-ink hover:bg-ink/90 text-brand-ink text-[10px] font-mono font-bold uppercase tracking-widest px-5 rounded-lg">
                <Plus className="h-3.5 w-3.5 mr-2" /> New Mission
              </Button>
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 text-ink/40 animate-spin" />
            <span className="text-[13px] font-mono text-ink/55">Querying SQLite Database...</span>
          </div>
        ) : missions.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-ink/10 rounded-2xl p-8">
            <p className="text-[14px] text-ink/60 font-body mb-4">No active or past missions in database.</p>
            <Link href="/">
              <Button className="bg-ink text-brand-ink font-bold px-6">Launch Mission</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission, i) => (
              <motion.div 
                key={mission.id} 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.05 }} 
                onClick={() => setSelectedMissionId(mission.id)} 
                className={cn(
                  "p-6 rounded-[20px] border transition-all cursor-pointer group relative overflow-hidden", 
                  selectedMissionId === mission.id ? "bg-ink/[0.03] border-ink/10" : "bg-surface border-ink/5 hover:border-ink/10"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono text-ink/45 uppercase tracking-[0.2em] font-bold">{mission.id}</span>
                  <StatusBadge status={mission.status} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                  <div className="md:col-span-5">
                    <h3 className="text-xl font-display font-bold text-ink mb-1">{mission.primary_intent}</h3>
                    <p className="text-[13px] text-ink/55 font-body line-clamp-1">{mission.description}</p>
                  </div>
                  <div className="md:col-span-4 flex flex-col justify-center">
                    <div className="flex justify-between text-[10px] font-mono text-ink/55 mb-1.5">
                      <span>Progress</span>
                      <span>{mission.completed_steps || 0} / {mission.step_count || 1} Steps</span>
                    </div>
                    <div className="h-[2px] w-full bg-ink/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }} 
                        animate={{ width: `${Math.round(((mission.completed_steps || 0) / (mission.step_count || 1)) * 100)}%` }} 
                        className="h-full bg-ink shadow-[0_0_8px_white]" 
                      />
                    </div>
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <Link href="/execution">
                      <Button variant="outline" className="h-8 border-ink/5 bg-ink/5 text-[10px] font-mono font-bold uppercase flex items-center gap-1.5">
                        <span>Inspect</span>
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <aside className="hidden lg:flex w-[28%] border-l border-ink/5 bg-surface p-8 flex-col h-full overflow-hidden">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-ink/45">Execution Stream</h3>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-ink/[0.03] border border-ink/5">
              <Activity className="h-3 w-3 text-ink animate-pulse" />
              <span className="text-[9px] font-mono text-ink uppercase font-bold">Live</span>
            </div>
          </div>
        </header>

        {selectedMission ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-ink/[0.02] border border-ink/5">
              <span className="text-[9px] font-mono text-ink/45 uppercase block mb-1">Selected Mission</span>
              <h4 className="text-[15px] font-display font-bold text-ink mb-2">{selectedMission.id}</h4>
              <p className="text-[12px] font-body text-ink/55">{selectedMission.description}</p>
            </div>
            <div className="p-4 rounded-xl bg-ink/[0.02] border border-ink/5 space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-ink/55">
                <span>Risk Level</span>
                <span className="text-ink font-bold">{selectedMission.risk_level}</span>
              </div>
              <div className="flex justify-between text-[11px] font-mono text-ink/55">
                <span>Clarity Score</span>
                <span className="text-ink font-bold">{selectedMission.clarity_score}%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[12px] font-mono text-ink/45">Select a mission to view stream telemetry.</p>
        )}

        <footer className="mt-auto pt-6 border-t border-ink/5">
          <div className="flex items-center justify-between p-4 rounded-xl bg-ink/[0.03] border border-ink/5">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-ink/45 uppercase">Sovereign State</span>
              <span className="text-[11px] font-body font-bold text-ink">Database Live</span>
            </div>
            <Fingerprint className="h-4 w-4 text-ink/40" />
          </div>
        </footer>
      </aside>
    </div>
  );
}
