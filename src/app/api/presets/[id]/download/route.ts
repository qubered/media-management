import { NextResponse } from "next/server";
import { buildConfigZipForPreset } from "@/lib/server/presets";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const zip = await buildConfigZipForPreset(id);
  if (!zip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="config.zip"',
      "Content-Length": String(zip.byteLength),
    },
  });
}
