"use client";

import { useState } from "react";
import { downloadUrl } from "@/lib/opal/apiClient";
import { PresetSummary } from "@/lib/opal/types";

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

      <button
        onClick={() => onSend(preset)}
        className="flex items-center justify-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
      >
        <SendIcon />
        Send to lectern
      </button>

      <div className="flex items-center justify-between gap-0.5 px-0.5 pb-0.5">
        <IconButton
          title={preset.pinned ? "Unpin" : "Pin to top"}
          hoverClass="hover:text-accent"
          onClick={() => onTogglePin(preset)}
        >
          <PinIcon filled={preset.pinned} />
        </IconButton>
        <div className="flex gap-0.5">
          <IconLink href={downloadUrl(preset.id)} title="Download config.zip">
            <DownloadIcon />
          </IconLink>
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

function IconButton({
  title,
  onClick,
  hoverClass = "hover:text-accent",
  children,
}: {
  title: string;
  onClick: () => void;
  hoverClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover active:scale-90 ${hoverClass}`}
    >
      {children}
    </button>
  );
}

function IconLink({ href, title, children }: { href: string; title: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      title={title}
      aria-label={title}
      className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-hover hover:text-accent active:scale-90"
    >
      {children}
    </a>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5v8.2M4.8 6.8 8 10l3.2-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 12v1.2c0 .7.6 1.3 1.3 1.3h9.4c.7 0 1.3-.6 1.3-1.3V12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.6 12 2 13l1-3.6 8.3-7.1Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path
        d="M6.2 2.2h3.6l.4 3.6 2 1.7v1.3H3.8V7.5l2-1.7Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 9v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 8 13.5 2.5 9.5 13 7.5 9 2 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M7.5 9 13.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
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
