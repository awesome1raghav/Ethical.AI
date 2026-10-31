"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  HardDrive,
  Github,
  BookOpen,
  Database,
  Wifi,
  GraduationCap,
  FolderOpen,
  Cloud,
  X,
  Search,
  Clock,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_CONNECTIONS } from "./ExecutionEnvironmentPanel";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  ready: "Ready",
  disconnected: "Not Connected",
  not_configured: "Not Configured",
};

const STATUS_DOT: Record<string, string> = {
  ready: "bg-ink/60",
  disconnected: "bg-ink/20",
  not_configured: "bg-ink/10",
};

// Full connection data with extra fields
const FULL_CONNECTIONS = [
  ...ALL_CONNECTIONS.map((c) => ({
    ...c,
    lastConnected:
      c.status === "ready" ? "Always available" :
      c.status === "disconnected" ? "Never connected" :
      "Requires setup",
    description:
      c.id === "web_search" ? "Access real-time web data and news" :
      c.id === "google_drive" ? "Read and write files in your Drive" :
      c.id === "github" ? "Read repositories, issues, PRs" :
      c.id === "notion" ? "Access your Notion workspace" :
      c.id === "databases" ? "Query your SQL or NoSQL databases" :
      c.id === "enterprise" ? "Access internal enterprise APIs" :
      c.id === "academic" ? "Access academic journals and papers" :
      c.id === "local_files" ? "Upload and read local files" :
      "Access cloud file storage",
    isFavorite: c.id === "web_search" || c.id === "academic",
    isRecent: c.id === "web_search" || c.id === "local_files",
  })),
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExecutionEnvironmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  connections: Record<string, boolean>;
  onToggle: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExecutionEnvironmentModal: React.FC<ExecutionEnvironmentModalProps> = ({
  isOpen,
  onClose,
  connections,
  onToggle,
}) => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "recent">("all");

  const activeCount = Object.values(connections).filter(Boolean).length;

  const filtered = FULL_CONNECTIONS.filter((c) => {
    const matchesSearch = c.label.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === "active") return connections[c.id];
    if (activeTab === "recent") return c.isRecent || connections[c.id];
    return true;
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 z-[150] bg-surface/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed z-[160] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] max-w-[94vw] bg-surface border border-ink/[0.08] rounded-[28px] overflow-hidden shadow-[0_48px_120px_hsl(var(--surface) / 0.85)]"
          >
            {/* Header */}
            <div className="px-8 py-6 border-b border-ink/[0.06] flex items-start justify-between">
              <div>
                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.45em] text-ink/45 mb-1.5">
                  Execution Environment
                </p>
                <h3 className="text-[18px] font-display font-bold text-ink leading-tight">
                  Connections &amp; Integrations
                </h3>
                <p className="text-[12px] text-ink/45 font-body mt-1">
                  Configure which data sources your AI agents can access
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-ink/[0.05] rounded-xl text-ink/45 hover:text-ink transition-colors mt-1 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search + Tabs */}
            <div className="px-8 py-4 border-b border-ink/[0.04] space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/45" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search connections..."
                  className="w-full bg-ink/[0.03] border border-ink/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-[13px] font-body text-ink placeholder:text-ink/40 outline-none focus:border-ink/20 transition-colors"
                />
              </div>
              <div className="flex gap-1">
                {(["all", "active", "recent"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all",
                      activeTab === tab
                        ? "bg-ink/[0.08] text-ink border border-ink/10"
                        : "text-ink/45 hover:text-ink"
                    )}
                  >
                    {tab === "active" ? `Active (${activeCount})` : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Connections List */}
            <div className="max-h-[380px] overflow-y-auto scrollbar-hide py-3 px-4">
              {filtered.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-ink/45">
                  <p className="text-[12px] font-mono">No connections found</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filtered.map((conn) => {
                    const Icon = conn.icon;
                    const isOn = connections[conn.id] ?? false;

                    return (
                      <div
                        key={conn.id}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3.5 rounded-2xl border transition-all duration-200",
                          isOn
                            ? "bg-ink/[0.04] border-ink/[0.10]"
                            : "bg-ink/[0.01] border-ink/[0.04] hover:bg-ink/[0.03] hover:border-ink/[0.07]"
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl border flex items-center justify-center shrink-0 transition-all",
                            isOn
                              ? "bg-ink/[0.06] border-ink/[0.12]"
                              : "bg-ink/[0.02] border-ink/[0.06]"
                          )}
                        >
                          <Icon className={cn("h-4 w-4 transition-colors", isOn ? "text-ink" : "text-ink/45")} />
                        </div>

                        {/* Info */}
                        <div className="flex-grow min-w-0">
                          <div className="flex items-center gap-2.5 mb-0.5">
                            <span className={cn("text-[13px] font-body font-medium transition-colors", isOn ? "text-ink" : "text-ink/55")}>
                              {conn.label}
                            </span>
                            {conn.isFavorite && <Star className="h-2.5 w-2.5 text-ink/40 fill-ink/40" />}
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", STATUS_DOT[conn.status])} />
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[9px] font-mono text-ink/40 uppercase tracking-wider">
                              {conn.perm}
                            </span>
                            <span className="text-[9px] font-mono text-ink/35">
                              {conn.lastConnected}
                            </span>
                          </div>
                        </div>

                        {/* Toggle pill */}
                        <button
                          onClick={() => onToggle(conn.id)}
                          className={cn(
                            "h-5 w-10 rounded-full p-0.5 transition-colors duration-200 relative shrink-0",
                            isOn ? "bg-ink" : "bg-ink/[0.08]"
                          )}
                          aria-label={`Toggle ${conn.label}`}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-full shadow transition-all duration-200",
                              isOn ? "translate-x-5 bg-brand-ink" : "bg-ink/30"
                            )}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-ink/[0.06] flex items-center justify-between bg-surface/20">
              <div className="flex items-center gap-2.5">
                {activeCount > 0 ? (
                  <>
                    <div className="h-1.5 w-1.5 rounded-full bg-ink shadow-[0_0_6px_white] animate-pulse" />
                    <span className="text-[10px] font-mono text-ink uppercase tracking-widest font-bold">
                      {activeCount} {activeCount === 1 ? "Connection" : "Connections"} Active
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-mono text-ink/45 uppercase tracking-widest">
                    No connections active
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-ink/[0.06] border border-ink/[0.08] text-[11px] font-mono font-bold uppercase tracking-wider text-ink hover:bg-ink/10 transition-colors"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
