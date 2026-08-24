"use client";

import { useEffect, useState } from "react";
import {
  clearOscLog,
  createDevice,
  createOscTarget,
  deleteDevice,
  deleteOscTarget,
  getOscInfo,
  getOscLog,
  listDevices,
  listOscTargets,
  updateDevice,
  updateOscTarget,
} from "@/lib/opal/apiClient";
import { LecternDevice, OscLogEntry, OscTarget } from "@/lib/opal/types";

type Tab = "lecterns" | "osc" | "log";

export default function DevicesModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("lecterns");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Settings</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="flex gap-1 rounded-full border border-border-hairline bg-background p-1">
          <TabButton active={tab === "lecterns"} onClick={() => setTab("lecterns")}>
            Lecterns
          </TabButton>
          <TabButton active={tab === "osc"} onClick={() => setTab("osc")}>
            OSC control
          </TabButton>
          <TabButton active={tab === "log"} onClick={() => setTab("log")}>
            Log
          </TabButton>
        </div>

        {tab === "lecterns" ? <LecternsTab /> : tab === "osc" ? <OscTab /> : <LogTab />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function LecternsTab() {
  const [devices, setDevices] = useState<LecternDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listDevices()
      .then(setDevices)
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !host.trim()) return;
    setAdding(true);
    setError("");
    try {
      const device = await createDevice(name.trim(), host.trim());
      setDevices((prev) => [...prev, device]);
      setName("");
      setHost("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add lectern");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (device: LecternDevice) => {
    if (!confirm(`Remove "${device.name}"?`)) return;
    setDevices((prev) => prev.filter((d) => d.id !== device.id));
    await deleteDevice(device.id);
  };

  const handleRename = async (device: LecternDevice, newName: string) => {
    setDevices((prev) => prev.map((d) => (d.id === device.id ? { ...d, name: newName } : d)));
    await updateDevice(device.id, { name: newName });
  };

  return (
    <>
      <p className="text-sm text-muted">
        Register each physical display so a design can be sent straight to it. Use the IP address it shows on its
        own network settings screen.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : devices.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
          No lecterns registered yet.
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {devices.map((device) => (
            <NamedHostRow
              key={device.id}
              id={device.id}
              name={device.name}
              subtitle={device.host}
              onRename={(newName) => handleRename(device, newName)}
              onDelete={() => handleDelete(device)}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 border-t border-border-hairline pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Foyer lectern)"
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="IP address or hostname"
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={adding || !name.trim() || !host.trim()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {adding ? "Adding…" : "+ Add lectern"}
        </button>
      </form>
    </>
  );
}

function OscTab() {
  const [targets, setTargets] = useState<OscTarget[]>([]);
  const [listenPort, setListenPort] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([listOscTargets(), getOscInfo()])
      .then(([oscTargets, info]) => {
        setTargets(oscTargets);
        setListenPort(info.listenPort);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const portNumber = Number(port);
    if (!name.trim() || !host.trim() || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) return;
    setAdding(true);
    setError("");
    try {
      const target = await createOscTarget(name.trim(), host.trim(), portNumber);
      setTargets((prev) => [...prev, target]);
      setName("");
      setHost("");
      setPort("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add target");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (target: OscTarget) => {
    if (!confirm(`Remove "${target.name}"?`)) return;
    setTargets((prev) => prev.filter((t) => t.id !== target.id));
    await deleteOscTarget(target.id);
  };

  const handleRename = async (target: OscTarget, newName: string) => {
    setTargets((prev) => prev.map((t) => (t.id === target.id ? { ...t, name: newName } : t)));
    await updateOscTarget(target.id, { name: newName });
  };

  return (
    <>
      <p className="text-sm text-muted">
        Control this app from Bitfocus Companion (or anything else that speaks OSC) over the venue network.
      </p>

      <div className="rounded-xl border border-border-hairline bg-background px-3 py-2.5 text-xs text-foreground-secondary">
        <p className="mb-1.5 font-semibold text-foreground">Send commands to this app on UDP {listenPort ?? "…"}</p>
        <code className="block text-muted">/lectern/send &lt;preset&gt; &lt;lectern&gt;</code>
        <code className="block text-muted">/lectern/send &lt;preset&gt; — sends to every lectern</code>
        <code className="block text-muted">/lectern/ping — replies with /lectern/pong</code>
        <p className="mb-1.5 mt-3 font-semibold text-foreground">Feedback broadcast to every target below</p>
        <code className="block text-muted">/lectern/feedback/send &lt;lectern&gt; &lt;preset&gt; &lt;status&gt; &lt;message&gt;</code>
        <code className="block text-muted">/lectern/feedback/error &lt;address&gt; &lt;detail&gt;</code>
        <p className="mt-1.5 text-muted">preset/lectern arguments match by name or id, case-insensitive.</p>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : targets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
          No feedback targets yet — add Companion&apos;s own IP and its &quot;Listen for OSC&quot; port.
        </p>
      ) : (
        <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto">
          {targets.map((target) => (
            <NamedHostRow
              key={target.id}
              name={target.name}
              subtitle={`${target.host}:${target.port}`}
              onRename={(newName) => handleRename(target, newName)}
              onDelete={() => handleDelete(target)}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-2 border-t border-border-hairline pt-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Companion)"
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="IP address"
            className="min-w-0 flex-1 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="Port"
            inputMode="numeric"
            className="w-full min-w-0 rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:w-20"
          />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={adding || !name.trim() || !host.trim() || !port.trim()}
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {adding ? "Adding…" : "+ Add feedback target"}
        </button>
      </form>
    </>
  );
}

function LogTab() {
  const [entries, setEntries] = useState<OscLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const refresh = () => getOscLog().then(setEntries).finally(() => setLoading(false));
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleClear = async () => {
    await clearOscLog();
    setEntries([]);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">Every incoming OSC command, valid or not — newest first.</p>
        {entries.length > 0 && (
          <button onClick={handleClear} className="shrink-0 text-xs text-muted hover:text-danger">
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
          Nothing received yet. Send <code className="text-foreground-secondary">/lectern/ping</code> from Companion
          to test the connection.
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-border-hairline bg-background px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <code className="truncate text-foreground">
                  {entry.address}
                  {entry.args.length > 0 && <span className="text-muted"> {entry.args.join(" ")}</span>}
                </code>
                <span className={`shrink-0 font-semibold ${entry.ok ? "text-accent" : "text-danger"}`}>
                  {entry.ok ? "OK" : "ERR"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-muted">{entry.detail}</p>
              <p className="mt-0.5 text-[10px] text-muted">
                {new Date(entry.timestamp).toLocaleTimeString()} · from {entry.from}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NamedHostRow({
  id,
  name,
  subtitle,
  onRename,
  onDelete,
}: {
  id?: string;
  name: string;
  subtitle: string;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(name);
  const [copied, setCopied] = useState(false);

  const commit = () => {
    setRenaming(false);
    const trimmed = value.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
    else setValue(name);
  };

  const handleCopyId = async () => {
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-border-hairline bg-background px-3 py-2">
      <div className="flex min-w-0 flex-col">
        {renaming ? (
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setValue(name);
                setRenaming(false);
              }
            }}
            className="rounded border border-accent bg-surface px-1.5 py-0.5 text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            className="truncate text-left text-sm font-medium hover:text-accent"
            title="Rename"
          >
            {name}
          </button>
        )}
        <span className="truncate text-xs text-muted">{subtitle}</span>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {id && (
          <button
            onClick={handleCopyId}
            className="rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-accent"
            title={copied ? "Copied!" : "Copy ID (for Companion)"}
            aria-label="Copy ID"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}
        <button
          onClick={onDelete}
          className="rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-danger"
          title="Remove"
          aria-label="Remove"
        >
          <TrashIcon />
        </button>
      </div>
    </li>
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

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5 6.3 12 13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M2.5 4.5h11M6.3 4.5V3a1 1 0 0 1 1-1h1.4a1 1 0 0 1 1 1v1.5M6.7 7.5v4M9.3 7.5v4M3.7 4.5l.6 8.3a1 1 0 0 0 1 .9h5.4a1 1 0 0 0 1-.9l.6-8.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
