import { NextResponse } from "next/server";
import { triggerSchedule } from "@/lib/server/scheduler";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const results = await triggerSchedule(id);
  if (!results) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ results });
}
