import crypto from "node:crypto";
import {
  insertScheduledDeliveryRow,
  listDeliveryRowsForSchedules,
  listPendingDeliveryRows,
  markScheduledDeliveryRowsStatus,
  ScheduledDeliveryRow,
  updateScheduledDeliveryRow,
} from "./db";
import { ScheduledDelivery, ScheduledDeliveryStatus } from "@/lib/opal/types";

function toSummary(row: ScheduledDeliveryRow): ScheduledDelivery {
  return {
    id: row.id,
    scheduleId: row.schedule_id,
    deviceId: row.device_id,
    occurrenceAt: row.occurrence_at,
    validUntil: row.valid_until,
    status: row.status,
    attempts: row.attempts,
    lastAttemptAt: row.last_attempt_at,
    lastError: row.last_error,
    createdAt: row.created_at,
  };
}

/** Creates a delivery row. `status: "pending"` seeds attempts=1/lastAttemptAt=now if `error` is given (the first attempt already happened). */
export function createDelivery(input: {
  scheduleId: string;
  deviceId: string;
  occurrenceAt: number;
  validUntil: number;
  status: ScheduledDeliveryRow["status"];
  error?: string;
}): ScheduledDelivery {
  const now = Date.now();
  const row: ScheduledDeliveryRow = {
    id: crypto.randomUUID(),
    schedule_id: input.scheduleId,
    device_id: input.deviceId,
    occurrence_at: input.occurrenceAt,
    valid_until: input.validUntil,
    status: input.status,
    attempts: input.status === "expired" ? 0 : 1,
    last_attempt_at: input.status === "expired" ? null : now,
    last_error: input.error ?? null,
    created_at: now,
  };
  insertScheduledDeliveryRow(row);
  return toSummary(row);
}

export function markSent(id: string): void {
  updateScheduledDeliveryRow(id, { status: "sent" });
}

/** Retry attempt failed — bumps attempts/last_error, stays pending (retried again next tick, bounded by valid_until). */
export function markFailedPending(id: string, currentAttempts: number, error: string): void {
  updateScheduledDeliveryRow(id, {
    status: "pending",
    attempts: currentAttempts + 1,
    last_attempt_at: Date.now(),
    last_error: error,
  });
}

export function markExpired(id: string): void {
  updateScheduledDeliveryRow(id, { status: "expired" });
}

export function markCancelled(id: string): void {
  updateScheduledDeliveryRow(id, { status: "cancelled" });
}

export function markSuperseded(ids: string[]): void {
  markScheduledDeliveryRowsStatus(ids, "superseded");
}

export function listPending(): ScheduledDelivery[] {
  return listPendingDeliveryRows().map(toSummary);
}

/** For the UI's per-schedule status chip — every delivery for the given schedules, newest occurrence first. */
export function listForSchedules(scheduleIds: string[]): ScheduledDelivery[] {
  return listDeliveryRowsForSchedules(scheduleIds).map(toSummary);
}

/** The current state of a single schedule for OSC feedback/poll — latest delivery, ignoring superseded/cancelled history. */
export function latestStatusForSchedule(scheduleId: string): ScheduledDeliveryStatus | "none" {
  const rows = listDeliveryRowsForSchedules([scheduleId]).filter(
    (r) => r.status !== "superseded" && r.status !== "cancelled",
  );
  return rows[0]?.status ?? "none";
}
