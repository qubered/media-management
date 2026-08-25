"use client";

import { LecternDevice } from "@/lib/opal/types";
import EmptyState from "../ui/EmptyState";

export default function DeviceMultiSelect({
  devices,
  selected,
  onChange,
}: {
  devices: LecternDevice[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const toggleAll = () => {
    onChange(selected.size === devices.length ? new Set() : new Set(devices.map((d) => d.id)));
  };

  if (devices.length === 0) {
    return <EmptyState>No lecterns registered yet — add one from the gear icon in the header.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-2">
      {devices.length > 1 && (
        <button type="button" onClick={toggleAll} className="self-start text-xs text-accent hover:underline">
          {selected.size === devices.length ? "Deselect all" : "Select all"}
        </button>
      )}
      <ul className="flex max-h-44 flex-col gap-2 overflow-y-auto">
        {devices.map((device) => (
          <li key={device.id}>
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border-hairline bg-background px-3 py-2">
              <input
                type="checkbox"
                checked={selected.has(device.id)}
                onChange={() => toggle(device.id)}
                className="accent-accent"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{device.name}</p>
                <p className="truncate text-xs text-muted">{device.host}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
