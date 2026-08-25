"use client";

import { useEffect, useRef, useState } from "react";
import { downloadUrl } from "@/lib/opal/apiClient";
import { PresetSummary } from "@/lib/opal/types";
import { CopyIcon, DownloadIcon, SendIcon } from "./icons";

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
        className={`flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent active:scale-90 md:h-7 md:w-7 ${
          open ? "bg-surface-hover text-accent" : ""
        }`}
      >
        <SendIcon />
      </button>

      {open && (
        <>
          {/* Below `md` this is a bottom sheet with its own backdrop; at `md` and up it reverts to the
              original absolute dropdown anchored under the trigger — see DESIGN.md "Component patterns". */}
          <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-2xl border border-border bg-surface pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-[calc(100%+6px)] md:min-w-44 md:rounded-xl md:py-1 md:pb-1">
            <div className="mx-auto mb-1 mt-2 h-1 w-9 rounded-full bg-border md:hidden" />
            <a
              href={downloadUrl(preset.id)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 whitespace-nowrap px-4 py-3 text-left text-sm text-foreground hover:bg-surface-hover md:px-3 md:py-2"
            >
              <DownloadIcon />
              Download .zip
            </a>
            <button
              onClick={() => {
                setOpen(false);
                onSend(preset);
              }}
              className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-3 text-left text-sm text-foreground hover:bg-surface-hover md:px-3 md:py-2"
            >
              <SendIcon />
              Push to lectern
            </button>
            <button
              onClick={handleCopyId}
              className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-3 text-left text-sm text-foreground hover:bg-surface-hover md:px-3 md:py-2"
            >
              <CopyIcon />
              {copied ? "Copied!" : "Copy ID (for Companion)"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
