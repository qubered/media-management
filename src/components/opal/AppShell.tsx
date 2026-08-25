"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import DevicesModal from "./DevicesModal";
import { BookIcon, ClockIcon, GearIcon, LecternIcon } from "./icons";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [devicesOpen, setDevicesOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border-hairline bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-6 py-3.5 sm:px-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-accent-foreground">
                <LecternIcon />
              </span>
              <span className="font-display text-lg text-foreground">Lectern Library</span>
            </div>

            <nav className="flex gap-1 rounded-full border border-border-hairline bg-background p-1">
              <NavLink href="/" active={pathname === "/"}>
                <BookIcon />
                Library
              </NavLink>
              <NavLink href="/schedule" active={pathname === "/schedule"}>
                <ClockIcon />
                Schedule
              </NavLink>
            </nav>
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

      <main className="flex-1 py-6 sm:py-10">{children}</main>

      {devicesOpen && <DevicesModal onClose={() => setDevicesOpen(false)} />}
    </div>
  );
}
