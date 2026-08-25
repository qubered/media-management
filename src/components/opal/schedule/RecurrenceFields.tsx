"use client";

import { useEffect, useMemo, useState } from "react";
import { previewOccurrences, RecurrenceFields as RecurrenceDateFields, summarizeRecurrence } from "@/lib/opal/recurrence";
import { RecurrenceType } from "@/lib/opal/types";
import { ClockIcon } from "../icons";

export interface RecurrenceValue extends RecurrenceDateFields {
  durationMinutes: number | null;
  graceMinutes: number;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const RECURRING_TYPES: { type: RecurrenceType; label: string }[] = [
  { type: "daily", label: "Daily" },
  { type: "weekly", label: "Weekly" },
  { type: "monthly", label: "Monthly" },
  { type: "interval", label: "Interval" },
];

function inputClass() {
  return "rounded-full border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent";
}

function pillClass(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-accent text-accent-foreground" : "border border-border-hairline text-muted hover:text-foreground"
  }`;
}

function toDatetimeLocal(epochMs: number | null): string {
  if (!epochMs) return "";
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function canSummarize(v: RecurrenceValue): boolean {
  switch (v.recurrenceType) {
    case "once":
      return v.runAt !== null;
    case "daily":
      return !!v.timeOfDay;
    case "weekly":
      return !!v.timeOfDay && !!v.daysOfWeek && v.daysOfWeek.length > 0;
    case "monthly":
      return !!v.timeOfDay && v.dayOfMonth !== null;
    case "interval":
      return v.intervalMinutes !== null && v.intervalMinutes > 0;
  }
}

export default function RecurrenceFields({
  value,
  onChange,
}: {
  value: RecurrenceValue;
  onChange: (next: RecurrenceValue) => void;
}) {
  const [showActiveWindow, setShowActiveWindow] = useState(value.activeFrom !== null || value.activeUntil !== null);
  const [intervalUnit, setIntervalUnit] = useState<"minutes" | "hours">(
    value.intervalMinutes && value.intervalMinutes % 60 === 0 ? "hours" : "minutes",
  );

  const set = <K extends keyof RecurrenceValue>(key: K, val: RecurrenceValue[K]) => onChange({ ...value, [key]: val });

  const toggleDay = (day: number) => {
    const days = new Set(value.daysOfWeek ?? []);
    if (days.has(day)) days.delete(day);
    else days.add(day);
    set("daysOfWeek", [...days].sort());
  };

  const [now, setNow] = useState<number | null>(null);
  // Deferred a tick so setNow doesn't run synchronously within the effect.
  useEffect(() => {
    queueMicrotask(() => setNow(Date.now()));
  }, []);

  const summary = useMemo(() => (canSummarize(value) ? summarizeRecurrence(value) : null), [value]);
  const occurrences = useMemo(
    () => (now && canSummarize(value) ? previewOccurrences(value, now, 5) : []),
    [value, now],
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted">When</label>
        <div className="flex w-fit gap-1 rounded-full border border-border-hairline bg-background p-1">
          <button
            type="button"
            onClick={() => set("recurrenceType", "once")}
            className={pillClass(value.recurrenceType === "once")}
          >
            One-time
          </button>
          <button
            type="button"
            onClick={() => {
              if (value.recurrenceType === "once") set("recurrenceType", "daily");
            }}
            className={pillClass(value.recurrenceType !== "once")}
          >
            Recurring
          </button>
        </div>
      </div>

      {value.recurrenceType === "once" ? (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Date and time</label>
          <input
            type="datetime-local"
            value={toDatetimeLocal(value.runAt)}
            onChange={(e) => set("runAt", fromDatetimeLocal(e.target.value))}
            className={inputClass()}
          />
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            {RECURRING_TYPES.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                onClick={() => set("recurrenceType", type)}
                className={pillClass(value.recurrenceType === type)}
              >
                {label}
              </button>
            ))}
          </div>

          {(value.recurrenceType === "daily" || value.recurrenceType === "weekly" || value.recurrenceType === "monthly") && (
            <div className="flex flex-wrap items-end gap-3">
              {value.recurrenceType === "weekly" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Days</label>
                  <div className="flex gap-1">
                    {DAY_LABELS.map((label, day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium transition-colors md:h-8 md:w-8 ${
                          (value.daysOfWeek ?? []).includes(day)
                            ? "bg-accent text-accent-foreground"
                            : "border border-border-hairline text-muted hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {value.recurrenceType === "monthly" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Day of month</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={value.dayOfMonth ?? ""}
                    onChange={(e) => set("dayOfMonth", e.target.value ? Number(e.target.value) : null)}
                    className={`${inputClass()} w-20`}
                  />
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Time</label>
                <input
                  type="time"
                  value={value.timeOfDay ?? ""}
                  onChange={(e) => set("timeOfDay", e.target.value || null)}
                  className={`${inputClass()} w-32`}
                />
              </div>
            </div>
          )}

          {value.recurrenceType === "interval" && (
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Every</label>
                <input
                  type="number"
                  min={1}
                  value={
                    value.intervalMinutes ? (intervalUnit === "hours" ? value.intervalMinutes / 60 : value.intervalMinutes) : ""
                  }
                  onChange={(e) => {
                    const n = e.target.value ? Number(e.target.value) : null;
                    set("intervalMinutes", n ? n * (intervalUnit === "hours" ? 60 : 1) : null);
                  }}
                  className={`${inputClass()} w-24`}
                />
              </div>
              <select
                value={intervalUnit}
                onChange={(e) => setIntervalUnit(e.target.value as "minutes" | "hours")}
                className={inputClass()}
              >
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
              </select>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Duration (optional)</label>
          <input
            type="number"
            min={0}
            placeholder="minutes"
            value={value.durationMinutes ?? ""}
            onChange={(e) => set("durationMinutes", e.target.value ? Number(e.target.value) : null)}
            className={`${inputClass()} w-32`}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Grace period</label>
          <input
            type="number"
            min={0}
            value={value.graceMinutes}
            onChange={(e) => set("graceMinutes", e.target.value ? Number(e.target.value) : 0)}
            className={`${inputClass()} w-32`}
          />
        </div>
      </div>
      <p className="text-xs text-muted">
        If duration is set, a missed push is retried anywhere inside that window. Otherwise it&apos;s retried for the
        grace period only.
      </p>

      {value.recurrenceType !== "once" && (
        <div>
          <button
            type="button"
            onClick={() => setShowActiveWindow((s) => !s)}
            className="text-xs text-accent hover:underline"
          >
            {showActiveWindow ? "Hide active window" : "Limit to a date range (advanced)"}
          </button>
          {showActiveWindow && (
            <div className="mt-2 flex flex-wrap gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Active from</label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(value.activeFrom)}
                  onChange={(e) => set("activeFrom", fromDatetimeLocal(e.target.value))}
                  className={inputClass()}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Active until</label>
                <input
                  type="datetime-local"
                  value={toDatetimeLocal(value.activeUntil)}
                  onChange={(e) => set("activeUntil", fromDatetimeLocal(e.target.value))}
                  className={inputClass()}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {summary && <div className="rounded-xl bg-background px-3 py-2.5 text-sm text-foreground-secondary">{summary}</div>}

      {occurrences.length > 0 && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted">Upcoming</label>
          <div className="flex flex-col gap-1">
            {occurrences.map((ms) => (
              <p key={ms} className="flex items-center gap-1.5 text-xs text-foreground-secondary">
                <ClockIcon />
                {new Date(ms).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
