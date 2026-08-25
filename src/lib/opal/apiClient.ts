import {
  CropRect,
  DeviceHealth,
  LecternDevice,
  OscLogEntry,
  OscTarget,
  PresetSummary,
  Schedule,
  ScheduledDelivery,
  ScheduleInput,
  SendResult,
} from "./types";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export async function listPresets(): Promise<PresetSummary[]> {
  const res = await fetch("/api/presets", { cache: "no-store" });
  return unwrap(res);
}

export async function createPreset(
  file: File,
  options: { name?: string; ephemeral?: boolean; crop?: CropRect; backgroundColor?: string } = {},
): Promise<PresetSummary> {
  const form = new FormData();
  form.append("file", file);
  if (options.name) form.append("name", options.name);
  if (options.ephemeral) form.append("ephemeral", "true");
  if (options.crop) {
    form.append("cropX", String(options.crop.x));
    form.append("cropY", String(options.crop.y));
    form.append("cropWidth", String(options.crop.width));
    form.append("cropHeight", String(options.crop.height));
  }
  if (options.backgroundColor) form.append("backgroundColor", options.backgroundColor);

  const res = await fetch("/api/presets", { method: "POST", body: form });
  return unwrap(res);
}

export async function updatePreset(
  id: string,
  updates: { name?: string; ephemeral?: boolean; pinned?: boolean },
): Promise<PresetSummary> {
  const res = await fetch(`/api/presets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return unwrap(res);
}

export async function deletePreset(id: string): Promise<void> {
  const res = await fetch(`/api/presets/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete preset (${res.status})`);
  }
}

export function downloadUrl(id: string): string {
  return `/api/presets/${id}/download`;
}

export async function fetchPresetSource(id: string): Promise<File> {
  const res = await fetch(`/api/presets/${id}/source`);
  if (!res.ok) throw new Error(`Failed to load original file (${res.status})`);
  const blob = await res.blob();
  return new File([blob], "source", { type: blob.type });
}

export async function importConfigZip(file: File): Promise<PresetSummary> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/presets/import", { method: "POST", body: form });
  return unwrap(res);
}

export async function recropPreset(id: string, crop: CropRect, backgroundColor: string): Promise<PresetSummary> {
  const res = await fetch(`/api/presets/${id}/recrop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ crop, backgroundColor }),
  });
  return unwrap(res);
}

export async function listDevices(): Promise<LecternDevice[]> {
  const res = await fetch("/api/devices", { cache: "no-store" });
  return unwrap(res);
}

export async function createDevice(name: string, host: string): Promise<LecternDevice> {
  const res = await fetch("/api/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, host }),
  });
  return unwrap(res);
}

export async function updateDevice(id: string, updates: { name?: string; host?: string }): Promise<LecternDevice> {
  const res = await fetch(`/api/devices/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return unwrap(res);
}

export async function deleteDevice(id: string): Promise<void> {
  const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete device (${res.status})`);
  }
}

export async function checkDeviceHealth(id: string): Promise<DeviceHealth> {
  const res = await fetch(`/api/devices/${id}/health`, { cache: "no-store" });
  return unwrap(res);
}

export async function sendPresetToDevices(presetId: string, deviceIds: string[]): Promise<SendResult[]> {
  const res = await fetch(`/api/presets/${presetId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceIds }),
  });
  const body = await unwrap<{ results: SendResult[] }>(res);
  return body.results;
}

export async function listOscTargets(): Promise<OscTarget[]> {
  const res = await fetch("/api/osc-targets", { cache: "no-store" });
  return unwrap(res);
}

export async function createOscTarget(name: string, host: string, port: number): Promise<OscTarget> {
  const res = await fetch("/api/osc-targets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, host, port }),
  });
  return unwrap(res);
}

export async function updateOscTarget(
  id: string,
  updates: { name?: string; host?: string; port?: number },
): Promise<OscTarget> {
  const res = await fetch(`/api/osc-targets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return unwrap(res);
}

export async function deleteOscTarget(id: string): Promise<void> {
  const res = await fetch(`/api/osc-targets/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete OSC target (${res.status})`);
  }
}

export async function getOscInfo(): Promise<{ listenPort: number }> {
  const res = await fetch("/api/osc/info", { cache: "no-store" });
  return unwrap(res);
}

export async function getOscLog(): Promise<OscLogEntry[]> {
  const res = await fetch("/api/osc/log", { cache: "no-store" });
  return unwrap(res);
}

export async function clearOscLog(): Promise<void> {
  await fetch("/api/osc/log", { method: "DELETE" });
}

export async function listSchedules(): Promise<Schedule[]> {
  const res = await fetch("/api/schedules", { cache: "no-store" });
  return unwrap(res);
}

export async function createSchedule(input: ScheduleInput): Promise<Schedule> {
  const res = await fetch("/api/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return unwrap(res);
}

export async function updateSchedule(id: string, updates: Partial<ScheduleInput>): Promise<Schedule> {
  const res = await fetch(`/api/schedules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return unwrap(res);
}

export async function deleteSchedule(id: string): Promise<void> {
  const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete schedule (${res.status})`);
  }
}

export async function listScheduledDeliveries(scheduleIds: string[]): Promise<ScheduledDelivery[]> {
  if (scheduleIds.length === 0) return [];
  const res = await fetch(`/api/schedules/deliveries?scheduleIds=${scheduleIds.join(",")}`, { cache: "no-store" });
  return unwrap(res);
}

export async function triggerSchedule(id: string): Promise<SendResult[]> {
  const res = await fetch(`/api/schedules/${id}/trigger`, { method: "POST" });
  const body = await unwrap<{ results: SendResult[] }>(res);
  return body.results;
}
