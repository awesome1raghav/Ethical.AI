"use client";

import React, { useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useVoiceInput } from "./useVoiceInput";
import { useToast } from "@/hooks/use-toast";

interface VoiceInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function VoiceInput({ value, onChange, className }: VoiceInputProps) {
  const { toast } = useToast();

  const handlePermissionDenied = () => {
    toast({
      title: "Microphone Access Denied",
      description: "Microphone permission denied. Please allow microphone access in your browser settings.",
      variant: "destructive",
    });
  };

  const handleUnsupported = () => {
    toast({
      title: "Unsupported Browser",
      description: "Voice recognition isn't supported in this browser.",
      variant: "destructive",
    });
  };

  const { listening, toggleListening, isSupported, error } = useVoiceInput(
    value,
    onChange,
    handlePermissionDenied,
    handleUnsupported
  );

  // Trigger error toast if an error appears that isn't handled by the callbacks
  useEffect(() => {
    if (error && error !== 'Permission denied' && error !== 'Unsupported browser') {
      toast({
        title: "Voice Input Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (!isSupported) {
    return (
      <div title="Voice recognition is not supported in this browser." className={cn("relative", className)}>
        <button 
          disabled 
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-ink/[0.02] border border-ink/[0.04] text-ink/55 opacity-50 cursor-not-allowed"
        >
          <MicOff className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <AnimatePresence>
        {listening && (
          <>
            {/* Outer Glow Pulse */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1] }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-lg bg-emerald-500/30 blur-md pointer-events-none"
            />
            {/* Inner Ring */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: [1, 1.05, 1] }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-lg border border-emerald-500/50 pointer-events-none"
            />
          </>
        )}
      </AnimatePresence>

      <button
        onClick={toggleListening}
        title={listening ? "Stop listening" : "Start voice input"}
        className={cn(
          "h-9 w-9 flex items-center justify-center rounded-lg border transition-all z-10 relative",
          listening
            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            : "bg-ink/[0.02] border-ink/[0.04] hover:bg-ink/[0.04] text-ink/55 hover:text-ink"
        )}
      >
        <Mic className="h-4 w-4" />
      </button>
    </div>
  );
}
