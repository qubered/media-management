import crypto from "node:crypto";
import { DeviceRow, deleteDeviceRow, getDeviceRow, insertDeviceRow, listDeviceRows, updateDeviceRow } from "./db";
import { LecternDevice } from "@/lib/opal/types";

function toSummary(row: DeviceRow): LecternDevice {
  return { id: row.id, name: row.name, host: row.host, createdAt: row.created_at };
}

export function listDevices(): LecternDevice[] {
  return listDeviceRows().map(toSummary);
}

export function createDevice(name: string, host: string): LecternDevice {
  const row: DeviceRow = { id: crypto.randomUUID(), name, host, created_at: Date.now() };
  insertDeviceRow(row);
  return toSummary(row);
}

export function updateDevice(id: string, updates: { name?: string; host?: string }): LecternDevice | null {
  const row = getDeviceRow(id);
  if (!row) return null;
  updateDeviceRow(id, updates);
  return toSummary({ ...row, ...updates });
}

export function deleteDevice(id: string): boolean {
  const row = getDeviceRow(id);
  if (!row) return false;
  deleteDeviceRow(id);
  return true;
}

export function getDevice(id: string): LecternDevice | null {
  const row = getDeviceRow(id);
  return row ? toSummary(row) : null;
}
