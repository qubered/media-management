"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteSchedule,
  listScheduledDeliveries,
  listSchedules,
  triggerSchedule,
  updateSchedule,
} from "@/lib/opal/apiClient";
import { summarizeRecurrence } from "@/lib/opal/recurrence";
import { Schedule, ScheduledDelivery } from "@/lib/opal/types";
import ScheduleFormModal from "./ScheduleFormModal";
import { PencilIcon, SendIcon, TrashIcon } from "./icons";
import IconButton from "./ui/IconButton";

const POLL_INTERVAL_MS = 15_000;

function recurrenceSummary(schedule: Schedule): string {
  if (
    (schedule.recurrenceType === "once" && schedule.runAt === null) ||
    (schedule.recurrenceType !== "once" && schedule.recurrenceType !== "interval" && !schedule.timeOfDay)
  ) {
    return "—";
  }
  return summarizeRecurrence(schedule).split(". ")[0];
}

function latestDelivery(deliveries: ScheduledDelivery[]): ScheduledDelivery | null {
  const relevant = deliveries.filter((d) => d.status !== "superseded" && d.status !== "cancelled");
  if (relevant.length === 0) return null;
  return relevant.reduce((a, b) => (a.occurrenceAt >= b.occurrenceAt ? a : b));
}

/** Recurring vs. one-time-pending vs. one-time-fired — a quick-glance dot using the brand guide's Productions department swatches (Video/Audio/Rigging). */
function ScheduleKindDot({ schedule }: { schedule: Schedule }) {
  const kind =
    schedule.recurrenceType !== "once"
      ? { label: "Recurring", className: "bg-recurring" }
      : schedule.lastRunAt === null
        ? { label: "One-time — yet to fire", className: "bg-once-pending" }
        : { label: "One-time — has fired", className: "bg-once-fired" };
  return <span title={kind.label} aria-label={kind.label} className={`h-2 w-2 shrink-0 rounded-full ${kind.className}`} />;
}

