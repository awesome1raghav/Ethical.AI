'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, MessageSquare, Rocket, ShieldAlert, ShieldCheck } from 'lucide-react';

import type { GuardrailEvent } from '@/app/actions/helix-guardrails';

const KIND_LABEL: Record<GuardrailEvent['kind'], string> = {
  check: 'Policy check',
  chat: 'Chat message',
  mission: 'Mission prompt',
};

const KIND_ICON: Record<GuardrailEvent['kind'], React.ElementType> = {
  check: ShieldCheck,
  chat: MessageSquare,
  mission: Rocket,
};

interface LiveActivityStreamProps {
  events: GuardrailEvent[] | null;
}

/** Recent guardrail decisions reported by the Helix service, newest first. */
export const LiveActivityStream: React.FC<LiveActivityStreamProps> = ({ events }) => {
  return (
    <div className="flex flex-col h-full bg-surface rounded-2xl border border-ink/5 p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <span className={`w-2 h-2 rounded-full ${events ? 'bg-ink/70 animate-pulse' : 'bg-red-400'}`} />
        <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-ink">Live Activity</h3>
      </div>

      <div className="flex-grow overflow-y-auto scrollbar-hide pr-2">
        {events === null && (
          <p className="text-sm text-ink/50">Helix service is offline. Start nexus-backend to see live decisions.</p>
        )}
        {events?.length === 0 && (
          <p className="text-sm text-ink/50">
            No decisions yet. Send a chat message, launch a mission, or run the simulator.
          </p>
        )}

        <AnimatePresence initial={false}>
          {events?.map((event) => {
            const KindIcon = KIND_ICON[event.kind];
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="mb-3 last:mb-0"
              >
                <div className="flex gap-3 items-start p-3 rounded-lg bg-ink/[0.01] border border-transparent hover:border-ink/5">
                  <div className="mt-0.5">
                    {event.blocked ? (
                      <ShieldAlert className="w-4 h-4 text-red-400" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-ink/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink/80 leading-snug break-words">{event.excerpt}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-wider text-ink/45">
                      <KindIcon className="w-3 h-3" />
                      <span>{KIND_LABEL[event.kind]}</span>
                      <span>·</span>
                      <span className={event.blocked ? 'text-red-400' : ''}>
                        {event.blocked ? `Blocked by ${event.rail}` : 'Allowed'}
                      </span>
                      <span>·</span>
                      <span>{(event.latency_ms / 1000).toFixed(1)}s</span>
                      <span>·</span>
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
