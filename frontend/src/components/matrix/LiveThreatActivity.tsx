import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Activity, Terminal } from 'lucide-react';

interface ThreatEvent {
  id: string;
  message: string;
  timestamp: Date;
  type: 'critical' | 'mitigated' | 'monitoring' | 'system';
}

const SAMPLE_THREAT_EVENTS = [
  "Prompt Injection Blocked",
  "Credential Isolation Activated",
  "Sandbox Escalated",
  "Unauthorized Tool Blocked",
  "Network Request Denied",
  "Secret Exposure Prevented",
  "Runtime Isolation Enabled",
  "Behavioral Anomaly Detected",
  "Cross-Site Scripting attempt blocked in Browser Agent"
];

const getTypeForMessage = (msg: string): ThreatEvent['type'] => {
  if (msg.includes('Blocked') || msg.includes('Denied') || msg.includes('Escalated')) return 'critical';
  if (msg.includes('Prevented') || msg.includes('Isolated') || msg.includes('Activated')) return 'mitigated';
  if (msg.includes('Detected')) return 'monitoring';
  return 'system';
};

export const LiveThreatActivity: React.FC = () => {
  const [events, setEvents] = useState<ThreatEvent[]>([]);

  useEffect(() => {
    const initialEvents = SAMPLE_THREAT_EVENTS.map((msg, i) => ({
      id: `initial-${i}`,
      message: msg,
      timestamp: new Date(Date.now() - i * 45000),
      type: getTypeForMessage(msg)
    }));
    setEvents(initialEvents);
  }, []);

  const getIconAndColor = (type: ThreatEvent['type']) => {
    switch(type) {
      case 'critical': return { icon: <ShieldAlert className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20' };
      case 'mitigated': return { icon: <ShieldCheck className="w-4 h-4" />, color: 'text-green-400', bg: 'bg-green-400/10 border-green-400/20' };
      case 'monitoring': return { icon: <Activity className="w-4 h-4" />, color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20' };
      default: return { icon: <Terminal className="w-4 h-4" />, color: 'text-ink/50', bg: 'bg-ink/5 border-ink/10' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface rounded-2xl border border-ink/5 p-5 relative overflow-hidden">
      {/* Background Pulse */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/[0.03] rounded-full blur-3xl animate-pulse" />

      <div className="flex items-center gap-2 mb-6">
        <h3 className="text-sm font-mono font-bold uppercase tracking-widest text-ink">Recent Threat Activity</h3>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-ink/5 text-ink/45 text-[9px] uppercase tracking-widest">Sample data</span>
      </div>

      <div className="flex-grow overflow-y-auto scrollbar-hide pr-2 relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-ink/5 z-0" />
        
        <AnimatePresence>
          {events.map((event) => {
            const { icon, color, bg } = getIconAndColor(event.type);
            
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="mb-4 last:mb-0 relative z-10"
              >
                <div className={`flex gap-3 items-center p-3 rounded-lg border ${bg} transition-colors backdrop-blur-sm`}>
                  <div className={`${color}`}>
                    {icon}
                  </div>
                  <div className="flex-1 flex justify-between items-center">
                    <p className={`text-sm ${color} leading-snug font-medium`}>{event.message}</p>
                    <span className="text-[10px] text-ink/40 uppercase tracking-wider">
                      {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
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
