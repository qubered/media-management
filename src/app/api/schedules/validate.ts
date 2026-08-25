import { RecurrenceType, ScheduleInput } from "@/lib/opal/types";

const RECURRENCE_TYPES: RecurrenceType[] = ["once", "daily", "weekly", "monthly", "interval"];
const TIME_OF_DAY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isPositiveInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Validates the recurrence-type-specific fields present in `body`. Shared by create (all required) and patch (only what's present). */
function validateTypeFields(body: Record<string, unknown>, recurrenceType: RecurrenceType, requireAll: boolean): string | null {
  const has = (key: string) => body[key] !== undefined;

  if (recurrenceType === "once") {
    if ((requireAll || has("runAt")) && !isPositiveInt(body.runAt)) return "A valid runAt time is required for a one-time schedule";
  }
  if (recurrenceType === "daily" || recurrenceType === "weekly" || recurrenceType === "monthly") {
    if ((requireAll || has("timeOfDay")) && !(typeof body.timeOfDay === "string" && TIME_OF_DAY_RE.test(body.timeOfDay))) {
      return "A valid timeOfDay (HH:MM) is required";
    }
  }
  if (recurrenceType === "weekly") {
    if (requireAll || has("daysOfWeek")) {
      const days = body.daysOfWeek;
      if (!Array.isArray(days) || days.length === 0 || !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        return "daysOfWeek must be a non-empty array of 0-6";
      }
    }
  }
  if (recurrenceType === "monthly") {
    if ((requireAll || has("dayOfMonth")) && !(isPositiveInt(body.dayOfMonth) && (body.dayOfMonth as number) <= 31)) {
      return "dayOfMonth must be 1-31";
    }
  }
  if (recurrenceType === "interval") {
    if ((requireAll || has("intervalMinutes")) && !isPositiveInt(body.intervalMinutes)) {
      return "intervalMinutes must be a positive integer";
    }
  }
  return null;
}

function validateCommonFields(body: Record<string, unknown>): string | null {
  if (body.durationMinutes !== undefined && !isNonNegativeInt(body.durationMinutes)) {
    return "durationMinutes must be a non-negative integer";
  }
  if (body.graceMinutes !== undefined && !isNonNegativeInt(body.graceMinutes)) {
    return "graceMinutes must be a non-negative integer";
  }
  if (body.activeFrom !== undefined && !isPositiveInt(body.activeFrom)) return "activeFrom must be a valid epoch ms timestamp";
  if (body.activeUntil !== undefined && !isPositiveInt(body.activeUntil)) return "activeUntil must be a valid epoch ms timestamp";
  if (
    body.activeFrom !== undefined &&
    body.activeUntil !== undefined &&
    (body.activeFrom as number) >= (body.activeUntil as number)
  ) {
    return "activeFrom must be before activeUntil";
  }
  return null;
}

export function validateCreateInput(body: unknown): { error: string } | { value: ScheduleInput } {
  const b = (body ?? {}) as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  const presetId = typeof b.presetId === "string" ? b.presetId : "";
  const deviceIds = Array.isArray(b.deviceIds) ? b.deviceIds.filter((d): d is string => typeof d === "string") : [];
  const recurrenceType = typeof b.recurrenceType === "string" ? b.recurrenceType : "";

  if (!name || !presetId || deviceIds.length === 0) {
    return { error: "Name, preset, and at least one device are required" };
  }
  if (!RECURRENCE_TYPES.includes(recurrenceType as RecurrenceType)) {
    return { error: "Invalid recurrence type" };
  }

  const typeError = validateTypeFields(b, recurrenceType as RecurrenceType, true);
  if (typeError) return { error: typeError };

  const commonError = validateCommonFields(b);
  if (commonError) return { error: commonError };

  return {
    value: {
      name,
      presetId,
      deviceIds,
      recurrenceType: recurrenceType as RecurrenceType,
      runAt: b.runAt as number | undefined,
      timeOfDay: b.timeOfDay as string | undefined,
      daysOfWeek: b.daysOfWeek as number[] | undefined,
      dayOfMonth: b.dayOfMonth as number | undefined,
      intervalMinutes: b.intervalMinutes as number | undefined,
      durationMinutes: b.durationMinutes as number | undefined,
      graceMinutes: b.graceMinutes as number | undefined,
      activeFrom: b.activeFrom as number | undefined,
      activeUntil: b.activeUntil as number | undefined,
      enabled: b.enabled === false ? false : undefined,
    },
  };
}

export function validatePatchInput(body: unknown): { error: string } | { value: Partial<ScheduleInput> } {
  const b = (body ?? {}) as Record<string, unknown>;
  const value: Partial<ScheduleInput> = {};

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return { error: "Name cannot be empty" };
    value.name = name;
  }
  if (b.presetId !== undefined) {
    if (typeof b.presetId !== "string" || !b.presetId) return { error: "Invalid presetId" };
    value.presetId = b.presetId;
  }
  if (b.deviceIds !== undefined) {
    const deviceIds = Array.isArray(b.deviceIds) ? b.deviceIds.filter((d): d is string => typeof d === "string") : [];
    if (deviceIds.length === 0) return { error: "At least one device is required" };
    value.deviceIds = deviceIds;
  }
  if (b.recurrenceType !== undefined) {
    if (!RECURRENCE_TYPES.includes(b.recurrenceType as RecurrenceType)) return { error: "Invalid recurrence type" };
    value.recurrenceType = b.recurrenceType as RecurrenceType;
  }

  const effectiveType = (value.recurrenceType ?? (b.recurrenceType as RecurrenceType | undefined)) as RecurrenceType | undefined;
  if (effectiveType) {
    const typeError = validateTypeFields(b, effectiveType, false);
    if (typeError) return { error: typeError };
  }

  const commonError = validateCommonFields(b);
  if (commonError) return { error: commonError };

  if (b.runAt !== undefined) value.runAt = b.runAt as number;
  if (b.timeOfDay !== undefined) value.timeOfDay = b.timeOfDay as string;
  if (b.daysOfWeek !== undefined) value.daysOfWeek = b.daysOfWeek as number[];
  if (b.dayOfMonth !== undefined) value.dayOfMonth = b.dayOfMonth as number;
  if (b.intervalMinutes !== undefined) value.intervalMinutes = b.intervalMinutes as number;
  if (b.durationMinutes !== undefined) value.durationMinutes = b.durationMinutes as number;
  if (b.graceMinutes !== undefined) value.graceMinutes = b.graceMinutes as number;
  if (b.activeFrom !== undefined) value.activeFrom = b.activeFrom as number;
  if (b.activeUntil !== undefined) value.activeUntil = b.activeUntil as number;
  if (b.enabled !== undefined) value.enabled = Boolean(b.enabled);

  return { value };
}
