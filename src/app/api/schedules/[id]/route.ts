import { NextResponse } from "next/server";
import { deleteSchedule, updateSchedule } from "@/lib/server/schedules";
import { getPreset } from "@/lib/server/presets";
import { getDevice } from "@/lib/server/devices";
import { validatePatchInput } from "../validate";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const validated = validatePatchInput(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const updates = validated.value;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  if (updates.presetId !== undefined && !getPreset(updates.presetId)) {
    return NextResponse.json({ error: "Preset not found" }, { status: 400 });
  }
  if (updates.deviceIds !== undefined) {
    for (const deviceId of updates.deviceIds) {
      if (!getDevice(deviceId)) {
        return NextResponse.json({ error: "Device not found" }, { status: 400 });
      }
    }
  }

  const schedule = updateSchedule(id, updates);
  if (!schedule) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(schedule);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = deleteSchedule(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
