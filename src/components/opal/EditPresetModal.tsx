"use client";

import { useEffect, useState } from "react";
import { fetchPresetSource, recropPreset } from "@/lib/opal/apiClient";
import { CropRect, PresetSummary } from "@/lib/opal/types";
import CropEditor from "./CropEditor";
import LoadingState from "./ui/LoadingState";
import Modal from "./ui/Modal";

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
    <Modal onClose={onClose} title={`Edit "${preset.name}"`}>
      {step === "loading" && <LoadingState message="Loading original file…" />}

      {step === "error" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-danger">{error}</p>
          <button onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-hover">
            Close
          </button>
        </div>
      )}

      {step === "processing" && <LoadingState message="Converting on the server…" />}

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
    </Modal>
  );
}
