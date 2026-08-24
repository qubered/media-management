"use client";

import { useEffect, useState } from "react";
import { listDevices, sendPresetToDevices } from "@/lib/opal/apiClient";
import { LecternDevice, PresetSummary } from "@/lib/opal/types";
import EmptyState from "./ui/EmptyState";
import Modal from "./ui/Modal";

type Status = "idle" | "sending" | "sent" | "failed";

export default function SendModal({ preset, onClose }: { preset: PresetSummary; onClose: () => void }) {
  const [devices, setDevices] = useState<LecternDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, Status>>({});

  useEffect(() => {
    listDevices()
      .then(setDevices)
      .finally(() => setLoading(false));
  }, []);

  const handleSend = async (device: LecternDevice) => {
    setStatuses((s) => ({ ...s, [device.id]: "sending" }));
    try {
      const [result] = await sendPresetToDevices(preset.id, [device.id]);
      setStatuses((s) => ({ ...s, [device.id]: result.ok ? "sent" : "failed" }));
    } catch {
      setStatuses((s) => ({ ...s, [device.id]: "failed" }));
    }
  };

  const handleSendAll = () => {
    devices.forEach((device) => handleSend(device));
  };

  return (
    <Modal onClose={onClose} title={`Send "${preset.name}"`}>
      {loading ? (
        <p className="text-sm text-muted">Loading lecterns…</p>
      ) : devices.length === 0 ? (
        <EmptyState>No lecterns registered yet — add one from the gear icon in the header, then come back here.</EmptyState>
      ) : (
        <>
          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {devices.map((device) => (
              <li
                key={device.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-border-hairline bg-background px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{device.name}</p>
                  <p className="truncate text-xs text-muted">{device.host}</p>
                </div>
                <SendButton status={statuses[device.id] ?? "idle"} onClick={() => handleSend(device)} />
              </li>
            ))}
          </ul>
          {devices.length > 1 && (
            <button
              onClick={handleSendAll}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Send to all
            </button>
          )}
        </>
      )}

      <p className="text-xs text-muted">
        Sends directly over the venue network on port 16179 — the screen must be powered on and reachable.
      </p>
    </Modal>
  );
}

function SendButton({ status, onClick }: { status: Status; onClick: () => void }) {
  if (status === "sending") {
    return <span className="shrink-0 rounded-full bg-surface-hover px-3 py-1.5 text-xs text-muted">Sending…</span>;
  }
  if (status === "sent") {
    return <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent">Sent ✓</span>;
  }
  if (status === "failed") {
    return (
      <button
        onClick={onClick}
        className="shrink-0 rounded-full bg-danger/15 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/25"
      >
        Retry
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
    >
      Send
    </button>
  );
}
