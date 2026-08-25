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

function tabBarClass(active: boolean) {
  return `flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors [&>svg]:h-[22px] [&>svg]:w-[22px] ${
    active ? "text-accent" : "text-muted"
  }`;
}

/** The mobile bottom tab bar — Library / Schedule / Settings. Hidden at `md` and up, where the header's own
 * pill nav + gear icon (below) are the nav instead. See DESIGN.md for why the same three destinations are
 * duplicated across both shells rather than picking one: a fixed bottom bar only makes sense on a phone-width
 * screen, and a header pill row only makes sense once there's room for it. */
function TabBar({ pathname, onOpenSettings, settingsActive }: { pathname: string; onOpenSettings: () => void; settingsActive: boolean }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border-hairline bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <Link href="/" className={tabBarClass(pathname === "/")}>
        <BookIcon />
        Library
      </Link>
      <Link href="/schedule" className={tabBarClass(pathname === "/schedule")}>
        <ClockIcon />
        Schedule
      </Link>
      <button onClick={onOpenSettings} className={tabBarClass(settingsActive)}>
        <GearIcon />
        Settings
      </button>
    </nav>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [devicesOpen, setDevicesOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border-hairline bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-6 py-3.5 sm:px-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent text-accent-foreground">
                <LecternIcon />
              </span>
              <span className="font-display text-lg text-foreground">Lectern Library</span>
            </div>

            <nav className="hidden gap-1 rounded-full border border-border-hairline bg-background p-1 md:flex">
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
            className="hidden h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-foreground md:flex"
          >
            <GearIcon />
          </button>
        </div>
      </header>

      <main className="flex-1 py-6 pb-[calc(4.25rem+env(safe-area-inset-bottom))] sm:py-10 md:pb-6">{children}</main>

      <TabBar pathname={pathname} onOpenSettings={() => setDevicesOpen(true)} settingsActive={devicesOpen} />

      {devicesOpen && <DevicesModal onClose={() => setDevicesOpen(false)} />}
    </div>
  );
}
