import crypto from "node:crypto";
import {
  deleteOscTargetRow,
  getOscTargetRow,
  insertOscTargetRow,
  listOscTargetRows,
  OscTargetRow,
  updateOscTargetRow,
} from "./db";
import { OscTarget } from "@/lib/opal/types";

function toSummary(row: OscTargetRow): OscTarget {
  return { id: row.id, name: row.name, host: row.host, port: row.port, createdAt: row.created_at };
}

export function listOscTargets(): OscTarget[] {
  return listOscTargetRows().map(toSummary);
}

export function createOscTarget(name: string, host: string, port: number): OscTarget {
  const row: OscTargetRow = { id: crypto.randomUUID(), name, host, port, created_at: Date.now() };
  insertOscTargetRow(row);
  return toSummary(row);
}

export function updateOscTarget(id: string, updates: { name?: string; host?: string; port?: number }): OscTarget | null {
  const row = getOscTargetRow(id);
  if (!row) return null;
  updateOscTargetRow(id, updates);
  return toSummary({ ...row, ...updates });
}

export function deleteOscTarget(id: string): boolean {
  const row = getOscTargetRow(id);
  if (!row) return false;
  deleteOscTargetRow(id);
  return true;
}
