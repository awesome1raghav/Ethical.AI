"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useSidebar } from "@/context/SidebarContext";
import { 
  User, Sparkles, Bell, Layout, Database, 
  ShieldCheck, Keyboard, Cpu, RefreshCw, 
  ChevronRight, Check, Monitor, ShieldAlert, Key, Loader2, ArrowRight
} from "lucide-react";

// ── UI COMPONENTS ──────────────────────────────────────────────────────────

function SectionTitle({ title, description, icon: Icon }: { title: string, description: string, icon: any }) {
  return (
    <div className="mb-8 border-b border-ink/[0.04] pb-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 w-8 rounded-lg bg-ink/[0.02] border border-ink/[0.05] flex items-center justify-center shrink-0">
          <Icon size={16} className="text-ink/60" />
        </div>
        <h2 className="text-[18px] font-medium text-ink">{title}</h2>
      </div>
      <p className="text-[13px] font-body text-ink/40 pl-11">{description}</p>
    </div>
  );
}

function Toggle({ label, description, defaultOn = false }: { label: string, description?: string, defaultOn?: boolean }) {
  const [isOn, setIsOn] = useState(defaultOn);
  return (
    <div className="flex items-start justify-between py-4 group cursor-pointer" onClick={() => setIsOn(!isOn)}>
      <div>
        <h4 className="text-[13px] font-medium text-ink/90 group-hover:text-ink transition-colors">{label}</h4>
        {description && <p className="text-[11px] text-ink/40 mt-1">{description}</p>}
      </div>
      <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ease-in-out shrink-0 ml-4 ${isOn ? 'bg-ink' : 'bg-ink/10'}`}>
        <motion.div 
          layout
          className={`w-4 h-4 rounded-full shadow-sm ${isOn ? 'bg-brand-ink' : 'bg-ink/40'}`}
          animate={{ x: isOn ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </div>
    </div>
  );
}

function Select({ label, options, defaultValue }: { label: string, options: string[], defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="py-4">
      <h4 className="text-[13px] font-medium text-ink/90 mb-3">{label}</h4>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => setValue(opt)}
            className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
              value === opt 
                ? 'bg-ink text-brand-ink shadow-[0_0_15px_hsl(var(--ink) / 0.1)]' 
                : 'bg-ink/[0.02] text-ink/50 border border-ink/[0.05] hover:bg-ink/[0.06] hover:text-ink/90'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function Input({ label, value, type = "text" }: { label: string, value: string, type?: string }) {
  return (
    <div className="py-3">
      <h4 className="text-[11px] font-mono uppercase tracking-widest text-ink/40 mb-2 pl-1">{label}</h4>
      <input 
        type={type} 
        defaultValue={value}
        className="w-full bg-surface border border-ink/[0.05] rounded-xl px-4 py-3 text-[13px] font-body text-ink focus:outline-none focus:border-ink/20 transition-colors"
      />
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────

export default function SettingsDashboard() {
  const { setSidebarHidden } = useSidebar();
  const [activeSection, setActiveSection] = useState('profile');

  useEffect(() => {
    setSidebarHidden(false);
  }, [setSidebarHidden]);

  // Scroll Spy Logic
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      // Find the first intersecting section
      const visibleSection = entries.find(entry => entry.isIntersecting);
      if (visibleSection) {
        setActiveSection(visibleSection.target.id);
      }
    }, { rootMargin: '-10% 0px -80% 0px' });

    const sectionElements = document.querySelectorAll('section[id]');
    sectionElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  const sections = [
    { id: 'profile', label: 'Personal Profile', icon: User },
    { id: 'ai', label: 'AI Experience', icon: Sparkles },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'workspace', label: 'Workspace Experience', icon: Layout },
    { id: 'memory', label: 'Workspace Memory', icon: Database },
    { id: 'privacy', label: 'Privacy & Security', icon: ShieldCheck },
    { id: 'keyboard', label: 'Keyboard & Productivity', icon: Keyboard },
    { id: 'system', label: 'System Information', icon: Cpu },
    { id: 'reset', label: 'Reset & Export', icon: RefreshCw },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex h-full w-full bg-surface text-ink overflow-hidden">
      
      {/* ── LEFT NAV ── */}
      <div className="w-[300px] h-full flex flex-col border-r border-ink/[0.04] bg-surface shrink-0 pt-8">
        <div className="px-8 mb-8">
          <h1 className="text-[20px] font-display font-medium text-ink tracking-tight">System Preferences</h1>
          <p className="text-[12px] font-mono text-ink/30 mt-2">Personal Control Center</p>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 space-y-1 pb-10 scrollbar-hide">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-[13px] font-medium transition-all ${
                activeSection === s.id 
                  ? 'bg-ink/[0.04] text-ink border border-ink/[0.08]' 
                  : 'text-ink/40 hover:bg-ink/[0.02] hover:text-ink/80 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                <s.icon size={16} className={activeSection === s.id ? "text-ink" : "opacity-60"} />
                {s.label}
              </div>
              {activeSection === s.id && <ChevronRight size={14} className="opacity-50" />}
            </button>
          ))}
        </nav>
      </div>

      {/* ── MAIN SCROLL AREA ── */}
      <div className="flex-1 overflow-y-auto bg-surface scrollbar-hide relative pb-32">
        <div className="max-w-3xl mx-auto px-12 pt-16 space-y-24">
          
          {/* PROFILE */}
          <section id="profile" className="scroll-mt-16">
            <SectionTitle title="Personal Profile" description="Manage your identity workspace and trusted sessions." icon={User} />
            
            <div className="flex items-center gap-6 mb-8">
              <div className="h-24 w-24 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center overflow-hidden shrink-0">
                <User size={40} className="text-ink/20" />
              </div>
              <div>
                <button className="px-4 py-2 rounded-lg bg-ink/5 hover:bg-ink/10 text-[12px] font-medium text-ink transition-colors border border-ink/[0.05]">
                  Change Photo
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-8">
              <Input label="Full Name" value="Alex Mercer" />
              <Input label="Email Address" value="alex.m@ethicalai.corp" type="email" />
              <Input label="Organization" value="EthicalAI Enterprise" />
              <Input label="Department" value="Intelligence Architecture" />
              <Input label="Team" value="Core Routing" />
              <Input label="Role" value="Senior Staff AI Engineer" />
            </div>

            <div className="bg-surface border border-ink/[0.04] rounded-2xl p-6">
              <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-6">Session Management</h3>
              
              <div className="flex items-center justify-between py-3 border-b border-ink/[0.04]">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Monitor size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-medium text-ink">Current Session</h4>
                    <p className="text-[11px] text-ink/40 mt-0.5">MacBook Pro 16" • San Francisco, CA</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono text-emerald-400">Active Now</span>
              </div>
              
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-ink/5 border border-ink/10 flex items-center justify-center">
                    <Monitor size={16} className="text-ink/40" />
                  </div>
                  <div>
                    <h4 className="text-[13px] font-medium text-ink">Nexus OS Workstation</h4>
                    <p className="text-[11px] text-ink/40 mt-0.5">Windows 11 • New York, NY</p>
                  </div>
                </div>
                <button className="text-[11px] font-medium text-ink/40 hover:text-ink transition-colors px-3 py-1.5 rounded-lg border border-ink/10 hover:bg-ink/5">
                  Terminate
                </button>
              </div>

              <div className="mt-6 flex justify-end">
                <button className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors px-4 py-2 rounded-lg border border-red-500/20 hover:bg-red-500/10">
                  Terminate All Other Sessions
                </button>
              </div>
            </div>
          </section>

          {/* AI EXPERIENCE */}
          <section id="ai" className="scroll-mt-16">
            <SectionTitle title="AI Experience" description="Personalize how EthicalAI communicates and structures information for you." icon={Sparkles} />
            
            <div className="space-y-2 mb-8 border-b border-ink/[0.04] pb-6">
              <Select label="Preferred Response Style" options={["Executive", "Technical", "Conversational", "Concise"]} defaultValue="Technical" />
              <Select label="Preferred Detail Level" options={["Brief", "Standard", "Detailed"]} defaultValue="Detailed" />
              <Select label="Preferred Mission Output" options={["Executive Report", "Technical Report", "Conversation", "Presentation"]} defaultValue="Technical Report" />
            </div>

            <div className="space-y-1">
              <Toggle label="Stream Responses" description="Show AI generation in real-time" defaultOn={true} />
              <Toggle label="Auto Continue Long Responses" description="Automatically generate the next segment if output limits are reached" defaultOn={true} />
              <Toggle label="Suggest Follow-up Questions" description="AI will proactively offer relevant follow-ups based on context" defaultOn={true} />
            </div>
          </section>

          {/* NOTIFICATIONS */}
          <section id="notifications" className="scroll-mt-16">
            <SectionTitle title="Notifications" description="Granular control over system alerts and intelligence summaries." icon={Bell} />
            
            <div className="bg-surface border border-ink/[0.04] rounded-2xl p-6 mb-8">
              <h3 className="text-[12px] font-mono uppercase tracking-widest text-ink/40 mb-6">Delivery Channels</h3>
              <div className="flex gap-4">
                <Toggle label="In-App" defaultOn={true} />
                <Toggle label="Email" defaultOn={false} />
                <Toggle label="Browser Push" defaultOn={true} />
              </div>
            </div>

            <div className="space-y-1">
              <Toggle label="Mission Completed" defaultOn={true} />
              <Toggle label="Mission Failed" defaultOn={true} />
              <Toggle label="Human Approval Required" description="When an agent encounters an ethical or security boundary" defaultOn={true} />
              <Toggle label="Mission Shared" defaultOn={true} />
              <Toggle label="Knowledge Updated" description="When enterprise context shifts materially" defaultOn={false} />
              <Toggle label="Governance Review Requested" defaultOn={true} />
              <Toggle label="Security Review Requested" defaultOn={true} />
              <Toggle label="Weekly Intelligence Summary" defaultOn={false} />
              <Toggle label="Product Updates" defaultOn={false} />
            </div>
          </section>

          {/* WORKSPACE EXPERIENCE */}
          <section id="workspace" className="scroll-mt-16">
            <SectionTitle title="Workspace Experience" description="Interface customization strictly conforming to the monochrome OS design system." icon={Layout} />
            
            <div className="space-y-2 mb-8 border-b border-ink/[0.04] pb-6">
              <Select label="Theme" options={["Dark", "Light", "Follow System"]} defaultValue="Dark" />
              <Select label="Motion Intensity" options={["Full", "Reduced", "Minimal"]} defaultValue="Full" />
              <Select label="Compact Density" options={["Standard", "Compact", "Comfortable"]} defaultValue="Standard" />
              <Select label="Font Scale" options={["Small", "Medium", "Large"]} defaultValue="Medium" />
            </div>

            <div className="space-y-1">
              <Toggle label="High Contrast Mode" description="Increases border visibility and text contrast" defaultOn={false} />
              <Toggle label="Sidebar Auto-Collapse" description="Collapse side panel when not hovering" defaultOn={false} />
              <Toggle label="Use 24-Hour Time Format" defaultOn={false} />
            </div>
          </section>

          {/* WORKSPACE MEMORY */}
          <section id="memory" className="scroll-mt-16">
            <SectionTitle title="Workspace Memory" description="Persistent behavior to seamlessly continue your work." icon={Database} />
            
            <div className="space-y-1">
              <Toggle label="Remember Last Dashboard" description="Boot directly into the last active view" defaultOn={true} />
              <Toggle label="Remember Last Mission" description="Preserve mission context across reloads" defaultOn={true} />
              <Toggle label="Remember Sidebar State" defaultOn={true} />
              <Toggle label="Remember Inspector Panels" defaultOn={true} />
              <Toggle label="Remember Search Filters" defaultOn={false} />
              <Toggle label="Remember Graph Zoom Level" defaultOn={true} />
              <Toggle label="Remember Prompt Drafts" description="Auto-save incomplete prompts to local storage" defaultOn={true} />
            </div>
          </section>

          {/* PRIVACY & SECURITY */}
          <section id="privacy" className="scroll-mt-16">
            <SectionTitle title="Privacy & Security" description="Personal privacy controls and data management." icon={ShieldCheck} />
            
            <div className="space-y-1 mb-8 border-b border-ink/[0.04] pb-6">
              <Toggle label="Usage Analytics" description="Help improve EthicalAI by sharing anonymous telemetry" defaultOn={false} />
              <Toggle label="Crash Reports" description="Automatically send diagnostics on fatal errors" defaultOn={true} />
              <Toggle label="Activity Visibility" description="Allow team members to see your active status" defaultOn={false} />
              <Toggle label="Security Notifications" description="Alerts for logins from unknown IP addresses" defaultOn={true} />
            </div>

            <div className="flex gap-4">
              <button className="flex-1 px-4 py-3 rounded-xl border border-ink/10 bg-ink/5 hover:bg-ink/10 text-[12px] font-medium text-ink transition-colors">
                Download Personal Data
              </button>
              <button className="flex-1 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-[12px] font-medium text-red-400 transition-colors">
                Delete Account
              </button>
            </div>
          </section>

          {/* KEYBOARD */}
          <section id="keyboard" className="scroll-mt-16">
            <SectionTitle title="Keyboard & Productivity" description="Shortcuts and launch behaviors for power users." icon={Keyboard} />
            
            <div className="space-y-1 mb-8 border-b border-ink/[0.04] pb-6">
              <Toggle label="Focus Mode (F11)" description="Hide all non-essential UI during deep work" defaultOn={true} />
              <Toggle label="Enable Command Palette (⌘K)" defaultOn={true} />
              <Toggle label="Quick Launch (Double Shift)" description="Instantly open mission intake from anywhere" defaultOn={false} />
            </div>

            <div className="bg-surface border border-ink/[0.04] rounded-2xl overflow-hidden">
               <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.04]">
                  <span className="text-[12px] text-ink/60">New Mission</span>
                  <div className="flex gap-1"><kbd className="px-2 py-1 rounded bg-ink/10 text-[10px] font-mono text-ink/80">⌘</kbd><kbd className="px-2 py-1 rounded bg-ink/10 text-[10px] font-mono text-ink/80">N</kbd></div>
               </div>
               <div className="flex items-center justify-between px-6 py-4 border-b border-ink/[0.04]">
                  <span className="text-[12px] text-ink/60">Search History</span>
                  <div className="flex gap-1"><kbd className="px-2 py-1 rounded bg-ink/10 text-[10px] font-mono text-ink/80">⌘</kbd><kbd className="px-2 py-1 rounded bg-ink/10 text-[10px] font-mono text-ink/80">F</kbd></div>
               </div>
               <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-[12px] text-ink/60">Toggle Side Panel</span>
                  <div className="flex gap-1"><kbd className="px-2 py-1 rounded bg-ink/10 text-[10px] font-mono text-ink/80">⌘</kbd><kbd className="px-2 py-1 rounded bg-ink/10 text-[10px] font-mono text-ink/80">B</kbd></div>
               </div>
            </div>
          </section>

          {/* SYSTEM INFO */}
          <section id="system" className="scroll-mt-16">
            <SectionTitle title="System Information" description="OS telemetry and versioning." icon={Cpu} />
            
            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="p-4 rounded-xl border border-ink/[0.04] bg-surface">
                  <span className="block text-[10px] font-mono uppercase tracking-widest text-ink/40 mb-1">EthicalAI</span>
                  <span className="text-[14px] font-medium text-ink">v2.4.0-stable</span>
               </div>
               <div className="p-4 rounded-xl border border-ink/[0.04] bg-surface">
                  <span className="block text-[10px] font-mono uppercase tracking-widest text-ink/40 mb-1">Nexus Engine</span>
                  <span className="text-[14px] font-medium text-ink">v1.0.42</span>
               </div>
               <div className="p-4 rounded-xl border border-ink/[0.04] bg-surface">
                  <span className="block text-[10px] font-mono uppercase tracking-widest text-ink/40 mb-1">Helix Matrix</span>
                  <span className="text-[14px] font-medium text-ink">Verified Secure</span>
               </div>
               <div className="p-4 rounded-xl border border-ink/[0.04] bg-surface">
                  <span className="block text-[10px] font-mono uppercase tracking-widest text-ink/40 mb-1">Build ID</span>
                  <span className="text-[14px] font-medium text-ink">8a3f92b</span>
               </div>
            </div>

            <div className="flex flex-wrap gap-4">
               <a href="#" className="text-[12px] text-ink/50 hover:text-ink underline underline-offset-4 decoration-ink/20 transition-colors">Documentation</a>
               <a href="#" className="text-[12px] text-ink/50 hover:text-ink underline underline-offset-4 decoration-ink/20 transition-colors">Release Notes</a>
               <a href="#" className="text-[12px] text-ink/50 hover:text-ink underline underline-offset-4 decoration-ink/20 transition-colors">Support</a>
               <a href="#" className="text-[12px] text-ink/50 hover:text-ink underline underline-offset-4 decoration-ink/20 transition-colors">Privacy Policy</a>
               <a href="#" className="text-[12px] text-ink/50 hover:text-ink underline underline-offset-4 decoration-ink/20 transition-colors">Terms of Service</a>
            </div>
          </section>

          {/* RESET & EXPORT */}
          <section id="reset" className="scroll-mt-16">
            <SectionTitle title="Reset & Export" description="Manage your preferences payload." icon={RefreshCw} />
            
            <div className="flex flex-col gap-3">
               <button className="w-full flex items-center justify-between p-4 rounded-xl border border-ink/[0.04] bg-surface hover:bg-surface transition-colors group">
                  <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full bg-ink/5 flex items-center justify-center shrink-0">
                        <ArrowRight size={14} className="text-ink/60 group-hover:text-ink transition-colors" />
                     </div>
                     <span className="text-[13px] font-medium text-ink/80 group-hover:text-ink transition-colors">Export Preferences</span>
                  </div>
               </button>
               <button className="w-full flex items-center justify-between p-4 rounded-xl border border-ink/[0.04] bg-surface hover:bg-surface transition-colors group">
                  <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full bg-ink/5 flex items-center justify-center shrink-0">
                        <ArrowRight size={14} className="text-ink/60 group-hover:text-ink transition-colors rotate-180" />
                     </div>
                     <span className="text-[13px] font-medium text-ink/80 group-hover:text-ink transition-colors">Import Preferences</span>
                  </div>
               </button>
               <button className="w-full flex items-center justify-between p-4 rounded-xl border border-ink/[0.04] bg-surface hover:bg-surface transition-colors group">
                  <div className="flex items-center gap-3">
                     <div className="h-8 w-8 rounded-full bg-ink/5 flex items-center justify-center shrink-0">
                        <RefreshCw size={14} className="text-ink/60 group-hover:text-ink transition-colors" />
                     </div>
                     <span className="text-[13px] font-medium text-ink/80 group-hover:text-ink transition-colors">Restore Defaults</span>
                  </div>
               </button>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
