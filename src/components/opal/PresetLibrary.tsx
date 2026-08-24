"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deletePreset, listPresets, updatePreset } from "@/lib/opal/apiClient";
import { PresetSummary } from "@/lib/opal/types";
import EditPresetModal from "./EditPresetModal";
import MediaBuilder from "./MediaBuilder";
import PresetCard from "./PresetCard";
import SendModal from "./SendModal";
import SortMenu from "./SortMenu";

const POLL_INTERVAL_MS = 10_000;

type SortOption = "newest" | "oldest" | "name-asc" | "name-desc";

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
};

function sortPresets(presets: PresetSummary[], sortBy: SortOption): PresetSummary[] {
  const sorted = [...presets];
  switch (sortBy) {
    case "newest":
      sorted.sort((a, b) => b.createdAt - a.createdAt);
      break;
    case "oldest":
      sorted.sort((a, b) => a.createdAt - b.createdAt);
      break;
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
  }
  return sorted;
}

export default function PresetLibrary() {
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<PresetSummary | null>(null);
  const [sendingPreset, setSendingPreset] = useState<PresetSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPresets(await listPresets());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const { pinned, rest } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matching = q ? presets.filter((p) => p.name.toLowerCase().includes(q)) : presets;
    return {
      pinned: sortPresets(
        matching.filter((p) => p.pinned),
        sortBy,
      ),
      rest: sortPresets(
        matching.filter((p) => !p.pinned),
        sortBy,
      ),
    };
  }, [presets, query, sortBy]);

  const handleSaved = (preset: PresetSummary) => {
    setPresets((prev) => [preset, ...prev]);
    setBuilderOpen(false);
  };

  const handleEdited = (preset: PresetSummary) => {
    setPresets((prev) => prev.map((p) => (p.id === preset.id ? preset : p)));
    setEditingPreset(null);
  };

  const handleDelete = async (preset: PresetSummary) => {
    if (!confirm(`Delete "${preset.name}"?`)) return;
    setPresets((prev) => prev.filter((p) => p.id !== preset.id));
    await deletePreset(preset.id);
  };

  const handleRename = async (preset: PresetSummary, name: string) => {
    setPresets((prev) => prev.map((p) => (p.id === preset.id ? { ...p, name } : p)));
    await updatePreset(preset.id, { name });
  };

  const handleTogglePin = async (preset: PresetSummary) => {
    const pinned = !preset.pinned;
    setPresets((prev) => prev.map((p) => (p.id === preset.id ? { ...p, pinned } : p)));
    await updatePreset(preset.id, { pinned });
  };

  const total = pinned.length + rest.length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 sm:px-10">
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-[18px] text-foreground">Presets</h1>
              {presets.length > 0 && (
                <span className="rounded-full border border-border-hairline px-1.5 py-0.5 text-[11px] leading-none text-muted">
                  {presets.length}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">
              Save a design once, grab a fresh <code className="text-foreground-secondary">config.zip</code> any time.
            </p>
          </div>

          <button
            onClick={() => setBuilderOpen(true)}
            className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
          >
            + New design
          </button>
        </div>

        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets…"
            className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent sm:max-w-48"
          />
          <SortMenu
            value={sortBy}
            onChange={setSortBy}
            options={Object.entries(SORT_LABELS).map(([value, label]) => ({ value: value as SortOption, label }))}
          />
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Loading library…</p>
      ) : total === 0 ? (
        query ? (
          <p className="text-sm text-muted">No presets match &quot;{query}&quot;.</p>
        ) : (
          <button
            onClick={() => setBuilderOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border py-16 text-muted hover:border-accent hover:text-accent"
          >
            <span className="font-display text-3xl leading-none">+</span>
            <span className="text-sm font-medium">Nothing saved yet — start a new design</span>
          </button>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {pinned.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="font-display text-xs uppercase tracking-wide text-muted">Pinned</h2>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                {pinned.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onEdit={setEditingPreset}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onTogglePin={handleTogglePin}
                    onSend={setSendingPreset}
                  />
                ))}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div className="flex flex-col gap-3">
              {pinned.length > 0 && <h2 className="font-display text-xs uppercase tracking-wide text-muted">All presets</h2>}
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                {rest.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    onEdit={setEditingPreset}
                    onDelete={handleDelete}
                    onRename={handleRename}
                    onTogglePin={handleTogglePin}
                    onSend={setSendingPreset}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {builderOpen && <MediaBuilder onClose={() => setBuilderOpen(false)} onSaved={handleSaved} />}
      {editingPreset && (
        <EditPresetModal preset={editingPreset} onClose={() => setEditingPreset(null)} onSaved={handleEdited} />
      )}
      {sendingPreset && <SendModal preset={sendingPreset} onClose={() => setSendingPreset(null)} />}
    </div>
  );
}
