"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Ban, Gauge, Scale, ShieldAlert, ShieldCheck, UserCheck } from "lucide-react";

import {
  getGuardrailEvents,
  getGuardrailsStatus,
  type GuardrailEvent,
  type GuardrailsStatus,
} from "@/app/actions/helix-guardrails";
import { LiveActivityStream } from "@/components/helix/LiveActivityStream";
import { PolicySimulator } from "@/components/helix/PolicySimulator";

const POLL_INTERVAL_MS = 5000;

interface EnforcedPolicy {
  name: string;
  layer: string;
  description: string;
  icon: React.ElementType;
  /** Rail name as reported in guardrail events, for live trigger counts. */
  rail?: string;
}

// The policies Helix actually enforces, in pipeline order.
const POLICIES: EnforcedPolicy[] = [
  {
    name: "Input safety rail",
    layer: "NeMo Guardrails",
    description:
      "Gemma screens every chat message and mission prompt for harm, jailbreak attempts, data exfiltration and fraud before anything runs.",
    icon: ShieldCheck,
    rail: "input:self check input",
  },
  {
    name: "Output safety rail",
    layer: "NeMo Guardrails",
    description:
      "Every chat reply is checked again before it reaches the user, blocking leaked secrets, harmful instructions and abuse.",
    icon: ShieldAlert,
    rail: "output:self check output",
  },
  {
    name: "Irreversible operation block",
    layer: "HELIX policy engine",
    description:
      "Missions containing destructive, irreversible steps (database or file deletion) are stopped before any step runs.",
    icon: Ban,
  },
  {
    name: "Human approval checkpoints",
    layer: "HELIX policy engine",
    description:
      "Steps that send messages, deploy or access credentials pause the mission at that exact step until a person approves it.",
    icon: UserCheck,
  },
  {
    name: "Risk-surface scoring",
    layer: "HELIX risk engine",
    description:
      "Mission risk is the union of what each step touches, not plan length, and model advice can only raise it, never lower it.",
    icon: Gauge,
  },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-ink/40 text-[10px] uppercase tracking-widest block mb-2">{label}</span>
      <span className="text-2xl font-mono text-ink">{value}</span>
    </div>
  );
}

export default function HelixGuardrailsPage() {
  const [status, setStatus] = useState<GuardrailsStatus | null>(null);
  const [events, setEvents] = useState<GuardrailEvent[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [nextStatus, nextEvents] = await Promise.all([getGuardrailsStatus(), getGuardrailEvents(25)]);
    setStatus(nextStatus);
    setEvents(nextEvents);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const online = status !== null;
  const stats = status?.stats;
  const triggerCount = (rail?: string) =>
    rail && events ? events.filter((e) => e.blocked && e.rail === rail).length : null;

  return (
    <div className="flex flex-col h-full w-full bg-surface text-ink overflow-hidden">
      <header className="px-10 py-6 border-b border-ink/5 bg-surface/80 backdrop-blur-xl flex justify-between items-center">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Scale className="h-5 w-5 text-ink/50" />
            <h1 className="text-sm font-mono font-bold uppercase tracking-[0.4em] text-ink">Helix Governance</h1>
          </div>
          <p className="text-ink/55 text-xs">
            NVIDIA NeMo Guardrails and deterministic policy enforcement on local {status?.model ?? "Gemma 4 12B"}.
          </p>
        </div>

        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-ink/40">Guardrails engine</span>
          <span className="text-sm font-mono text-ink flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                !loaded ? "bg-ink/20" : online ? "bg-emerald-400 animate-pulse" : "bg-red-400"
              }`}
            />
            {!loaded ? "Connecting" : online ? (status.loaded ? "Active" : "Ready (loads on first check)") : "Offline"}
          </span>
        </div>
      </header>

      <div className="flex-grow overflow-y-auto scrollbar-hide p-10">
        <div className="max-w-7xl mx-auto w-full flex flex-col xl:flex-row gap-8">
          <div className="flex-1 flex flex-col gap-8 min-w-0">
            <div className="p-8 rounded-2xl bg-ink/[0.01] border border-ink/5 grid grid-cols-2 md:grid-cols-4 gap-6">
              <Stat label="Checks run" value={stats ? stats.checks.toLocaleString() : "—"} />
              <Stat label="Blocked" value={stats ? stats.blocked.toLocaleString() : "—"} />
              <Stat label="Allowed" value={stats ? stats.allowed.toLocaleString() : "—"} />
              <Stat
                label="Avg latency"
                value={stats?.avg_latency_ms != null ? `${(stats.avg_latency_ms / 1000).toFixed(1)}s` : "—"}
              />
            </div>
            {status?.error && (
              <p className="text-sm text-red-400 -mt-4">Guardrails failed to load: {status.error}</p>
            )}

            <section>
              <h2 className="text-xl font-display mb-6 flex items-center gap-3">
                Enforced policies
                <span className="px-2 py-0.5 rounded-full bg-ink/5 text-ink/40 text-[10px] uppercase tracking-widest">
                  {POLICIES.length} active
                </span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {POLICIES.map((policy) => {
                  const Icon = policy.icon;
                  const triggered = triggerCount(policy.rail);
                  return (
                    <div key={policy.name} className="rounded-2xl stealth-glass p-5 border border-ink/5">
                      <div className="flex items-start gap-3 mb-3">
                        <Icon className="w-5 h-5 text-ink/50 mt-0.5 shrink-0" />
                        <div>
                          <h3 className="text-ink font-medium tracking-wide">{policy.name}</h3>
                          <span className="text-[10px] uppercase tracking-wider text-ink/45">{policy.layer}</span>
                        </div>
                      </div>
                      <p className="text-sm text-ink/65 leading-relaxed">{policy.description}</p>
                      {triggered !== null && (
                        <p className="mt-3 pt-3 border-t border-ink/5 text-xs text-ink/50 font-mono">
                          Blocked {triggered} of the last {events?.length ?? 0} decisions
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <PolicySimulator onChecked={refresh} />
          </div>

          <aside className="xl:w-[400px] shrink-0 xl:h-[calc(100vh-10rem)] xl:sticky xl:top-0">
            <LiveActivityStream events={events} />
          </aside>
        </div>
      </div>
    </div>
  );
}
