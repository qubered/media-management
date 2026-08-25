import { RecurrenceType } from "./types";

/**
 * Pure date-math for schedule recurrence — no DB, no server-only imports, so it can be shared between
 * `src/lib/server/schedules.ts` (to persist `nextRunAt`) and the schedule form's live occurrence preview.
 * Uses `Date`'s local-time setters rather than raw millisecond arithmetic so occurrences don't drift
 * across DST transitions.
 */
export interface RecurrenceFields {
  recurrenceType: RecurrenceType;
  runAt: number | null;
  timeOfDay: string | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  intervalMinutes: number | null;
  activeFrom: number | null;
  activeUntil: number | null;
}

function parseTimeOfDay(timeOfDay: string): { h: number; m: number } {
  const [h, m] = timeOfDay.split(":").map(Number);
  return { h, m };
}

/** Day 0 of next month = the last day of this month. */
function clampDayOfMonth(year: number, month0: number, day: number): number {
  const lastDay = new Date(year, month0 + 1, 0).getDate();
  return Math.min(day, lastDay);
}

/** First daily occurrence strictly after `from`. */
function nextDailyAt(from: Date, timeOfDay: string): Date {
  const { h, m } = parseTimeOfDay(timeOfDay);
  const candidate = new Date(from);
  candidate.setHours(h, m, 0, 0);
  if (candidate.getTime() <= from.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

/** First weekly occurrence (on one of daysOfWeek) strictly after `from`. Scans up to 7 days so it wraps correctly. */
function nextWeeklyAt(from: Date, daysOfWeek: number[], timeOfDay: string): Date {
  const { h, m } = parseTimeOfDay(timeOfDay);
  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + offset);
    candidate.setHours(h, m, 0, 0);
    if (daysOfWeek.includes(candidate.getDay()) && candidate.getTime() > from.getTime()) return candidate;
  }
  throw new Error("daysOfWeek must be non-empty");
}

/** First monthly occurrence (on dayOfMonth, clamped to the shorter month) strictly after `from`. */
function nextMonthlyAt(from: Date, dayOfMonth: number, timeOfDay: string): Date {
  const { h, m } = parseTimeOfDay(timeOfDay);
  const thisMonthDay = clampDayOfMonth(from.getFullYear(), from.getMonth(), dayOfMonth);
  let candidate = new Date(from.getFullYear(), from.getMonth(), thisMonthDay, h, m, 0, 0);
  if (candidate.getTime() <= from.getTime()) {
    // Date's month arg normalizes overflow (month=12 -> Jan of next year), so this is safe across year boundaries.
    const nextMonthDay = clampDayOfMonth(from.getFullYear(), from.getMonth() + 1, dayOfMonth);
    candidate = new Date(from.getFullYear(), from.getMonth() + 1, nextMonthDay, h, m, 0, 0);
  }
  return candidate;
}

/** Next occurrence after `occurrenceAt`, fast-forwarding past any missed intervals in one jump rather than one tick at a time. */
function advanceInterval(occurrenceAt: number, intervalMinutes: number, now: number): number {
  const stepMs = intervalMinutes * 60_000;
  let next = occurrenceAt + stepMs;
  if (next <= now) {
    const missed = Math.ceil((now - next) / stepMs);
    next += missed * stepMs;
  }
  return next;
}

/** Returns null when the candidate falls after `activeUntil` — the schedule never fires again in-window. */
function clampToActiveWindow(candidate: number, activeUntil: number | null): number | null {
  if (activeUntil !== null && candidate > activeUntil) return null;
  return candidate;
}

