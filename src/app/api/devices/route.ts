import { NextResponse } from "next/server";
import { createDevice, listDevices } from "@/lib/server/devices";

export async function GET() {
  return NextResponse.json(listDevices());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const host = typeof body?.host === "string" ? body.host.trim() : "";

  if (!name || !host) {
    return NextResponse.json({ error: "Name and host are required" }, { status: 400 });
  }

  return NextResponse.json(createDevice(name, host), { status: 201 });
}
