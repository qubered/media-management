import { NextResponse } from "next/server";
import { createOscTarget, listOscTargets } from "@/lib/server/oscTargets";

export async function GET() {
  return NextResponse.json(listOscTargets());
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const host = typeof body?.host === "string" ? body.host.trim() : "";
  const port = Number(body?.port);

  if (!name || !host || !Number.isInteger(port) || port < 1 || port > 65535) {
    return NextResponse.json({ error: "Name, host, and a valid port are required" }, { status: 400 });
  }

  return NextResponse.json(createOscTarget(name, host, port), { status: 201 });
}