/** First `next_run_at` for a newly created (or edited) schedule. `once` ignores active-window bounds — a single explicit `runAt` is its own bound. Returns null if the recurrence can never fire within its active window. */
export function computeInitialNextRunAt(f: RecurrenceFields, now: number): number | null {
  if (f.recurrenceType === "once") {
    return f.runAt !== null && f.runAt > 0 ? f.runAt : null;
  }

  const anchor = f.activeFrom !== null && f.activeFrom > now ? f.activeFrom : now;
  let candidate: number;
  switch (f.recurrenceType) {
    case "daily":
      candidate = nextDailyAt(new Date(anchor), f.timeOfDay!).getTime();
      break;
    case "weekly":
      candidate = nextWeeklyAt(new Date(anchor), f.daysOfWeek!, f.timeOfDay!).getTime();
      break;
    case "monthly":
      candidate = nextMonthlyAt(new Date(anchor), f.dayOfMonth!, f.timeOfDay!).getTime();
      break;
    case "interval":
      candidate = anchor + f.intervalMinutes! * 60_000;
      break;
  }
  return clampToActiveWindow(candidate, f.activeUntil);
}

/**
 * Called right after a schedule fires, anchored on the occurrence that just fired (not `now`) so recurrence
 * never drifts under processing delay. Returns null => caller should disable the schedule (`once`, or the
 * next occurrence would fall past `activeUntil`).
 */
export function computeNextRunAfterFire(f: RecurrenceFields, occurrenceAt: number, now: number): number | null {
  if (f.recurrenceType === "once") return null;

  let candidate: number;
  switch (f.recurrenceType) {
    case "daily":
      candidate = nextDailyAt(new Date(occurrenceAt), f.timeOfDay!).getTime();
      break;
    case "weekly":
      candidate = nextWeeklyAt(new Date(occurrenceAt), f.daysOfWeek!, f.timeOfDay!).getTime();
      break;
    case "monthly":
      candidate = nextMonthlyAt(new Date(occurrenceAt), f.dayOfMonth!, f.timeOfDay!).getTime();
      break;
    case "interval":
      candidate = advanceInterval(occurrenceAt, f.intervalMinutes!, now);
      break;
  }
  return clampToActiveWindow(candidate, f.activeUntil);
}

/** `validUntil` for an occurrence — the retry window: an explicit duration if set, else the grace period. */
export function computeOccurrenceWindow(
  f: { durationMinutes: number | null; graceMinutes: number },
  occurrenceAt: number,
): { validUntil: number } {
  const windowMinutes = f.durationMinutes ?? f.graceMinutes;
  return { validUntil: occurrenceAt + windowMinutes * 60_000 };
}

/** Up to `count` upcoming occurrences, for the form's live preview. Stops early if the recurrence ends (returns null). */
export function previewOccurrences(f: RecurrenceFields, now: number, count: number): number[] {
  const first = computeInitialNextRunAt(f, now);
  if (first === null) return [];

  const occurrences = [first];
  let prev = first;
  while (occurrences.length < count) {
    const next = computeNextRunAfterFire(f, prev, prev);
    if (next === null) break;
    occurrences.push(next);
    prev = next;
  }
  return occurrences;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatTimeOfDay(timeOfDay: string): string {
  const { h, m } = parseTimeOfDay(timeOfDay);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} hour${hours === 1 ? "" : "s"}` : `${minutes} min`;
}

/** A plain-English sentence describing the recurrence — shared by the form's live summary and the table's recurrence column. */
export function summarizeRecurrence(f: RecurrenceFields & { durationMinutes: number | null; graceMinutes: number }): string {
  let when: string;
  switch (f.recurrenceType) {
    case "once":
      when = f.runAt ? `Runs once on ${new Date(f.runAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Runs once";
      break;
    case "daily":
      when = `Runs every day at ${formatTimeOfDay(f.timeOfDay!)}`;
      break;
    case "weekly": {
      const days = (f.daysOfWeek ?? []).slice().sort().map((d) => DAY_NAMES[d]).join(", ");
      when = `Runs every ${days} at ${formatTimeOfDay(f.timeOfDay!)}`;
      break;
    }
    case "monthly":
      when = `Runs on day ${f.dayOfMonth} of every month at ${formatTimeOfDay(f.timeOfDay!)}`;
      break;
    case "interval":
      when = `Runs every ${formatDuration(f.intervalMinutes!)}`;
      break;
  }

  const retry = f.durationMinutes
    ? `Retries anywhere in its ${formatDuration(f.durationMinutes)} window if the lectern is offline.`
    : `Retries for ${formatDuration(f.graceMinutes)} if the lectern is offline.`;

  return `${when}. ${retry}`;
}
