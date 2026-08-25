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
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
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
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-hover"
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
      )}
    </div>
  );
}