function StatusChip({ deliveries }: { deliveries: ScheduledDelivery[] }) {
  const latest = latestDelivery(deliveries);
  if (!latest) {
    return <span className="w-fit rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted">Not yet run</span>;
  }
  if (latest.status === "sent") {
    return <span className="w-fit rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">Sent</span>;
  }
  if (latest.status === "pending") {
    return (
      <span className="w-fit rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning">
        Pending — device offline
      </span>
    );
  }
  return <span className="w-fit rounded-full bg-danger/15 px-2.5 py-1 text-xs font-medium text-danger">Expired — missed window</span>;
}

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, ScheduledDelivery[]>>({});
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [triggering, setTriggering] = useState<Set<string>>(new Set());

  const refreshDeliveries = useCallback(async (currentSchedules: Schedule[]) => {
    if (currentSchedules.length === 0) {
      setDeliveries({});
      return;
    }
    const rows = await listScheduledDeliveries(currentSchedules.map((s) => s.id));
    const grouped: Record<string, ScheduledDelivery[]> = {};
    for (const row of rows) {
      (grouped[row.scheduleId] ??= []).push(row);
    }
    setDeliveries(grouped);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const list = await listSchedules();
      setSchedules(list);
      await refreshDeliveries(list);
    } finally {
      setLoading(false);
    }
  }, [refreshDeliveries]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleSaved = (schedule: Schedule) => {
    setSchedules((prev) => {
      const exists = prev.some((s) => s.id === schedule.id);
      const next = exists ? prev.map((s) => (s.id === schedule.id ? schedule : s)) : [...prev, schedule];
      refreshDeliveries(next);
      return next;
    });
    setFormOpen(false);
    setEditingSchedule(null);
  };

  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`Delete "${schedule.name}"?`)) return;
    setSchedules((prev) => prev.filter((s) => s.id !== schedule.id));
    await deleteSchedule(schedule.id);
  };

  const handleToggleEnabled = async (schedule: Schedule) => {
    const enabled = !schedule.enabled;
    setSchedules((prev) => prev.map((s) => (s.id === schedule.id ? { ...s, enabled } : s)));
    await updateSchedule(schedule.id, { enabled });
  };

  const handleTrigger = async (schedule: Schedule) => {
    setTriggering((prev) => new Set(prev).add(schedule.id));
    try {
      await triggerSchedule(schedule.id);
    } finally {
      setTriggering((prev) => {
        const next = new Set(prev);
        next.delete(schedule.id);
        return next;
      });
      await refreshDeliveries(schedules);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 sm:px-10">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[18px] text-foreground">Schedules</h1>
          <p className="text-sm text-muted">Push a preset to a lectern automatically — once, or on a recurring basis.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          + New schedule
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-muted">Loading schedules…</p>
      ) : schedules.length === 0 ? (
        <button
          onClick={() => setFormOpen(true)}
          className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-border py-16 text-muted hover:border-accent hover:text-accent"
        >
          <span className="font-display text-3xl leading-none">+</span>
          <span className="text-sm font-medium">No schedules yet — create one</span>
        </button>
      ) : (
        <>
          {/* Below `md` the fixed-column table can't reasonably reflow, so it's a card list instead;
              at `md` and up the original table is unchanged. */}
          <div className="flex flex-col gap-3 md:hidden">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <ScheduleKindDot schedule={schedule} />
                    <span className={`truncate font-display text-[15px] ${schedule.enabled ? "text-foreground" : "text-muted"}`}>
                      {schedule.name}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => handleToggleEnabled(schedule)}
                    className="h-5 w-5 shrink-0 accent-accent"
                    aria-label={schedule.enabled ? "Disable schedule" : "Enable schedule"}
                  />
                </div>

                <div className="flex flex-col gap-0.5 text-xs text-foreground-secondary">
                  <span className="truncate">{recurrenceSummary(schedule)}</span>
                  <span className="truncate">
                    {schedule.enabled
                      ? `Next: ${new Date(schedule.nextRunAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                      : "Disabled"}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <StatusChip deliveries={deliveries[schedule.id] ?? []} />
                  <div className="flex gap-0.5">
                    <IconButton
                      title="Run now"
                      onClick={() => handleTrigger(schedule)}
                      hoverClass={triggering.has(schedule.id) ? "" : "hover:text-accent"}
                    >
                      <SendIcon />
                    </IconButton>
                    <IconButton title="Edit" onClick={() => setEditingSchedule(schedule)}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton title="Delete" hoverClass="hover:text-danger" onClick={() => handleDelete(schedule)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border-hairline md:block">
            <div className="grid grid-cols-[1.6fr_1.7fr_1.4fr_1.6fr_46px_100px] gap-2 border-b border-border-hairline bg-surface px-4 py-2 text-xs text-muted">
              <span>Name</span>
              <span>Recurrence</span>
              <span>Next run</span>
              <span>Status</span>
              <span>On</span>
              <span></span>
            </div>
            <ul>
              {schedules.map((schedule) => (
                <li
                  key={schedule.id}
                  className="grid grid-cols-[1.6fr_1.7fr_1.4fr_1.6fr_46px_100px] items-center gap-2 border-b border-border-hairline bg-background px-4 py-3 text-sm last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ScheduleKindDot schedule={schedule} />
                    <span className={`truncate font-medium ${schedule.enabled ? "" : "text-muted"}`}>{schedule.name}</span>
                  </span>
                  <span className="truncate text-foreground-secondary">{recurrenceSummary(schedule)}</span>
                  <span className="truncate text-foreground-secondary">
                    {schedule.enabled ? new Date(schedule.nextRunAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                  </span>
                  <StatusChip deliveries={deliveries[schedule.id] ?? []} />
                  <input
                    type="checkbox"
                    checked={schedule.enabled}
                    onChange={() => handleToggleEnabled(schedule)}
                    className="accent-accent"
                    aria-label={schedule.enabled ? "Disable schedule" : "Enable schedule"}
                  />
                  <div className="flex justify-end gap-0.5">
                    <IconButton
                      title="Run now"
                      onClick={() => handleTrigger(schedule)}
                      hoverClass={triggering.has(schedule.id) ? "" : "hover:text-accent"}
                    >
                      <SendIcon />
                    </IconButton>
                    <IconButton title="Edit" onClick={() => setEditingSchedule(schedule)}>
                      <PencilIcon />
                    </IconButton>
                    <IconButton title="Delete" hoverClass="hover:text-danger" onClick={() => handleDelete(schedule)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {formOpen && <ScheduleFormModal onClose={() => setFormOpen(false)} onSaved={handleSaved} />}
      {editingSchedule && (
        <ScheduleFormModal schedule={editingSchedule} onClose={() => setEditingSchedule(null)} onSaved={handleSaved} />
      )}
    </div>
  );
}
