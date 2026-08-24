"use client";

import { useEffect, useRef, useState } from "react";

export default function SortMenu<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
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

  const current = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground hover:border-accent/50"
      >
        {current?.label ?? "Sort"}
        <ChevronIcon className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-full overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full whitespace-nowrap px-4 py-2 text-left text-sm hover:bg-surface-hover ${
                option.value === value ? "text-accent" : "text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ className = "" }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={`transition-transform ${className}`}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
