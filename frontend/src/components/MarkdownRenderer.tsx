import React, { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const INLINE_SPLIT = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK_RE = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

/** Only http(s) and mailto survive; blocks javascript: and data: URIs, since
 *  this content is model-generated and rendered without sanitisation. */
function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : null;
}

export function parseInlineMarkdown(text: string): React.ReactNode[] {
  return text.split(INLINE_SPLIT).filter(Boolean).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-ink/10 font-mono text-[11px] text-ink break-words">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(LINK_RE);
    if (link) {
      const href = safeHref(link[2]);
      return href ? (
        <a key={i} href={href} target="_blank" rel="noopener noreferrer"
           className="text-ink underline decoration-ink/30 underline-offset-2 hover:decoration-ink">
          {link[1]}
        </a>
      ) : <span key={i}>{link[1]}</span>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={i} className="italic text-ink/90">{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="my-1.5 rounded-lg border border-ink/10 bg-surface/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-ink/[0.06] bg-ink/[0.02]">
        <span className="text-[9px] font-mono uppercase tracking-widest text-ink/55">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }).catch(() => {});
          }}
          className="text-[9px] font-mono text-ink/55 hover:text-ink transition-colors flex items-center gap-1"
        >
          {copied ? <Check className="h-3 w-3" /> : null}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      {/* whitespace-pre + overflow-x-auto: indentation is preserved and long
          lines scroll inside the block instead of stretching the chat bubble. */}
      <pre className="px-3 py-2.5 overflow-x-auto scrollbar-hide">
        <code className="font-mono text-[11.5px] leading-relaxed text-ink/90 whitespace-pre">
          {code}
        </code>
      </pre>
    </div>
  );
}

function MarkdownTable({ rows, dense }: { rows: string[][]; dense: boolean }) {
  const [head, ...body] = rows;
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-ink/10 scrollbar-hide", dense ? "my-1.5" : "my-4")}>
      <table className={cn("w-full border-collapse", dense ? "text-[12px]" : "text-[13.5px]")}>
        <thead>
          <tr className="bg-ink/[0.04]">
            {head.map((cell, i) => (
              <th key={i} className={cn("text-left font-semibold text-ink border-b border-ink/10 whitespace-nowrap", dense ? "px-3 py-1.5" : "px-4 py-2.5")}>
                {parseInlineMarkdown(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r} className="border-b border-ink/[0.05] last:border-0">
              {row.map((cell, c) => (
                <td key={c} className={cn("text-ink/80 align-top", dense ? "px-3 py-1.5" : "px-4 py-2.5")}>
                  {parseInlineMarkdown(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const splitRow = (line: string) =>
  line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

const isTableDivider = (line: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");

const CHAT_STYLES = {
  dense: true,
  heading: [
    "text-base font-bold text-ink mt-3 mb-1 first:mt-0",
    "text-[14px] font-bold text-ink mt-2 mb-1 first:mt-0",
    "text-[13px] font-semibold text-ink/95 mt-1.5 mb-0.5 first:mt-0",
    "text-[12px] font-semibold text-ink/90 mt-1.5 mb-0.5 first:mt-0",
  ],
  paragraph: "text-ink/80 leading-relaxed last:mb-0",
  list: "my-1 space-y-0.5 pl-5 text-ink/80",
  blockquote: "my-1 border-l-2 border-ink/25 pl-3 text-ink/70 italic",
  hr: "my-2 border-ink/10",
  blank: "h-1.5",
};

// Larger, airier scale for a full document read (output/report pages) --
// the chat scale above is tuned for narrow message bubbles and reads as
// cramped when it's the only content on a wide page.
const DOCUMENT_STYLES = {
  dense: false,
  heading: [
    "text-[26px] font-display font-semibold text-ink mt-10 mb-4 first:mt-0 tracking-tight",
    "text-[20px] font-display font-semibold text-ink mt-9 mb-3 first:mt-0 tracking-tight",
    "text-[16px] font-semibold text-ink mt-7 mb-2 first:mt-0",
    "text-[14px] font-semibold text-ink/90 mt-5 mb-1.5 first:mt-0 uppercase tracking-wide",
  ],
  paragraph: "text-[15.5px] text-ink/80 leading-[1.8] last:mb-0",
  list: "my-3 space-y-1.5 pl-6 text-[15.5px] text-ink/80",
  blockquote: "my-4 border-l-2 border-ink/20 pl-4 text-[15px] text-ink/65 italic leading-relaxed",
  hr: "my-8 border-ink/10",
  blank: "h-3",
};

export function renderMessageContent(text: string, variant: "chat" | "document" = "chat") {
  if (!text) return null;

  const s = variant === "document" ? DOCUMENT_STYLES : CHAT_STYLES;
  const lines = text.split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block -- consumed whole so indentation survives.
    const fence = trimmed.match(/^```+\s*(\S+)?/);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence (or EOF for an unterminated block)
      out.push(<CodeBlock key={key++} code={buf.join("\n")} lang={lang} />);
      continue;
    }

    // Pipe table -- requires a divider row beneath the header.
    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const rows: string[][] = [splitRow(line)];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out.push(<MarkdownTable key={key++} rows={rows} dense={s.dense} />);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      out.push(<hr key={key++} className={s.hr} />);
      i++;
      continue;
    }

    // Headings, h1-h4
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const content = parseInlineMarkdown(heading[2]);
      const cls = s.heading[level - 1];
      const Tag = (["h1", "h2", "h3", "h4"] as const)[level - 1];
      out.push(<Tag key={key++} className={cls}>{content}</Tag>);
      i++;
      continue;
    }

    // Blockquote run
    if (trimmed.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(
        <blockquote key={key++} className={s.blockquote}>
          {buf.map((b, n) => <div key={n}>{parseInlineMarkdown(b)}</div>)}
        </blockquote>
      );
      continue;
    }

    // List run -- consecutive items are grouped into one real <ul>/<ol>,
    // rather than emitting bare <li> elements with no list parent.
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    const ordered = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
    if (bullet || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      const start = isOrdered ? parseInt(ordered![1], 10) : 1;
      while (i < lines.length) {
        const t = lines[i].trim();
        const b = t.match(/^[-*+]\s+(.*)$/);
        const o = t.match(/^(\d+)[.)]\s+(.*)$/);
        if (isOrdered && o) items.push(o[2]);
        else if (!isOrdered && b) items.push(b[1]);
        else break;
        i++;
      }
      const ListTag = isOrdered ? "ol" : "ul";
      out.push(
        <ListTag
          key={key++}
          {...(isOrdered && start !== 1 ? { start } : {})}
          className={cn(s.list, isOrdered ? "list-decimal" : "list-disc")}
        >
          {items.map((it, n) => (
            <li key={n} className="marker:text-ink/40">{parseInlineMarkdown(it)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Blank line -- spacing
    if (trimmed === "") {
      out.push(<div key={key++} className={s.blank} />);
      i++;
      continue;
    }

    out.push(
      <p key={key++} className={s.paragraph}>
        {parseInlineMarkdown(line)}
      </p>
    );
    i++;
  }

  return out;
}

export function MarkdownRenderer({ content, variant = "chat" }: { content: string; variant?: "chat" | "document" }) {
  return <>{renderMessageContent(content, variant)}</>;
}
