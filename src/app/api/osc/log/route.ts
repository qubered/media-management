import { NextResponse } from "next/server";
import { clearOscLog, getOscLog } from "@/lib/server/oscLog";

export async function GET() {
  return NextResponse.json(getOscLog());
}

export async function DELETE() {
  clearOscLog();
  return new NextResponse(null, { status: 204 });
}
