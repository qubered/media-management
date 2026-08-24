"use client";

import { useState } from "react";
import DevicesModal from "./DevicesModal";
import { GearIcon, LecternIcon } from "./icons";
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
