"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  Bell, 
  ChevronDown,
  LayoutDashboard
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sidebar } from "@/components/Sidebar";
import { LoadingScreen } from "@/components/LoadingScreen";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  );
}

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const { isSidebarHidden } = useSidebar();
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isAppLoading) {
    return <LoadingScreen onComplete={() => setIsAppLoading(false)} />;
  }

  return (
    <div className="flex h-screen w-full bg-transparent text-ink overflow-hidden selection:bg-ink/10 relative font-body">
      
      {/* Permanent spacer so main content aligns correctly, while actual sidebar is absolute/fixed */}
      {!isSidebarHidden && <div className="w-[68px] shrink-0 h-full border-r border-ink/[0.06] hidden md:block relative z-0" />}

      {/* Hoverable Sidebar */}
      {!isSidebarHidden && <Sidebar />}

      {/* Main Workspace Column */}
      <div className="flex-grow flex flex-col relative overflow-hidden bg-transparent z-10">
        
        {/* TOPBAR */}
        <header className="h-[80px] px-6 md:px-10 flex items-center justify-between shrink-0 border-b border-transparent relative z-20">
          
          {/* Left: Workspace Selector */}
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-ink/[0.02] border border-ink/[0.05] hover:bg-ink/[0.04] transition-colors cursor-pointer group">
            <LayoutDashboard className="h-4 w-4 text-ink/45 group-hover:text-ink/55 transition-colors" />
            <span className="text-[13px] font-medium text-ink">My Workspace</span>
            <ChevronDown className="h-3.5 w-3.5 text-ink/45 ml-3" />
          </div>

          {/* Center: Logo */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-ink/[0.04] border border-ink/[0.08] flex items-center justify-center shrink-0">
              <div className="h-3.5 w-3.5 border-2 border-ink/60 rotate-45 rounded-[4px]" />
            </div>
            <span className="font-display font-bold text-[22px] tracking-tight text-ink">
              EthicalAI
            </span>
          </div>

          {/* Right: Actions & User */}
          <div className="flex items-center gap-5">
            <ThemeToggle />

            <button className="p-2.5 rounded-full hover:bg-ink/[0.05] transition-colors relative text-ink/55 hover:text-ink">
              <Bell className="h-5 w-5" />
              <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-ink border-2 border-surface" />
            </button>
            
            <div className="flex items-center gap-3 pl-5 border-l border-ink/[0.06] cursor-pointer group">
              <div className="h-9 w-9 rounded-full bg-ink/10 relative overflow-hidden border border-ink/10 group-hover:border-ink/20 transition-colors">
                <img 
                  src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=transparent" 
                  alt="User"
                  className="w-full h-full object-cover grayscale opacity-90"
                />
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-ink/80 border-2 border-surface" />
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-ink/45 group-hover:text-ink transition-colors" />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-grow overflow-y-auto relative scrollbar-hide px-6 md:px-10 pb-10">
          {children}
        </main>
      </div>
    </div>
  );
}
