import crypto from "node:crypto";
import {
  deleteScheduledDeliveryRowsForSchedule,
  deleteScheduleRow,
  getScheduleRow,
  insertScheduleRow,
  listDueScheduleRows,
  listScheduleRows,
  ScheduleRow,
  updateScheduleRow,
} from "./db";
import { computeInitialNextRunAt, computeNextRunAfterFire, RecurrenceFields } from "@/lib/opal/recurrence";
import { Schedule, ScheduleInput } from "@/lib/opal/types";

function toSummary(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    name: row.name,
    presetId: row.preset_id,
    deviceIds: JSON.parse(row.device_ids),
    recurrenceType: row.recurrence_type,
    runAt: row.run_at,
    timeOfDay: row.time_of_day,
    daysOfWeek: row.days_of_week ? JSON.parse(row.days_of_week) : null,
    dayOfMonth: row.day_of_month,
    intervalMinutes: row.interval_minutes,
    durationMinutes: row.duration_minutes,
    graceMinutes: row.grace_minutes,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
    nextRunAt: row.next_run_at,
    enabled: row.enabled === 1,
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function recurrenceFieldsFromRow(row: ScheduleRow): RecurrenceFields {
  return {
    recurrenceType: row.recurrence_type,
    runAt: row.run_at,
    timeOfDay: row.time_of_day,
    daysOfWeek: row.days_of_week ? JSON.parse(row.days_of_week) : null,
    dayOfMonth: row.day_of_month,
    intervalMinutes: row.interval_minutes,
    activeFrom: row.active_from,
    activeUntil: row.active_until,
  };
}

/** Fields that affect `nextRunAt` — presence of any of these in an update payload triggers a recompute. */
const RECURRENCE_KEYS: (keyof ScheduleInput)[] = [
  "recurrenceType",
  "runAt",
  "timeOfDay",
  "daysOfWeek",
  "dayOfMonth",
  "intervalMinutes",
  "activeFrom",
  "activeUntil",
];

export function listSchedules(): Schedule[] {
  return listScheduleRows().map(toSummary);
}

export function getSchedule(id: string): Schedule | null {
  const row = getScheduleRow(id);
  return row ? toSummary(row) : null;
}

/** Thin re-export of the raw row query, for scheduler.ts to consume without going through toSummary. */
export function listDueSchedules(now: number): ScheduleRow[] {
  return listDueScheduleRows(now);
}

/** Thin re-export — scheduler.ts re-fetches the live row before retrying a delivery, rather than trusting anything cached. */
export function getScheduleRowRaw(id: string): ScheduleRow | undefined {
  return getScheduleRow(id);
}

/** Returns null if the recurrence can never fire within its active window (route rejects with 400). */
export function createSchedule(input: ScheduleInput): Schedule | null {
  const now = Date.now();
  const fields: RecurrenceFields = {
    recurrenceType: input.recurrenceType,
    runAt: input.runAt ?? null,
    timeOfDay: input.timeOfDay ?? null,
    daysOfWeek: input.daysOfWeek ?? null,
    dayOfMonth: input.dayOfMonth ?? null,
    intervalMinutes: input.intervalMinutes ?? null,
    activeFrom: input.activeFrom ?? null,
    activeUntil: input.activeUntil ?? null,
  };

  const nextRunAt = computeInitialNextRunAt(fields, now);
  if (nextRunAt === null) return null;

  const row: ScheduleRow = {
    id: crypto.randomUUID(),
    name: input.name,
    preset_id: input.presetId,
    device_ids: JSON.stringify(input.deviceIds),
    recurrence_type: input.recurrenceType,
    run_at: fields.runAt,
    time_of_day: fields.timeOfDay,
    days_of_week: fields.daysOfWeek ? JSON.stringify(fields.daysOfWeek) : null,
    day_of_month: fields.dayOfMonth,
    interval_minutes: fields.intervalMinutes,
    duration_minutes: input.durationMinutes ?? null,
    grace_minutes: input.graceMinutes ?? 15,
    active_from: fields.activeFrom,
    active_until: fields.activeUntil,
    next_run_at: nextRunAt,
    enabled: input.enabled === false ? 0 : 1,
    last_run_at: null,
    created_at: now,
    updated_at: now,
  };
  insertScheduleRow(row);
  return toSummary(row);
}

/** Returns null only if the schedule doesn't exist. A recurrence-affecting edit that would never fire again just disables the schedule rather than being rejected. */
export function updateSchedule(id: string, updates: Partial<ScheduleInput>): Schedule | null {
  const existing = getScheduleRow(id);
  if (!existing) return null;

  const now = Date.now();
  const rowUpdates: Partial<Omit<ScheduleRow, "id" | "created_at">> = { updated_at: now };

  if (updates.name !== undefined) rowUpdates.name = updates.name;
  if (updates.presetId !== undefined) rowUpdates.preset_id = updates.presetId;
  if (updates.deviceIds !== undefined) rowUpdates.device_ids = JSON.stringify(updates.deviceIds);
  if (updates.recurrenceType !== undefined) rowUpdates.recurrence_type = updates.recurrenceType;
  if (updates.runAt !== undefined) rowUpdates.run_at = updates.runAt;
  if (updates.timeOfDay !== undefined) rowUpdates.time_of_day = updates.timeOfDay;
  if (updates.daysOfWeek !== undefined) rowUpdates.days_of_week = JSON.stringify(updates.daysOfWeek);
  if (updates.dayOfMonth !== undefined) rowUpdates.day_of_month = updates.dayOfMonth;
  if (updates.intervalMinutes !== undefined) rowUpdates.interval_minutes = updates.intervalMinutes;
  if (updates.durationMinutes !== undefined) rowUpdates.duration_minutes = updates.durationMinutes;
  if (updates.graceMinutes !== undefined) rowUpdates.grace_minutes = updates.graceMinutes;
  if (updates.activeFrom !== undefined) rowUpdates.active_from = updates.activeFrom;
  if (updates.activeUntil !== undefined) rowUpdates.active_until = updates.activeUntil;
  if (updates.enabled !== undefined) rowUpdates.enabled = updates.enabled ? 1 : 0;

  const recomputeNeeded = RECURRENCE_KEYS.some((k) => updates[k] !== undefined);
  if (recomputeNeeded) {
    const merged = recurrenceFieldsFromRow({ ...existing, ...rowUpdates } as ScheduleRow);
    const nextRunAt = computeInitialNextRunAt(merged, now);
    if (nextRunAt === null) {
      rowUpdates.enabled = 0;
    } else {
      rowUpdates.next_run_at = nextRunAt;
    }
  }

  updateScheduleRow(id, rowUpdates);
  return toSummary({ ...existing, ...rowUpdates });
}

export function deleteSchedule(id: string): boolean {
  const row = getScheduleRow(id);
  if (!row) return false;
  deleteScheduledDeliveryRowsForSchedule(id);
  deleteScheduleRow(id);
  return true;
}

/** Called by the scheduler right after a schedule fires — advances (or disables) `next_run_at`/`last_run_at`. */
export function advanceScheduleAfterFire(row: ScheduleRow, occurrenceAt: number, now: number): void {
  const nextRunAt = computeNextRunAfterFire(recurrenceFieldsFromRow(row), occurrenceAt, now);
  if (nextRunAt === null) {
    updateScheduleRow(row.id, { enabled: 0, last_run_at: now, updated_at: now });
  } else {
    updateScheduleRow(row.id, { next_run_at: nextRunAt, last_run_at: now, updated_at: now });
  }
}
