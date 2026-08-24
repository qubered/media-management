"use client";

import { useEffect, useState } from "react";
import { fetchPresetSource, recropPreset } from "@/lib/opal/apiClient";
import { CropRect, PresetSummary } from "@/lib/opal/types";
import CropEditor from "./CropEditor";

type Step = "loading" | "crop" | "processing" | "error";

export default function EditPresetModal({
  preset,
  onClose,
  onSaved,
}: {
  preset: PresetSummary;
  onClose: () => void;
  onSaved: (preset: PresetSummary) => void;
}) {
  const [step, setStep] = useState<Step>("loading");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchPresetSource(preset.id)
      .then((loaded) => {
        if (cancelled) return;
        setFile(loaded);
        setStep("crop");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load original file");
        setStep("error");
      });
    return () => {
      cancelled = true;
    };
  }, [preset.id]);

  const handleConfirm = async (crop: CropRect, backgroundColor: string) => {
    setStep("processing");
    setError("");
    try {
      const updated = await recropPreset(preset.id, crop, backgroundColor);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-border bg-surface p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="truncate font-display text-xl text-foreground">Edit &quot;{preset.name}&quot;</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ✕
          </button>
        </div>

        {step === "loading" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm text-muted">Loading original file…</p>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-danger">{error}</p>
            <button onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-hover">
              Close
            </button>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm text-muted">Converting on the server…</p>
          </div>
        )}

        {step === "crop" && file && (
          <CropEditor
            file={file}
            kind={preset.kind}
            initialCrop={preset.crop}
            initialBackgroundColor={preset.backgroundColorRgb}
            onConfirm={handleConfirm}
            onCancel={onClose}
          />
        )}
      </div>
    </div>
  );
}
