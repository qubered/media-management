import { NextResponse } from "next/server";
import { createSchedule, listSchedules } from "@/lib/server/schedules";
import { getPreset } from "@/lib/server/presets";
import { getDevice } from "@/lib/server/devices";
import { validateCreateInput } from "./validate";

export async function GET() {
  return NextResponse.json(listSchedules());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validated = validateCreateInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const input = validated.value;

  if (!getPreset(input.presetId)) {
    return NextResponse.json({ error: "Preset not found" }, { status: 400 });
  }
  for (const deviceId of input.deviceIds) {
    if (!getDevice(deviceId)) {
      return NextResponse.json({ error: "Device not found" }, { status: 400 });
    }
  }

  const schedule = createSchedule(input);
  if (!schedule) {
    return NextResponse.json({ error: "Recurrence never occurs within the active window" }, { status: 400 });
  }
  return NextResponse.json(schedule, { status: 201 });
}
