import React from 'react';
import { motion } from 'framer-motion';

export const SecurityGraph: React.FC = () => {
  return (
    <div className="w-full h-[450px] bg-surface rounded-2xl border border-ink/5 relative overflow-hidden flex items-center justify-center p-8">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(hsl(var(--ink) / 0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--ink) / 0.2) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      <svg width="100%" height="100%" viewBox="0 0 900 450" className="relative z-10">
        <defs>
          <filter id="glow-blue">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="glow-green">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Connections */}
        <motion.path 
          d="M 100 225 C 200 225, 250 150, 350 150" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        <motion.path 
          d="M 350 150 C 450 150, 500 225, 600 225" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.path 
          d="M 600 225 C 700 225, 750 225, 800 225" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2" strokeDasharray="5,5"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 1 }}
        />

        <motion.path 
          d="M 100 225 C 200 225, 250 300, 350 300" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        <motion.path 
          d="M 350 300 C 450 300, 500 225, 600 225" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
        />

        {/* Animated Particles */}
        <motion.circle r="3" fill="#60a5fa" filter="url(#glow-blue)">
          <animateMotion dur="4s" repeatCount="indefinite" path="M 100 225 C 200 225, 250 150, 350 150" />
        </motion.circle>
        <motion.circle r="3" fill="#60a5fa" filter="url(#glow-blue)">
          <animateMotion dur="4s" repeatCount="indefinite" path="M 350 150 C 450 150, 500 225, 600 225" />
        </motion.circle>

        <motion.circle r="3" fill="#4ade80" filter="url(#glow-green)">
          <animateMotion dur="5s" repeatCount="indefinite" path="M 100 225 C 200 225, 250 300, 350 300" />
        </motion.circle>
        
        {/* Nodes */}
        <g transform="translate(100, 225)">
          <circle r="25" fill="#050505" stroke="hsl(var(--ink) / 0.3)" strokeWidth="1" />
          <text x="0" y="45" fill="hsl(var(--ink) / 0.7)" fontSize="11" textAnchor="middle" className="uppercase tracking-widest font-medium">Browser Agent</text>
        </g>
        
        <g transform="translate(350, 150)">
          <circle r="20" fill="#050505" stroke="#60a5fa" strokeWidth="1" />
          <text x="0" y="40" fill="hsl(var(--ink) / 0.7)" fontSize="10" textAnchor="middle" className="uppercase tracking-widest">Secrets Policy</text>
        </g>
        
        <g transform="translate(350, 300)">
          <circle r="20" fill="#050505" stroke="#4ade80" strokeWidth="1" />
          <text x="0" y="40" fill="hsl(var(--ink) / 0.7)" fontSize="10" textAnchor="middle" className="uppercase tracking-widest">Network Restrictions</text>
        </g>

        <g transform="translate(600, 225)">
          <circle r="35" fill="#050505" stroke="hsl(var(--ink) / 0.4)" strokeWidth="1.5" />
          <text x="0" y="55" fill="hsl(var(--ink) / 0.9)" fontSize="12" textAnchor="middle" className="uppercase tracking-widest font-bold">Sandbox</text>
        </g>
        
        <g transform="translate(800, 225)" className="cursor-pointer">
          <rect x="-35" y="-35" width="70" height="70" rx="8" fill="#111" stroke="hsl(var(--ink) / 0.6)" strokeWidth="1" />
          <text x="0" y="55" fill="hsl(var(--ink) / 0.8)" fontSize="10" textAnchor="middle" className="uppercase tracking-widest font-medium">Black Box</text>
          <text x="0" y="-10" fill="hsl(var(--ink) / 0.3)" fontSize="8" textAnchor="middle" className="uppercase tracking-widest">Isolation</text>
          <circle cx="0" cy="8" r="4" fill="#ef4444" opacity="0.8" />
        </g>
      </svg>
      
      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 flex gap-6 text-[10px] uppercase tracking-wider text-ink/50 bg-surface/80 p-3 rounded-lg border border-ink/10 backdrop-blur-md">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#60a5fa]"/> Analysis Flow</div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#4ade80]"/> Mitigation Flow</div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#ef4444]"/> Isolated</div>
      </div>
    </div>
  );
};
