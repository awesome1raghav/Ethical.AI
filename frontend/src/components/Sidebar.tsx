"use client";

import React from "react";
import { motion } from "framer-motion";
import { FileText, History, Lock, MessageSquare, Scale, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Reduced nav items to match the cleaner icon-focused mockup
const topNavItems = [
  { icon: MessageSquare, label: "Chat Command", href: "/" },
  { icon: History, label: "Mission History", href: "/history" },
  { icon: Scale, label: "Helix Governance", href: "/helix" },
  { icon: Lock, label: "BLACKBOX", href: "/blackbox" },
  { icon: FileText, label: "Knowledge Base", href: "/knowledge" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-[120] w-[68px] hover:w-[240px] transition-all duration-300 ease-out bg-surface border-r border-ink/[0.06] flex flex-col group/sidebar overflow-hidden shadow-[4px_0_24px_hsl(var(--surface) / 0.5)]">
      
      {/* Brand Icon (Logo) */}
      <div className="h-[64px] flex items-center justify-start px-[22px] shrink-0 border-b border-ink/[0.06]">
        <div className="h-6 w-6 rounded-md bg-ink/[0.04] border border-ink/[0.1] flex items-center justify-center shrink-0">
          <div className="h-2.5 w-2.5 bg-ink/60 rounded-[2px]" />
        </div>
        <span className="font-display font-black text-[15px] tracking-[0.2em] text-ink ml-4 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          EthicalAI
        </span>
      </div>

      {/* Navigation Icons */}
      <nav className="flex-grow py-6 flex flex-col gap-2 px-3">
        {topNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-4 px-[14px] py-3 rounded-xl transition-all duration-200 group overflow-hidden relative",
                isActive 
                  ? "bg-ink/[0.04] text-ink" 
                  : "text-ink/45 hover:bg-ink/[0.02] hover:text-ink border border-transparent"
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0 transition-colors duration-200", isActive ? "text-ink" : "text-ink/45 group-hover:text-ink/55")} />
              <span className="font-body font-medium text-[13px] tracking-tight whitespace-nowrap opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">
                {item.label}
              </span>
              
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-ink/40 rounded-r-full" />
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
};
