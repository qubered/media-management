import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ listenPort: Number(process.env.OSC_PORT) || 9000 });
}
