"use client";

import { useState } from "react";
import { createPreset, deletePreset, downloadUrl, updatePreset } from "@/lib/opal/apiClient";
import { CropRect, MediaKind, PresetSummary } from "@/lib/opal/types";
import CropEditor from "./CropEditor";
import Dropzone from "./Dropzone";
import MediaPreview from "./MediaPreview";
import LoadingState from "./ui/LoadingState";
import Modal from "./ui/Modal";

type Step = "drop" | "crop" | "processing" | "ready" | "error";

function kindFromFile(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export default function MediaBuilder({
  initialFile,
  onClose,
  onSaved,
}: {
  initialFile?: File;
  onClose: () => void;
  onSaved: (preset: PresetSummary) => void;
}) {
  const initialKind = initialFile ? kindFromFile(initialFile) : null;
  const [step, setStep] = useState<Step>(() => {
    if (!initialFile) return "drop";
    return initialKind ? "crop" : "error";
  });
  const [pending, setPending] = useState<{ file: File; kind: MediaKind } | null>(() =>
    initialFile && initialKind ? { file: initialFile, kind: initialKind } : null,
  );
  const [draft, setDraft] = useState<PresetSummary | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState(() =>
    initialFile && !initialKind ? "Only image or video files are supported." : "",
  );
  const [saving, setSaving] = useState(false);

  const handleFile = (file: File) => {
    const kind = kindFromFile(file);
    if (!kind) {
      setError("Only image or video files are supported.");
      setStep("error");
      return;
    }
    setPending({ file, kind });
    setStep("crop");
  };

  const handleCropConfirm = async (crop: CropRect, backgroundColor: string) => {
    if (!pending) return;
    setStep("processing");
    setError("");
    try {
      const created = await createPreset(pending.file, { ephemeral: true, crop, backgroundColor });
      setDraft(created);
      setName(created.name);
      setStep("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process file");
      setStep("error");
    }
  };

  const discardDraft = () => {
    if (draft) void deletePreset(draft.id);
    setDraft(null);
  };

  const handleReplace = () => {
    discardDraft();
    setPending(null);
    setStep("drop");
  };

  const handleClose = () => {
    if (step === "ready") discardDraft();
    onClose();
  };

  const handleUseOnce = () => {
    // The download itself is a plain navigation triggered by the anchor's own href/click —
    // we just close the modal alongside it and leave the draft ephemeral (it self-sweeps later).
    onClose();
  };

  const handleSaveAsPreset = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const saved = await updatePreset(draft.id, { name: name.trim() || draft.name, ephemeral: false });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preset");
      setStep("error");
      setSaving(false);
    }
  };

  return (
    <Modal onClose={handleClose} title="New design">
      {step === "drop" && <Dropzone onFile={handleFile} />}

      {step === "crop" && pending && (
        <CropEditor file={pending.file} kind={pending.kind} onConfirm={handleCropConfirm} onCancel={handleReplace} />
      )}

      {step === "error" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            onClick={() => setStep("drop")}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
          >
            Try again
          </button>
        </div>
      )}

      {step === "processing" && <LoadingState message="Converting on the server…" />}

      {step === "ready" && draft && (
        <div className="flex flex-col gap-4">
          <MediaPreview previewDataUrl={draft.previewDataUrl} />

          <button onClick={handleReplace} className="self-center text-xs text-muted hover:text-foreground">
            Replace file
          </button>

          <label className="flex flex-col gap-1 text-sm">
            Name (for saving as a preset)
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-full border border-border bg-background px-4 py-2 outline-none focus:border-accent"
              placeholder="e.g. Welcome slide"
            />
          </label>

          <div className="flex gap-2">
            <a
              href={downloadUrl(draft.id)}
              onClick={handleUseOnce}
              className="flex-1 rounded-full border border-border px-4 py-2 text-center text-sm font-medium hover:bg-surface-hover"
            >
              Use now
            </a>
            <button
              onClick={handleSaveAsPreset}
              disabled={saving}
              className="flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save as preset"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
