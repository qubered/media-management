import { computeOccurrenceWindow } from "@/lib/opal/recurrence";
import { ScheduleRow } from "./db";
import { checkDeviceHealth } from "./deviceHealth";
import { getDevice } from "./devices";
import { pushOscLog } from "./oscLog";
import { getPreset } from "./presets";
import { pushPresetToDevices } from "./pushPreset";
import { advanceScheduleAfterFire, getScheduleRowRaw, listDueSchedules } from "./schedules";
import {
  createDelivery,
  listPending,
  markCancelled,
  markExpired,
  markFailedPending,
  markSent,
  markSuperseded,
} from "./scheduledDeliveries";
import { ScheduledDelivery, SendResult } from "@/lib/opal/types";

const TICK_INTERVAL_MS = 30_000;
let started = false;

/**
 * Starts the schedule tick loop: fires due schedules, and retries deliveries queued for lecterns that
 * were offline when their schedule fired. See README "Scheduling" for the retry/currency semantics.
 */
export function startScheduler(): void {
  if (started) return;
  started = true;
  setInterval(() => {
    void tick();
  }, TICK_INTERVAL_MS);
}

async function tick(): Promise<void> {
  await fireDueSchedules();
  await retryPendingDeliveries();
}

/**
 * Attempts one occurrence of a schedule right now — pushing to every target device and queuing a
 * `pending` delivery (for the retry job) on any failure. Shared by the tick's fire job and by
 * `triggerSchedule`, so a manual "Run now" (from the UI or `/lectern/schedule/trigger`) behaves
 * exactly like a scheduled firing, just without advancing `next_run_at`.
 */
async function fireScheduleOccurrence(schedule: ScheduleRow, occurrenceAt: number): Promise<SendResult[]> {
  const now = Date.now();
  const { validUntil } = computeOccurrenceWindow(
    { durationMinutes: schedule.duration_minutes, graceMinutes: schedule.grace_minutes },
    occurrenceAt,
  );
  const deviceIds: string[] = JSON.parse(schedule.device_ids);
  const presetName = getPreset(schedule.preset_id)?.name ?? schedule.preset_id;

  if (validUntil < now) {
    // Server was down through the whole window — no point attempting a send.
    for (const deviceId of deviceIds) {
      createDelivery({ scheduleId: schedule.id, deviceId, occurrenceAt, validUntil, status: "expired" });
      const deviceName = getDevice(deviceId)?.name ?? deviceId;
      pushOscLog({
        from: "scheduler",
        address: "/lectern/schedule/expired",
        args: [schedule.name, deviceName],
        ok: false,
        detail: `"${schedule.name}" missed its retry window before it could reach "${deviceName}"`,
      });
    }
    return deviceIds.map((deviceId) => ({ deviceId, ok: false, message: "Missed its retry window" }));
  }

  const results = await pushPresetToDevices(schedule.preset_id, deviceIds);
  const summarized: SendResult[] = [];
  for (const deviceId of deviceIds) {
    const deviceName = getDevice(deviceId)?.name ?? deviceId;
    const result = results?.find((r) => r.deviceId === deviceId);
    if (result?.ok) {
      createDelivery({ scheduleId: schedule.id, deviceId, occurrenceAt, validUntil, status: "sent" });
      pushOscLog({
        from: "scheduler",
        address: "/lectern/schedule/sent",
        args: [schedule.name, deviceName],
        ok: true,
        detail: `sent "${presetName}" to "${deviceName}" for schedule "${schedule.name}"`,
      });
    } else {
      const message = result?.message ?? "Preset or device unavailable";
      createDelivery({ scheduleId: schedule.id, deviceId, occurrenceAt, validUntil, status: "pending", error: message });
      pushOscLog({
        from: "scheduler",
        address: "/lectern/schedule/failed",
        args: [schedule.name, deviceName],
        ok: false,
        detail: `failed to send "${presetName}" to "${deviceName}" for schedule "${schedule.name}" — ${message} (queued for retry)`,
      });
    }
    summarized.push(result ?? { deviceId, ok: false, message: "Preset or device unavailable" });
  }
  return summarized;
}

async function fireDueSchedules(): Promise<void> {
  const now = Date.now();
  const due = listDueSchedules(now);

  for (const schedule of due) {
    const occurrenceAt = schedule.next_run_at;
    await fireScheduleOccurrence(schedule, occurrenceAt);
    advanceScheduleAfterFire(schedule, occurrenceAt, now);
  }
}

/**
 * Manually fires a schedule right now, independent of its own cadence — used by the "Run now" button
 * and the `/lectern/schedule/trigger` OSC command. Works even if the schedule is disabled (a manual
 * trigger is an explicit user action, not the schedule's own timer), and never touches `next_run_at`.
 * Returns null if the schedule doesn't exist.
 */
export async function triggerSchedule(id: string): Promise<SendResult[] | null> {
  const schedule = getScheduleRowRaw(id);
  if (!schedule) return null;
  return fireScheduleOccurrence(schedule, Date.now());
}

async function retryPendingDeliveries(): Promise<void> {
  const now = Date.now();
  let pending = listPending();

  const expired = pending.filter((d) => d.validUntil < now);
  for (const d of expired) {
    markExpired(d.id);
    pushOscLog({
      from: "scheduler",
      address: "/lectern/schedule/expired",
      args: [d.scheduleId, d.deviceId],
      ok: false,
      detail: `a queued retry expired before the lectern came back online`,
    });
  }
  pending = pending.filter((d) => d.validUntil >= now);

  const byDevice = new Map<string, ScheduledDelivery[]>();
  for (const d of pending) {
    const list = byDevice.get(d.deviceId) ?? [];
    list.push(d);
    byDevice.set(d.deviceId, list);
  }

  for (const [deviceId, rows] of byDevice) {
    const device = getDevice(deviceId);
    const deviceName = device?.name ?? deviceId;
    if (!device) {
      for (const r of rows) markCancelled(r.id);
      continue;
    }

    const health = await checkDeviceHealth(device.host);
    if (!(health.network.ok && health.app.ok)) continue;

    const scheduleIds = [...new Set(rows.map((r) => r.scheduleId))];
    for (const scheduleId of scheduleIds) {
      const schedule = getScheduleRowRaw(scheduleId);
      const scheduleRows = rows.filter((r) => r.scheduleId === scheduleId);

      if (!schedule || schedule.enabled === 0) {
        for (const r of scheduleRows) markCancelled(r.id);
        continue;
      }

      const newest = scheduleRows.reduce((a, b) => (a.occurrenceAt > b.occurrenceAt ? a : b));
      const stale = scheduleRows.filter((r) => r.id !== newest.id);
      if (stale.length > 0) markSuperseded(stale.map((r) => r.id));

      const presetName = getPreset(schedule.preset_id)?.name ?? schedule.preset_id;
      const result = (await pushPresetToDevices(schedule.preset_id, [deviceId]))?.[0];
      if (result?.ok) {
        markSent(newest.id);
        pushOscLog({
          from: "scheduler",
          address: "/lectern/schedule/sent",
          args: [schedule.name, deviceName],
          ok: true,
          detail: `retried and delivered "${presetName}" to "${deviceName}" for schedule "${schedule.name}" now that it's back online`,
        });
      } else {
        markFailedPending(newest.id, newest.attempts, result?.message ?? "Retry failed");
      }
    }
  }
}
