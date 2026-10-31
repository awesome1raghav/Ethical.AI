"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Image as ImageIcon,
  Film,
  Mic2,
  Table2,
  Code2,
  Globe,
  BookOpen,
  Plus,
  X,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AttachedItemType =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "spreadsheet"
  | "code"
  | "url"
  | "knowledge";

export interface AttachedItem {
  id: string;
  name: string;
  type: AttachedItemType;
  size?: string;
  url?: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ATTACHMENT_TYPES = [
  {
    type: "document" as const,
    label: "Documents",
    ext: ".pdf,.doc,.docx,.txt,.md",
    icon: FileText,
    desc: "PDF, Word, Text",
  },
  {
    type: "image" as const,
    label: "Images",
    ext: "image/*",
    icon: ImageIcon,
    desc: "PNG, JPG, SVG",
  },
  {
    type: "video" as const,
    label: "Video",
    ext: "video/*",
    icon: Film,
    desc: "MP4, MOV, AVI",
  },
  {
    type: "audio" as const,
    label: "Audio",
    ext: "audio/*",
    icon: Mic2,
    desc: "MP3, WAV, M4A",
  },
  {
    type: "spreadsheet" as const,
    label: "Spreadsheets",
    ext: ".xlsx,.csv,.numbers",
    icon: Table2,
    desc: "Excel, CSV",
  },
  {
    type: "code" as const,
    label: "Code",
    ext: ".js,.ts,.py,.json,.yaml,.sql",
    icon: Code2,
    desc: "JS, Python, SQL",
  },
  {
    type: "url" as const,
    label: "URL",
    ext: "",
    icon: Globe,
    desc: "Any web link",
  },
  {
    type: "knowledge" as const,
    label: "Knowledge Base",
    ext: "",
    icon: BookOpen,
    desc: "Internal docs",
  },
] as const;

const TYPE_BADGE: Record<AttachedItemType, string> = {
  document: "DOC",
  image: "IMG",
  video: "VID",
  audio: "AUD",
  spreadsheet: "XLS",
  code: "CODE",
  url: "URL",
  knowledge: "KB",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectType(file: File): AttachedItemType {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (["xlsx", "csv", "numbers"].includes(ext)) return "spreadsheet";
  if (["js", "ts", "py", "json", "yaml", "sql", "tsx", "jsx"].includes(ext)) return "code";
  return "document";
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContextBuilderProps {
  items: AttachedItem[];
  onAdd: (item: AttachedItem) => void;
  onRemove: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ContextBuilder: React.FC<ContextBuilderProps> = ({
  items,
  onAdd,
  onRemove,
}) => {
  const [showGrid, setShowGrid] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [currentAccept, setCurrentAccept] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTypeClick = (type: (typeof ATTACHMENT_TYPES)[number]) => {
    if (type.type === "url") {
      setShowUrlInput(true);
      setShowGrid(false);
      return;
    }
    if (type.type === "knowledge") {
      // TODO: open knowledge base picker
      setShowGrid(false);
      return;
    }
    setCurrentAccept(type.ext);
    setShowGrid(false);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach((file) => {
      onAdd({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: detectType(file),
        size: formatSize(file.size),
      });
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUrlSubmit = () => {
    const raw = urlInput.trim();
    if (!raw) return;
    let hostname = raw;
    try {
      hostname = new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname;
    } catch {}
    onAdd({ id: `${Date.now()}-url`, name: hostname, type: "url", url: raw });
    setUrlInput("");
    setShowUrlInput(false);
  };

  return (
    <div>
      {/* ── Attached item chips ──────────────────────────────────────── */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-2 mb-5">
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.14 }}
                  className="flex items-center gap-2.5 bg-ink/[0.04] border border-ink/[0.08] rounded-xl px-3 py-2 group max-w-[220px]"
                >
                  <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-ink/45 shrink-0 bg-ink/[0.06] px-1.5 py-0.5 rounded-md border border-ink/[0.06]">
                    {TYPE_BADGE[item.type]}
                  </span>
                  <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                    <span className="text-[12px] font-body text-ink truncate leading-none">
                      {item.name}
                    </span>
                    {item.size && (
                      <span className="text-[9px] font-mono text-ink/45 leading-none">
                        {item.size}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="shrink-0 text-ink/30 hover:text-ink transition-colors ml-1"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── URL input ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUrlInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex gap-2 pt-1">
              <input
                autoFocus
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUrlSubmit();
                  if (e.key === "Escape") setShowUrlInput(false);
                }}
                placeholder="Paste a URL and press Enter..."
                className="flex-grow bg-ink/[0.03] border border-ink/[0.08] rounded-xl px-4 py-2.5 text-[13px] font-body text-ink placeholder:text-ink/40 outline-none focus:border-ink/20 transition-colors"
              />
              <button
                onClick={handleUrlSubmit}
                className="px-4 py-2.5 rounded-xl bg-ink/[0.06] border border-ink/[0.08] text-[11px] font-mono font-bold uppercase tracking-wider text-ink hover:bg-ink/10 transition-colors shrink-0"
              >
                Add
              </button>
              <button
                onClick={() => { setShowUrlInput(false); setUrlInput(""); }}
                className="p-2.5 text-ink/45 hover:text-ink transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Type grid or Add button ──────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {showGrid ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
          >
            <div className="grid grid-cols-4 gap-2">
              {ATTACHMENT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.type}
                    onClick={() => handleTypeClick(type)}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-2xl border border-ink/[0.06] bg-ink/[0.02] hover:bg-ink/[0.05] hover:border-ink/[0.12] transition-all duration-200 group text-left"
                  >
                    <Icon className="h-4 w-4 text-ink/45 group-hover:text-ink transition-colors" />
                    <div className="text-center">
                      <p className="text-[11px] font-body text-ink/55 group-hover:text-ink transition-colors leading-tight">
                        {type.label}
                      </p>
                      <p className="text-[8px] font-mono text-ink/40 mt-0.5">{type.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowGrid(false)}
              className="mt-3 flex items-center gap-1.5 text-[10px] font-mono text-ink/45 hover:text-ink transition-colors uppercase tracking-wider"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="add-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowGrid(true)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-dashed border-ink/[0.10] text-ink/45 hover:text-ink hover:border-ink/[0.20] hover:bg-ink/[0.02] transition-all duration-200 group"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
              Add Content
            </span>
            {items.length > 0 && (
              <span className="text-[9px] font-mono text-ink/40 ml-1">
                ({items.length} attached)
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept={currentAccept}
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
};
