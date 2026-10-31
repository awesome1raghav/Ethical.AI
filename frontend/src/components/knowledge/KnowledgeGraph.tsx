import React from 'react';
import { motion } from 'framer-motion';

export const KnowledgeGraph: React.FC = () => {
  return (
    <div className="w-full h-[350px] bg-surface rounded-2xl border border-ink/5 relative overflow-hidden flex items-center justify-center p-8">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(hsl(var(--ink) / 0.2) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--ink) / 0.2) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }} />

      <svg width="100%" height="100%" viewBox="0 0 800 350" className="relative z-10">
        <defs>
          <filter id="glow-blue">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Connections */}
        <motion.path 
          d="M 150 175 C 250 175, 350 75, 450 75" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        <motion.path 
          d="M 150 175 C 250 175, 350 275, 450 275" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut" }}
        />
        <motion.path 
          d="M 450 75 C 550 75, 600 175, 650 175" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
        />
        <motion.path 
          d="M 450 275 C 550 275, 600 175, 650 175" 
          fill="none" stroke="hsl(var(--ink) / 0.1)" strokeWidth="2"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
        />

        {/* Animated Particles */}
        <motion.circle r="3" fill="#60a5fa" filter="url(#glow-blue)">
          <animateMotion dur="4s" repeatCount="indefinite" path="M 150 175 C 250 175, 350 75, 450 75" />
        </motion.circle>
        <motion.circle r="3" fill="#60a5fa" filter="url(#glow-blue)">
          <animateMotion dur="5s" repeatCount="indefinite" path="M 150 175 C 250 175, 350 275, 450 275" />
        </motion.circle>

        {/* Nodes */}
        <g transform="translate(150, 175)">
          <circle r="25" fill="#050505" stroke="hsl(var(--ink) / 0.3)" strokeWidth="1" />
          <text x="0" y="45" fill="hsl(var(--ink) / 0.7)" fontSize="11" textAnchor="middle" className="uppercase tracking-widest font-medium">Employee Handbook</text>
        </g>
        
        <g transform="translate(450, 75)">
          <circle r="20" fill="#050505" stroke="hsl(var(--ink) / 0.1)" strokeWidth="1" />
          <text x="0" y="40" fill="hsl(var(--ink) / 0.7)" fontSize="10" textAnchor="middle" className="uppercase tracking-widest">HR Policies</text>
        </g>
        
        <g transform="translate(450, 275)">
          <circle r="20" fill="#050505" stroke="hsl(var(--ink) / 0.1)" strokeWidth="1" />
          <text x="0" y="40" fill="hsl(var(--ink) / 0.7)" fontSize="10" textAnchor="middle" className="uppercase tracking-widest">Payroll Rules</text>
        </g>

        <g transform="translate(650, 175)">
          <circle r="30" fill="#050505" stroke="hsl(var(--ink) / 0.4)" strokeWidth="1.5" />
          <text x="0" y="55" fill="hsl(var(--ink) / 0.9)" fontSize="12" textAnchor="middle" className="uppercase tracking-widest font-bold">Mission Templates</text>
        </g>
      </svg>
      
      <div className="absolute bottom-4 left-4 flex gap-6 text-[10px] uppercase tracking-wider text-ink/50 bg-surface/80 p-3 rounded-lg border border-ink/10 backdrop-blur-md">
        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#60a5fa]"/> Knowledge Flow</div>
      </div>
    </div>
  );
};
