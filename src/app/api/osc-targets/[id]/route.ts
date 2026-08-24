import { NextResponse } from "next/server";
import { deleteOscTarget, updateOscTarget } from "@/lib/server/oscTargets";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: { name?: string; host?: string; port?: number } = {};
  if (typeof body?.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body?.host === "string" && body.host.trim()) updates.host = body.host.trim();
  if (body?.port !== undefined) {
    const port = Number(body.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return NextResponse.json({ error: "Invalid port" }, { status: 400 });
    }
    updates.port = port;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const target = updateOscTarget(id, updates);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(target);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = deleteOscTarget(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
