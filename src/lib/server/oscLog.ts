import crypto from "node:crypto";
import { clearOscLogRows, insertOscLogRow, listOscLogRows } from "./db";
import { OscLogEntry } from "@/lib/opal/types";

/**
 * Records every incoming OSC message, valid or not. Backed by SQLite (not an in-memory array) because
 * the instrumentation-hosted OSC server and the API routes that read this back don't reliably share a
 * module instance under Turbopack's dev bundler — the same reason devices/presets live in the DB too.
 */
export function pushOscLog(entry: Omit<OscLogEntry, "id" | "timestamp">): void {
  insertOscLogRow({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    from_addr: entry.from,
    address: entry.address,
    args: JSON.stringify(entry.args),
    ok: entry.ok ? 1 : 0,
    detail: entry.detail,
  });
}

export function getOscLog(): OscLogEntry[] {
  return listOscLogRows().map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    from: row.from_addr,
    address: row.address,
    args: JSON.parse(row.args) as string[],
    ok: row.ok === 1,
    detail: row.detail,
  }));
}

export function clearOscLog(): void {
  clearOscLogRows();
}
