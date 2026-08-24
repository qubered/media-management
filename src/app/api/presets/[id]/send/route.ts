import { NextResponse } from "next/server";
import { pushPresetToDevices } from "@/lib/server/pushPreset";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds.filter((d: unknown) => typeof d === "string") : [];

  if (deviceIds.length === 0) {
    return NextResponse.json({ error: "No devices selected" }, { status: 400 });
  }

  const results = await pushPresetToDevices(id, deviceIds);
  if (!results) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  return NextResponse.json({ results });
}
