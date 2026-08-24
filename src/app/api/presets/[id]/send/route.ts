import { NextResponse } from "next/server";
import { buildConfigZipForPreset } from "@/lib/server/presets";
import { getDevice } from "@/lib/server/devices";
import { sendConfigZipToDevice } from "@/lib/server/send";
import { SendResult } from "@/lib/opal/types";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const deviceIds = Array.isArray(body?.deviceIds) ? body.deviceIds.filter((d: unknown) => typeof d === "string") : [];

  if (deviceIds.length === 0) {
    return NextResponse.json({ error: "No devices selected" }, { status: 400 });
  }

  const zip = await buildConfigZipForPreset(id);
  if (!zip) {
    return NextResponse.json({ error: "Preset not found" }, { status: 404 });
  }

  const results: SendResult[] = await Promise.all(
    deviceIds.map(async (deviceId: string): Promise<SendResult> => {
      const device = getDevice(deviceId);
      if (!device) return { deviceId, ok: false, message: "Device not found" };
      const result = await sendConfigZipToDevice(device.host, zip);
      return { deviceId, ...result };
    }),
  );

  return NextResponse.json({ results });
}
