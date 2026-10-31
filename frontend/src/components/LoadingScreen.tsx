"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingScreenProps {
  onComplete: () => void;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const text = "EthicalAI";

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 3500);

    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 0.8));
    }, 20);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface overflow-hidden"
    >
      <div className="relative flex flex-col items-center">
        <div className="flex space-x-[2px] mb-8">
          {text.split("").map((char, index) => (
            <motion.span
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.2 + index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-4xl md:text-5xl font-display font-bold tracking-tighter text-ink"
            >
              {char}
            </motion.span>
          ))}
        </div>

        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 180 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="h-[1px] bg-ink/5 relative overflow-hidden"
        >
          <motion.div
            initial={{ left: "-100%" }}
            animate={{ left: `${progress - 100}%` }}
            className="absolute top-0 bottom-0 w-full bg-ink/60"
          />
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 2.2, duration: 1 }}
          className="mt-6 font-mono text-[10px] tracking-[0.2em] text-ink/55 uppercase"
        >
          System Initializing
        </motion.p>
      </div>

      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,hsl(var(--ink) / 0.02)_0%,transparent_100%)]" />
    </motion.div>
  );
};