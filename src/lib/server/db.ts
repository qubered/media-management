import Database from "better-sqlite3";
import fs from "node:fs";
import { DATA_DIR, DB_PATH } from "./paths";
import { MediaKind } from "@/lib/opal/types";

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    extension TEXT NOT NULL,
    media_hash TEXT NOT NULL,
    thumbnail_base64 TEXT NOT NULL,
    preview_data_url TEXT NOT NULL,
    ephemeral INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS osc_targets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS osc_log (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    from_addr TEXT NOT NULL,
    address TEXT NOT NULL,
    args TEXT NOT NULL,
    ok INTEGER NOT NULL,
    detail TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS schedules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    preset_id TEXT NOT NULL,
    device_ids TEXT NOT NULL,
    recurrence_type TEXT NOT NULL,
    run_at INTEGER,
    time_of_day TEXT,
    days_of_week TEXT,
    day_of_month INTEGER,
    interval_minutes INTEGER,
    duration_minutes INTEGER,
    grace_minutes INTEGER NOT NULL DEFAULT 15,
    active_from INTEGER,
    active_until INTEGER,
    next_run_at INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS scheduled_deliveries (
    id TEXT PRIMARY KEY,
    schedule_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    occurrence_at INTEGER NOT NULL,
    valid_until INTEGER NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER,
    last_error TEXT,
    created_at INTEGER NOT NULL
  )
`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules (enabled, next_run_at)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_deliveries_status_device ON scheduled_deliveries (status, device_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_deliveries_schedule ON scheduled_deliveries (schedule_id)`);

/** Lightweight migrations — ALTER TABLE ADD COLUMN throws if the column already exists, which we just ignore. */
function migrate(sql: string) {
  try {
    db.exec(sql);
  } catch {
    // already migrated
  }
}
migrate("ALTER TABLE presets ADD COLUMN background_color TEXT NOT NULL DEFAULT '#ff000000'");
migrate("ALTER TABLE presets ADD COLUMN source_hash TEXT");
migrate("ALTER TABLE presets ADD COLUMN source_extension TEXT");
migrate("ALTER TABLE presets ADD COLUMN source_mime_type TEXT");
migrate("ALTER TABLE presets ADD COLUMN crop_x REAL");
migrate("ALTER TABLE presets ADD COLUMN crop_y REAL");
migrate("ALTER TABLE presets ADD COLUMN crop_width REAL");
migrate("ALTER TABLE presets ADD COLUMN crop_height REAL");
migrate("ALTER TABLE presets ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0");

export interface PresetRow {
  id: string;
  name: string;
  kind: MediaKind;
  extension: "png" | "mp4";
  media_hash: string;
  thumbnail_base64: string;
  preview_data_url: string;
  background_color: string;
  /** The original, unprocessed upload — kept so "Edit" can re-crop without any quality/content loss from a prior crop. Null for presets created before this existed. */
  source_hash: string | null;
  source_extension: string | null;
  source_mime_type: string | null;
  crop_x: number | null;
  crop_y: number | null;
  crop_width: number | null;
  crop_height: number | null;
  ephemeral: number;
  pinned: number;
  created_at: number;
}

export function listPresetRows(): PresetRow[] {
  return db
    .prepare("SELECT * FROM presets WHERE ephemeral = 0 ORDER BY pinned DESC, created_at DESC")
    .all() as PresetRow[];
}

export function getPresetRow(id: string): PresetRow | undefined {
  return db.prepare("SELECT * FROM presets WHERE id = ?").get(id) as PresetRow | undefined;
}

export function insertPresetRow(row: PresetRow): void {
  db.prepare(
    `INSERT INTO presets (
       id, name, kind, extension, media_hash, thumbnail_base64, preview_data_url, background_color,
       source_hash, source_extension, source_mime_type, crop_x, crop_y, crop_width, crop_height,
       ephemeral, pinned, created_at
     )
     VALUES (
       @id, @name, @kind, @extension, @media_hash, @thumbnail_base64, @preview_data_url, @background_color,
       @source_hash, @source_extension, @source_mime_type, @crop_x, @crop_y, @crop_width, @crop_height,
       @ephemeral, @pinned, @created_at
     )`,
  ).run(row);
}

export function updatePresetRow(id: string, updates: { name?: string; ephemeral?: boolean; pinned?: boolean }): void {
  if (updates.name !== undefined) {
    db.prepare("UPDATE presets SET name = ? WHERE id = ?").run(updates.name, id);
  }
  if (updates.ephemeral !== undefined) {
    db.prepare("UPDATE presets SET ephemeral = ? WHERE id = ?").run(updates.ephemeral ? 1 : 0, id);
  }
  if (updates.pinned !== undefined) {
    db.prepare("UPDATE presets SET pinned = ? WHERE id = ?").run(updates.pinned ? 1 : 0, id);
  }
}

