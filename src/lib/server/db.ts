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
