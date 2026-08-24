import { NextResponse } from "next/server";
import { recropPreset } from "@/lib/server/presets";
import { CropRect } from "@/lib/opal/types";

function isCropRect(value: unknown): value is CropRect {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return ["x", "y", "width", "height"].every((k) => typeof c[k] === "number");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (!isCropRect(body?.crop) || typeof body?.backgroundColor !== "string") {
    return NextResponse.json({ error: "Missing crop or backgroundColor" }, { status: 400 });
  }

  try {
    const preset = await recropPreset(id, body.crop, body.backgroundColor);
    if (!preset) {
      return NextResponse.json({ error: "Not found or not editable" }, { status: 404 });
    }
    return NextResponse.json(preset);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to re-crop preset";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
