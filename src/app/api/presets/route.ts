import { NextResponse } from "next/server";
import { createPreset, listPresets } from "@/lib/server/presets";
import { CropRect } from "@/lib/opal/types";

function parseCrop(form: FormData): CropRect | undefined {
  const x = form.get("cropX");
  const y = form.get("cropY");
  const width = form.get("cropWidth");
  const height = form.get("cropHeight");
  if (typeof x !== "string" || typeof y !== "string" || typeof width !== "string" || typeof height !== "string") {
    return undefined;
  }
  return { x: Number(x), y: Number(y), width: Number(width), height: Number(height) };
}

export async function GET() {
  return NextResponse.json(listPresets());
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  const name = form.get("name");
  const ephemeral = form.get("ephemeral") === "true";
  const crop = parseCrop(form);
  const backgroundColor = form.get("backgroundColor");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const preset = await createPreset({
      fileBuffer,
      fileName: file.name,
      mimeType: file.type,
      name: typeof name === "string" ? name : undefined,
      ephemeral,
      crop,
      backgroundColor: typeof backgroundColor === "string" ? backgroundColor : undefined,
    });
    return NextResponse.json(preset, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process file";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