export function updatePresetMediaRow(
  id: string,
  updates: {
    media_hash: string;
    thumbnail_base64: string;
    preview_data_url: string;
    background_color: string;
    crop_x: number | null;
    crop_y: number | null;
    crop_width: number | null;
    crop_height: number | null;
  },
): void {
  db.prepare(
    `UPDATE presets
     SET media_hash = @media_hash, thumbnail_base64 = @thumbnail_base64, preview_data_url = @preview_data_url,
         background_color = @background_color, crop_x = @crop_x, crop_y = @crop_y,
         crop_width = @crop_width, crop_height = @crop_height
     WHERE id = @id`,
  ).run({ id, ...updates });
}

export function deletePresetRow(id: string): void {
  db.prepare("DELETE FROM presets WHERE id = ?").run(id);
}

export function countPresetsByMediaHash(hash: string): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM presets WHERE media_hash = ?").get(hash) as { n: number };
  return row.n;
}

export function countPresetsBySourceHash(hash: string): number {
  const row = db.prepare("SELECT COUNT(*) as n FROM presets WHERE source_hash = ?").get(hash) as { n: number };
  return row.n;
}

/** Ephemeral rows (quick-build one-offs) older than a day are swept on startup so they don't accumulate forever. */
export function sweepStaleEphemeralPresets(maxAgeMs: number): PresetRow[] {
  const cutoff = Date.now() - maxAgeMs;
  const stale = db.prepare("SELECT * FROM presets WHERE ephemeral = 1 AND created_at < ?").all(cutoff) as PresetRow[];
  db.prepare("DELETE FROM presets WHERE ephemeral = 1 AND created_at < ?").run(cutoff);
  return stale;
}

export interface DeviceRow {
  id: string;
  name: string;
  host: string;
  created_at: number;
}

export function listDeviceRows(): DeviceRow[] {
  return db.prepare("SELECT * FROM devices ORDER BY created_at ASC").all() as DeviceRow[];
}

export function getDeviceRow(id: string): DeviceRow | undefined {
  return db.prepare("SELECT * FROM devices WHERE id = ?").get(id) as DeviceRow | undefined;
}

export function insertDeviceRow(row: DeviceRow): void {
  db.prepare("INSERT INTO devices (id, name, host, created_at) VALUES (@id, @name, @host, @created_at)").run(row);
}

export function updateDeviceRow(id: string, updates: { name?: string; host?: string }): void {
  if (updates.name !== undefined) {
    db.prepare("UPDATE devices SET name = ? WHERE id = ?").run(updates.name, id);
  }
  if (updates.host !== undefined) {
    db.prepare("UPDATE devices SET host = ? WHERE id = ?").run(updates.host, id);
  }
}

export function deleteDeviceRow(id: string): void {
  db.prepare("DELETE FROM devices WHERE id = ?").run(id);
}

export interface OscTargetRow {
  id: string;
  name: string;
  host: string;
  port: number;
  created_at: number;
}

export function listOscTargetRows(): OscTargetRow[] {
  return db.prepare("SELECT * FROM osc_targets ORDER BY created_at ASC").all() as OscTargetRow[];
}

export function getOscTargetRow(id: string): OscTargetRow | undefined {
  return db.prepare("SELECT * FROM osc_targets WHERE id = ?").get(id) as OscTargetRow | undefined;
}

export function insertOscTargetRow(row: OscTargetRow): void {
  db.prepare("INSERT INTO osc_targets (id, name, host, port, created_at) VALUES (@id, @name, @host, @port, @created_at)").run(
    row,
  );
}

export function updateOscTargetRow(id: string, updates: { name?: string; host?: string; port?: number }): void {
  if (updates.name !== undefined) {
    db.prepare("UPDATE osc_targets SET name = ? WHERE id = ?").run(updates.name, id);
  }
  if (updates.host !== undefined) {
    db.prepare("UPDATE osc_targets SET host = ? WHERE id = ?").run(updates.host, id);
  }
  if (updates.port !== undefined) {
    db.prepare("UPDATE osc_targets SET port = ? WHERE id = ?").run(updates.port, id);
  }
}

export function deleteOscTargetRow(id: string): void {
  db.prepare("DELETE FROM osc_targets WHERE id = ?").run(id);
}

export interface OscLogRow {
  id: string;
  timestamp: number;
  from_addr: string;
  address: string;
  args: string;
  ok: number;
  detail: string;
}

const OSC_LOG_MAX_ROWS = 200;

/** Inserts a log row and trims the table back down to the most recent OSC_LOG_MAX_ROWS entries. */
export function insertOscLogRow(row: OscLogRow): void {
  db.prepare(
    "INSERT INTO osc_log (id, timestamp, from_addr, address, args, ok, detail) VALUES (@id, @timestamp, @from_addr, @address, @args, @ok, @detail)",
  ).run(row);
  db.prepare(
    `DELETE FROM osc_log WHERE id NOT IN (SELECT id FROM osc_log ORDER BY timestamp DESC LIMIT ${OSC_LOG_MAX_ROWS})`,
  ).run();
}

export function listOscLogRows(): OscLogRow[] {
  return db.prepare(`SELECT * FROM osc_log ORDER BY timestamp DESC LIMIT ${OSC_LOG_MAX_ROWS}`).all() as OscLogRow[];
}

export function clearOscLogRows(): void {
  db.exec("DELETE FROM osc_log");
}

