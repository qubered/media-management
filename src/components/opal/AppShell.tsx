"use client";

import { useState } from "react";
import DevicesModal from "./DevicesModal";
import PresetLibrary from "./PresetLibrary";

export default function AppShell() {
  const [devicesOpen, setDevicesOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border-hairline bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-6 py-3.5 sm:px-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-accent-foreground">
              <LecternIcon />
            </span>
            <span className="font-display text-lg text-foreground">Lectern Library</span>
          </div>

          <button
            onClick={() => setDevicesOpen(true)}
            title="Settings"
            aria-label="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      <main className="flex-1 py-6 sm:py-10">
        <PresetLibrary />
      </main>

      {devicesOpen && <DevicesModal onClose={() => setDevicesOpen(false)} />}
    </div>
  );
}

function LecternIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {/* Sloped reading surface with a lip, over a tapered body — the two features that read as "lectern" rather than a plain box. */}
      <path d="M3.6 4.6 11.8 3 12.6 4.7 4.6 6.3Z" fill="currentColor" />
      <path d="M4.9 6.2 4 13H12l-1-6.9Z" fill="currentColor" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.8v1.5M8 12.7v1.5M14.2 8h-1.5M3.3 8H1.8M12.2 3.8l-1 1M4.8 11.2l-1 1M12.2 12.2l-1-1M4.8 4.8l-1-1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
