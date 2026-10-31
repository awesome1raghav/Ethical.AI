"use client";

import React from "react";
import { motion } from "framer-motion";
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
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

export const ALL_CONNECTIONS = [
  { id: "web_search",    label: "Web Search",         icon: Globe,         perm: "Read",       status: "ready"          },
  { id: "google_drive",  label: "Google Drive",        icon: HardDrive,     perm: "Read/Write", status: "disconnected"   },
  { id: "github",        label: "GitHub",              icon: Github,        perm: "Read",       status: "disconnected"   },
  { id: "notion",        label: "Notion",              icon: BookOpen,      perm: "Read",       status: "disconnected"   },
  { id: "databases",     label: "Databases",           icon: Database,      perm: "Read",       status: "disconnected"   },
  { id: "enterprise",    label: "Enterprise APIs",     icon: Wifi,          perm: "Restricted", status: "not_configured" },
  { id: "academic",      label: "Academic Research",   icon: GraduationCap, perm: "Read",       status: "ready"          },
  { id: "local_files",   label: "Local Files",         icon: FolderOpen,    perm: "Read/Write", status: "ready"          },
  { id: "cloud_storage", label: "Cloud Storage",       icon: Cloud,         perm: "Read/Write", status: "disconnected"   },
] as const;

export type ConnectionId = typeof ALL_CONNECTIONS[number]["id"];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExecutionEnvironmentPanelProps {
  connections: Record<string, boolean>;
  onToggle: (id: string) => void;
  onConfigureAll: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExecutionEnvironmentPanel: React.FC<ExecutionEnvironmentPanelProps> = ({
  connections,
  onToggle,
  onConfigureAll,
}) => {
  const activeCount = Object.values(connections).filter(Boolean).length;

  return (
    <div>
      {/* 3-column connection cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {ALL_CONNECTIONS.map((conn, idx) => {
          const Icon = conn.icon;
          const isOn = connections[conn.id] ?? false;

          return (
            <motion.button
              key={conn.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => onToggle(conn.id)}
              className={cn(
                "flex flex-col items-start gap-2 p-3 rounded-2xl border text-left transition-all duration-200 group",
                isOn
                  ? "bg-ink/[0.05] border-ink/[0.12]"
                  : "bg-ink/[0.01] border-ink/[0.05] hover:bg-ink/[0.03] hover:border-ink/[0.08]"
              )}
            >
              {/* Top row: icon + status dot */}
              <div className="flex items-center justify-between w-full">
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    isOn ? "text-ink" : "text-ink/45"
                  )}
                />
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-all duration-300",
                    isOn
                      ? "bg-ink shadow-[0_0_4px_hsl(var(--ink) / 0.6)]"
                      : conn.status === "ready"
                      ? "bg-ink/20"
                      : "bg-ink/10"
                  )}
                />
              </div>

              {/* Label */}
              <div>
                <p
                  className={cn(
                    "text-[11px] font-body font-medium leading-snug transition-colors",
                    isOn ? "text-ink" : "text-ink/55"
                  )}
                >
                  {conn.label}
                </p>
                <p className="text-[8px] font-mono text-ink/40 mt-0.5 uppercase tracking-wider">
                  {conn.perm}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeCount > 0 ? (
            <>
              <div className="h-1.5 w-1.5 rounded-full bg-ink shadow-[0_0_4px_white] animate-pulse" />
              <span className="text-[10px] font-mono text-ink uppercase tracking-wider font-bold">
                {activeCount} Active
              </span>
            </>
          ) : (
            <span className="text-[10px] font-mono text-ink/45 uppercase tracking-wider">
              No connections enabled
            </span>
          )}
        </div>

        <button
          onClick={onConfigureAll}
          className="flex items-center gap-1.5 text-[10px] font-mono text-ink/45 hover:text-ink transition-colors uppercase tracking-wider group"
        >
          <Settings2 className="h-3 w-3 group-hover:rotate-45 transition-transform duration-200" />
          Configure All
        </button>
      </div>
    </div>
  );
};