export interface ScheduleRow {
  id: string;
  name: string;
  preset_id: string;
  device_ids: string;
  recurrence_type: "once" | "daily" | "weekly" | "monthly" | "interval";
  run_at: number | null;
  time_of_day: string | null;
  days_of_week: string | null;
  day_of_month: number | null;
  interval_minutes: number | null;
  duration_minutes: number | null;
  grace_minutes: number;
  active_from: number | null;
  active_until: number | null;
  next_run_at: number;
  enabled: number;
  last_run_at: number | null;
  created_at: number;
  updated_at: number;
}

export function listScheduleRows(): ScheduleRow[] {
  return db.prepare("SELECT * FROM schedules ORDER BY created_at ASC").all() as ScheduleRow[];
}

export function getScheduleRow(id: string): ScheduleRow | undefined {
  return db.prepare("SELECT * FROM schedules WHERE id = ?").get(id) as ScheduleRow | undefined;
}

/** What the scheduler's fire-job polls each tick. */
export function listDueScheduleRows(now: number): ScheduleRow[] {
  return db.prepare("SELECT * FROM schedules WHERE enabled = 1 AND next_run_at <= ?").all(now) as ScheduleRow[];
}

export function insertScheduleRow(row: ScheduleRow): void {
  db.prepare(
    `INSERT INTO schedules (
       id, name, preset_id, device_ids, recurrence_type, run_at, time_of_day, days_of_week, day_of_month,
       interval_minutes, duration_minutes, grace_minutes, active_from, active_until, next_run_at, enabled,
       last_run_at, created_at, updated_at
     )
     VALUES (
       @id, @name, @preset_id, @device_ids, @recurrence_type, @run_at, @time_of_day, @days_of_week, @day_of_month,
       @interval_minutes, @duration_minutes, @grace_minutes, @active_from, @active_until, @next_run_at, @enabled,
       @last_run_at, @created_at, @updated_at
     )`,
  ).run(row);
}

/** Partial update — only keys present in `updates` are written. Schedules have ~13 optional-on-edit columns, so a dynamic SET clause beats one `if` per field. */
export function updateScheduleRow(id: string, updates: Partial<Omit<ScheduleRow, "id" | "created_at">>): void {
  const fields = Object.keys(updates) as (keyof typeof updates)[];
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE schedules SET ${setClause} WHERE id = @id`).run({ id, ...updates });
}

export function deleteScheduleRow(id: string): void {
  db.prepare("DELETE FROM schedules WHERE id = ?").run(id);
}

export interface ScheduledDeliveryRow {
  id: string;
  schedule_id: string;
  device_id: string;
  occurrence_at: number;
  valid_until: number;
  status: "pending" | "sent" | "superseded" | "cancelled" | "expired";
  attempts: number;
  last_attempt_at: number | null;
  last_error: string | null;
  created_at: number;
}

export function insertScheduledDeliveryRow(row: ScheduledDeliveryRow): void {
  db.prepare(
    `INSERT INTO scheduled_deliveries (
       id, schedule_id, device_id, occurrence_at, valid_until, status, attempts, last_attempt_at, last_error, created_at
     ) VALUES (@id, @schedule_id, @device_id, @occurrence_at, @valid_until, @status, @attempts, @last_attempt_at, @last_error, @created_at)`,
  ).run(row);
}

export function listPendingDeliveryRows(): ScheduledDeliveryRow[] {
  return db.prepare("SELECT * FROM scheduled_deliveries WHERE status = 'pending'").all() as ScheduledDeliveryRow[];
}

/** For the UI's per-schedule status chip — every delivery row for the given schedules, most recent occurrence first. */
export function listDeliveryRowsForSchedules(scheduleIds: string[]): ScheduledDeliveryRow[] {
  if (scheduleIds.length === 0) return [];
  const placeholders = scheduleIds.map(() => "?").join(",");
  return db
    .prepare(`SELECT * FROM scheduled_deliveries WHERE schedule_id IN (${placeholders}) ORDER BY occurrence_at DESC`)
    .all(...scheduleIds) as ScheduledDeliveryRow[];
}

export function updateScheduledDeliveryRow(
  id: string,
  updates: Partial<Pick<ScheduledDeliveryRow, "status" | "attempts" | "last_attempt_at" | "last_error">>,
): void {
  const fields = Object.keys(updates) as (keyof typeof updates)[];
  if (fields.length === 0) return;
  const setClause = fields.map((f) => `${f} = @${f}`).join(", ");
  db.prepare(`UPDATE scheduled_deliveries SET ${setClause} WHERE id = @id`).run({ id, ...updates });
}

/** Bulk status flip — used to expire everything past `valid_until` and to supersede stale rows for a schedule+device. */
export function markScheduledDeliveryRowsStatus(ids: string[], status: ScheduledDeliveryRow["status"]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE scheduled_deliveries SET status = ? WHERE id IN (${placeholders})`).run(status, ...ids);
}

export function deleteScheduledDeliveryRowsForSchedule(scheduleId: string): void {
  db.prepare("DELETE FROM scheduled_deliveries WHERE schedule_id = ?").run(scheduleId);
}
