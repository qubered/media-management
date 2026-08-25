"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon } from "./icons";

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
    <div ref={containerRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-sm text-foreground hover:border-accent/50"
      >
        {current?.label ?? "Sort"}
        <ChevronIcon className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-20 overflow-hidden rounded-t-2xl border border-border bg-surface pb-[calc(0.25rem+env(safe-area-inset-bottom))] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)] md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-[calc(100%+6px)] md:min-w-full md:rounded-xl md:py-1 md:pb-1">
            <div className="mx-auto mb-1 mt-2 h-1 w-9 rounded-full bg-border md:hidden" />
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`block w-full whitespace-nowrap px-4 py-3 text-left text-sm hover:bg-surface-hover md:px-4 md:py-2 ${
                  option.value === value ? "text-accent" : "text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
