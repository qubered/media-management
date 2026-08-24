import { NextResponse } from "next/server";
import { deletePreset, updatePreset } from "@/lib/server/presets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: { name?: string; ephemeral?: boolean; pinned?: boolean } = {};
  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body?.ephemeral === "boolean") updates.ephemeral = body.ephemeral;
  if (typeof body?.pinned === "boolean") updates.pinned = body.pinned;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const preset = updatePreset(id, updates);
  if (!preset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(preset);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deletePreset(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
