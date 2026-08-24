import { NextResponse } from "next/server";
import { deleteDevice, updateDevice } from "@/lib/server/devices";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: { name?: string; host?: string } = {};
  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body?.host === "string" && body.host.trim()) updates.host = body.host.trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const device = updateDevice(id, updates);
  if (!device) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(device);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = deleteDevice(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
