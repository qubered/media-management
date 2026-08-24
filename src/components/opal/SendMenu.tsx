"use client";

import { useEffect, useRef, useState } from "react";
import { downloadUrl } from "@/lib/opal/apiClient";
import { PresetSummary } from "@/lib/opal/types";

export default function SendMenu({ preset, onSend }: { preset: PresetSummary; onSend: (preset: PresetSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(preset.id);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 900);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Send"
        aria-label="Send"
        className={`flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent active:scale-90 ${
          open ? "bg-surface-hover text-accent" : ""
        }`}
      >
        <SendIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
          <a
            href={downloadUrl(preset.id)}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
          >
            <DownloadIcon />
            Download .zip
          </a>
          <button
            onClick={() => {
              setOpen(false);
              onSend(preset);
            }}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
          >
            <SendIcon />
            Push to lectern
          </button>
          <button
            onClick={handleCopyId}
            className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
          >
            <CopyIcon />
            {copied ? "Copied!" : "Copy ID (for Companion)"}
          </button>
        </div>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 8 13.5 2.5 9.5 13 7.5 9 2 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M7.5 9 13.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="5.5" y="5.5" width="8" height="9" rx="1.3" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.5 10.5v-7A1.3 1.3 0 0 1 4.8 2.2h6.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5v8.2M4.8 6.8 8 10l3.2-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12v1.2c0 .7.6 1.3 1.3 1.3h9.4c.7 0 1.3-.6 1.3-1.3V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
