"use client";

import { useEffect, useState } from "react";
import { createSchedule, listDevices, listPresets, updateSchedule } from "@/lib/opal/apiClient";
import { LecternDevice, PresetSummary, Schedule, ScheduleInput } from "@/lib/opal/types";
import { CheckIcon, CopyIcon } from "./icons";
import DeviceMultiSelect from "./schedule/DeviceMultiSelect";
import PresetPicker from "./schedule/PresetPicker";
import RecurrenceFields, { RecurrenceValue } from "./schedule/RecurrenceFields";
import Modal from "./ui/Modal";

function initialRecurrence(schedule?: Schedule): RecurrenceValue {
  if (schedule) {
    return {
      recurrenceType: schedule.recurrenceType,
      runAt: schedule.runAt,
      timeOfDay: schedule.timeOfDay,
      daysOfWeek: schedule.daysOfWeek,
      dayOfMonth: schedule.dayOfMonth,
      intervalMinutes: schedule.intervalMinutes,
      activeFrom: schedule.activeFrom,
      activeUntil: schedule.activeUntil,
      durationMinutes: schedule.durationMinutes,
      graceMinutes: schedule.graceMinutes,
    };
  }
  return {
    recurrenceType: "once",
    runAt: null,
    timeOfDay: "09:00",
    daysOfWeek: [],
    dayOfMonth: 1,
    intervalMinutes: 60,
    activeFrom: null,
    activeUntil: null,
    durationMinutes: null,
    graceMinutes: 15,
  };
}

export default function ScheduleFormModal({
  schedule,
  onClose,
  onSaved,
}: {
  schedule?: Schedule;
  onClose: () => void;
  onSaved: (schedule: Schedule) => void;
}) {
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [devices, setDevices] = useState<LecternDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState(schedule?.name ?? "");
  const [presetId, setPresetId] = useState<string | null>(schedule?.presetId ?? null);
  const [deviceIds, setDeviceIds] = useState<Set<string>>(new Set(schedule?.deviceIds ?? []));
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(initialRecurrence(schedule));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    if (!schedule) return;
    await navigator.clipboard.writeText(schedule.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  useEffect(() => {
    Promise.all([listPresets(), listDevices()])
      .then(([p, d]) => {
        setPresets(p);
        setDevices(d);
      })
      .finally(() => setLoading(false));
  }, []);

  const canSubmit = name.trim().length > 0 && !!presetId && deviceIds.size > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !presetId) return;
    setSaving(true);
    setError("");

    const input: ScheduleInput = {
      name: name.trim(),
      presetId,
      deviceIds: [...deviceIds],
      recurrenceType: recurrence.recurrenceType,
      runAt: recurrence.runAt ?? undefined,
      timeOfDay: recurrence.timeOfDay ?? undefined,
      daysOfWeek: recurrence.daysOfWeek ?? undefined,
      dayOfMonth: recurrence.dayOfMonth ?? undefined,
      intervalMinutes: recurrence.intervalMinutes ?? undefined,
      durationMinutes: recurrence.durationMinutes ?? undefined,
      graceMinutes: recurrence.graceMinutes,
      activeFrom: recurrence.activeFrom ?? undefined,
      activeUntil: recurrence.activeUntil ?? undefined,
    };

    try {
      const saved = schedule ? await updateSchedule(schedule.id, input) : await createSchedule(input);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} title={schedule ? "Edit schedule" : "New schedule"} maxWidthClassName="max-w-2xl">
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:max-h-[70vh] md:overflow-y-auto md:pr-1">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Welcome slides"
              className="w-full rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Preset</label>
            <PresetPicker presets={presets} value={presetId} onChange={setPresetId} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted">Devices</label>
            <DeviceMultiSelect devices={devices} selected={deviceIds} onChange={setDeviceIds} />
          </div>

          <RecurrenceFields value={recurrence} onChange={setRecurrence} />

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex items-center justify-between gap-2 border-t border-border-hairline pt-4">
            {schedule ? (
              <button
                type="button"
                onClick={handleCopyId}
                className="flex items-center gap-1.5 text-xs text-muted hover:text-accent"
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? "Copied!" : "Copy ID (for Companion)"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save schedule"}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
