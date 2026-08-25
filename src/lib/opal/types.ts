export type MediaKind = "image" | "video";

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1920;

export interface DisplaySettings {
  width: number;
  height: number;
  timeZone: string;
  soundLevel: number;
  /** #AARRGGBB, matching the .NET-style hex color found in the vendor samples */
  backgroundColorArgb: string;
  levels: number[];
  notes: string;
  defaultLanguage: string;
}

export function defaultSettings(): DisplaySettings {
  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    soundLevel: 100,
    backgroundColorArgb: "#ff000000",
    levels: Array.from({ length: 12 }, (_, i) => i + 1),
    notes: "",
    defaultLanguage: "English",
  };
}

/** A crop window expressed as fractions (0..1) of the source media's natural width/height, always at a 9:16 aspect ratio. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MediaAsset {
  kind: MediaKind;
  hash: string;
  extension: "png" | "mp4";
}

/** What the client sees over the API — never includes raw media bytes, those stay server-side. */
export interface PresetSummary {
  id: string;
  name: string;
  kind: MediaKind;
  extension: "png" | "mp4";
  previewDataUrl: string;
  createdAt: number;
  /** #RRGGBB, for re-populating the crop editor's color picker when editing */
  backgroundColorRgb: string;
  /** The crop last used to produce this preset, if known — absent for presets made before editing existed, or created via the API without one. */
  crop?: CropRect;
  /** Present only when the original upload is still available server-side, i.e. this preset can be re-edited. */
  editable: boolean;
  pinned: boolean;
}

/** A physical lectern display registered on the venue network, as a send target. */
export interface LecternDevice {
  id: string;
  name: string;
  host: string;
  createdAt: number;
}

export interface SendResult {
  deviceId: string;
  ok: boolean;
  message: string;
}

/** Result of checking a lectern in two layers, without pushing anything: is the tablet up on the network, and separately, is the player app on it responding. */
export interface DeviceHealth {
  network: { ok: boolean; message: string };
  app: { ok: boolean; message: string; status?: string };
}

/** Where this app sends OSC feedback — typically Companion's own "Listen for OSC" port. */
export interface OscTarget {
  id: string;
  name: string;
  host: string;
  port: number;
  createdAt: number;
}

/** One incoming OSC message, valid or not — for the live activity log. */
export interface OscLogEntry {
  id: string;
  timestamp: number;
  from: string;
  address: string;
  args: string[];
  ok: boolean;
  detail: string;
}

export type RecurrenceType = "once" | "daily" | "weekly" | "monthly" | "interval";

/** A rule that pushes a preset to devices on a schedule, with offline-retry semantics. */
export interface Schedule {
  id: string;
  name: string;
  presetId: string;
  deviceIds: string[];
  recurrenceType: RecurrenceType;
  /** epoch ms — only for `once` */
  runAt: number | null;
  /** "HH:MM" — daily/weekly/monthly */
  timeOfDay: string | null;
  /** 0=Sun..6=Sat — weekly only */
  daysOfWeek: number[] | null;
  /** 1-31, clamped to the shorter month — monthly only */
  dayOfMonth: number | null;
  /** interval only */
  intervalMinutes: number | null;
  /** If set, defines an explicit content window [occurrence, occurrence+duration] that stays valid to retry into. If null, the occurrence is an instant trigger that falls back to `graceMinutes`. */
  durationMinutes: number | null;
  /** Retry window when `durationMinutes` is null. Default 15. */
  graceMinutes: number;
  /** Optional bounds so a recurring rule doesn't fire forever past a booking's date range. */
  activeFrom: number | null;
  activeUntil: number | null;
  /** epoch ms — precomputed, polled by the scheduler */
  nextRunAt: number;
  enabled: boolean;
  lastRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type ScheduledDeliveryStatus = "pending" | "sent" | "superseded" | "cancelled" | "expired";

/** One attempt (and its retries) to deliver a single schedule occurrence to a single device — the offline retry queue. */
export interface ScheduledDelivery {
  id: string;
  scheduleId: string;
  deviceId: string;
  occurrenceAt: number;
  validUntil: number;
  status: ScheduledDeliveryStatus;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  createdAt: number;
}

/** POST/PATCH body for a schedule — mirrors Schedule minus server-computed fields. */
export interface ScheduleInput {
  name: string;
  presetId: string;
  deviceIds: string[];
  recurrenceType: RecurrenceType;
  runAt?: number;
  timeOfDay?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  intervalMinutes?: number;
  durationMinutes?: number;
  graceMinutes?: number;
  activeFrom?: number;
  activeUntil?: number;
  enabled?: boolean;
}
