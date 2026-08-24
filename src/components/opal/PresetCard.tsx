"use client";

import { useState } from "react";
import { PresetSummary } from "@/lib/opal/types";
import { PencilIcon, PinIcon, TrashIcon } from "./icons";
import SendMenu from "./SendMenu";
import IconButton from "./ui/IconButton";

export default function PresetCard({
  preset,
  onEdit,
  onDelete,
  onRename,
  onTogglePin,
  onSend,
}: {
  preset: PresetSummary;
  onEdit: (preset: PresetSummary) => void;
  onDelete: (preset: PresetSummary) => void;
  onRename: (preset: PresetSummary, name: string) => void;
  onTogglePin: (preset: PresetSummary) => void;
  onSend: (preset: PresetSummary) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(preset.name);

  const commitRename = () => {
    setRenaming(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== preset.name) onRename(preset, trimmed);
    else setName(preset.name);
  };

  return (
    <div className="group flex flex-col gap-2 rounded-2xl border border-border bg-surface p-2 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)]">
      <div className="px-1 pt-0.5">
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setName(preset.name);
                setRenaming(false);
              }
            }}
            className="w-full rounded-lg border border-accent bg-background px-1.5 py-0.5 text-[15px] outline-none"
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            className="w-full truncate text-left font-display text-[15px] text-foreground hover:text-accent"
            title="Rename"
          >
            {preset.name}
          </button>
        )}
      </div>

      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-black ring-1 ring-inset ring-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preset.previewDataUrl} alt={preset.name} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent" />
        <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-foreground-secondary">
          {preset.kind}
        </span>
        {preset.pinned && (
          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
            <PinIcon filled />
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-0.5 px-0.5 pb-0.5">
        <IconButton
          title={preset.pinned ? "Unpin" : "Pin to top"}
          hoverClass="hover:text-accent"
          onClick={() => onTogglePin(preset)}
        >
          <PinIcon filled={preset.pinned} />
        </IconButton>
        <div className="flex gap-0.5">
          <SendMenu preset={preset} onSend={onSend} />
          {preset.editable && (
            <IconButton title="Edit" onClick={() => onEdit(preset)}>
              <PencilIcon />
            </IconButton>
          )}
          <IconButton title="Delete" hoverClass="hover:text-danger" onClick={() => onDelete(preset)}>
            <TrashIcon />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
