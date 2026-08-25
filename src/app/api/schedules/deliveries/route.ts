import { NextResponse } from "next/server";
import { listForSchedules } from "@/lib/server/scheduledDeliveries";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scheduleIds = (url.searchParams.get("scheduleIds") ?? "").split(",").filter(Boolean);
  if (scheduleIds.length === 0) return NextResponse.json([]);
  return NextResponse.json(listForSchedules(scheduleIds));
}
