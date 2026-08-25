"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PresetSummary } from "@/lib/opal/types";
import { CheckIcon, ChevronIcon, PinIcon } from "../icons";

function Thumbnail({ preset, className = "" }: { preset: PresetSummary; className?: string }) {
  return (
    <span className={`relative shrink-0 overflow-hidden rounded bg-black ring-1 ring-inset ring-black/40 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={preset.previewDataUrl} alt="" className="h-full w-full object-cover" />
    </span>
  );
}

export default function PresetPicker({
  presets,
  value,
  onChange,
}: {
  presets: PresetSummary[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

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

  // On mobile the list becomes a sheet with its own search field pinned above it — focus that copy
  // whenever the sheet opens, since the original trigger input is now covered by the sheet's backdrop.
  useEffect(() => {
    if (open) sheetInputRef.current?.focus();
  }, [open]);

  const selected = presets.find((p) => p.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? presets.filter((p) => p.name.toLowerCase().includes(q)) : presets;
    // Pinned first, matching the library's own ordering.
    return [...matching].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [presets, query]);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 focus-within:border-accent">
        {selected && !open && <Thumbnail preset={selected} className="h-8 w-5" />}
        <input
          value={open ? query : (selected?.name ?? "")}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          placeholder="Search presets…"
          className="min-w-0 flex-1 bg-transparent py-0.5 text-sm outline-none"
        />
        <ChevronIcon className={open ? "rotate-180" : ""} />
      </div>

      {open && (
        <>
          {/* Below `md` this becomes a bottom sheet with its own backdrop and a pinned search field above
              a scrollable list; at `md` and up it's the original absolute dropdown. */}
          <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-20 flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] md:absolute md:inset-x-0 md:bottom-auto md:top-[calc(100%+6px)] md:max-h-64 md:rounded-xl md:py-1">
            <div className="mx-auto mb-1 mt-2 h-1 w-9 shrink-0 rounded-full bg-border md:hidden" />
            <input
              ref={sheetInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search presets…"
              className="mx-4 mb-2 shrink-0 rounded-full border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-accent md:hidden"
            />
            <div className="min-h-0 flex-1 overflow-y-auto pb-2 md:pb-0">
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted">No presets match.</p>
              ) : (
                filtered.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onChange(preset.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-surface-hover md:px-3 md:py-2"
                  >
                    <Thumbnail preset={preset} className="h-9 w-5" />
                    <span className="min-w-0 flex-1 truncate text-sm">{preset.name}</span>
                    {preset.pinned && (
                      <span className="shrink-0 text-muted" title="Pinned">
                        <PinIcon filled />
                      </span>
                    )}
                    {preset.id === value && <CheckIcon />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
