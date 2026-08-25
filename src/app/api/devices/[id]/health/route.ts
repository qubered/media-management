import { NextResponse } from "next/server";
import { checkDeviceHealth } from "@/lib/server/deviceHealth";
import { getDevice } from "@/lib/server/devices";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const device = getDevice(id);
  if (!device) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const health = await checkDeviceHealth(device.host);
  return NextResponse.json(health);
}
