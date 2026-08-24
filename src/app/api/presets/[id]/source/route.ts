import { NextResponse } from "next/server";
import { getPresetSource } from "@/lib/server/presets";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const source = await getPresetSource(id);
  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(source.bytes), {
    headers: {
      "Content-Type": source.mimeType,
      "Content-Length": String(source.bytes.byteLength),
    },
  });
}
