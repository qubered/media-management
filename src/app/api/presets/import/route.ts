import { NextResponse } from "next/server";
import { parseConfigZip } from "@/lib/server/importConfigZip";
import { createPreset } from "@/lib/server/presets";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const zipBytes = Buffer.from(await file.arrayBuffer());

  let parsed;
  try {
    parsed = await parseConfigZip(zipBytes);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to read this config.zip" }, { status: 400 });
  }

  const rawName = form.get("name");
  const name = (typeof rawName === "string" && rawName.trim()) || file.name.replace(/\.zip$/i, "") || "Imported design";

  const preset = await createPreset({
    fileBuffer: parsed.fileBuffer,
    fileName: parsed.fileName,
    mimeType: parsed.mimeType,
    name,
    backgroundColor: parsed.backgroundColor,
  });

  return NextResponse.json(preset, { status: 201 });
}
