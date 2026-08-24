"use client";

import { useEffect, useState } from "react";
import { createDevice, deleteDevice, listDevices, updateDevice } from "@/lib/opal/apiClient";
import { LecternDevice } from "@/lib/opal/types";

export default function DevicesModal({ onClose }: { onClose: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-foreground">Lecterns</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

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
              <DeviceRow key={device.id} device={device} onRename={handleRename} onDelete={handleDelete} />
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
      </div>
    </div>
  );
}

function DeviceRow({
  device,
  onRename,
  onDelete,
}: {
  device: LecternDevice;
  onRename: (device: LecternDevice, name: string) => void;
  onDelete: (device: LecternDevice) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(device.name);

  const commit = () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== device.name) onRename(device, trimmed);
    else setName(device.name);
  };

  return (
    <li className="flex items-center justify-between gap-2 rounded-xl border border-border-hairline bg-background px-3 py-2">
      <div className="flex min-w-0 flex-col">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setName(device.name);
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
            {device.name}
          </button>
        )}
        <span className="truncate text-xs text-muted">{device.host}</span>
      </div>
      <button
        onClick={() => onDelete(device)}
        className="shrink-0 rounded-full p-1.5 text-muted hover:bg-surface-hover hover:text-danger"
        title="Remove"
        aria-label="Remove"
      >
        <TrashIcon />
      </button>
    </li>
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
