import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { MediaKind } from "@/lib/opal/types";

export interface ParsedConfigZip {
  kind: MediaKind;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  /** #RRGGBB */
  backgroundColor: string;
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/** A `<fileRef>` parses to a plain string when it has no attributes, or an object with "#text" when it does (e.g. targetWidth/targetHeight). */
function textOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>)["#text"] === "string") {
    return (value as Record<string, string>)["#text"];
  }
  return null;
}

function firstOf<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** config.xml's <solidColor> is .NET-style #AARRGGBB (see README) — take the last 6 hex digits regardless of case/prefix. */
function parseBackgroundColorRgb(raw: unknown): string {
  const hex = typeof raw === "string" ? raw.replace(/[^0-9a-fA-F]/g, "") : "";
  const rgb = hex.length >= 6 ? hex.slice(-6) : hex.padStart(6, "0");
  return "#" + rgb.toLowerCase();
}

function extractContent(display: Record<string, unknown>): { kind: MediaKind; fileRef: string } {
  const staticimage = firstOf(display.staticimage as unknown);
  if (staticimage && typeof staticimage === "object") {
    const fileRef = textOf((staticimage as Record<string, unknown>).fileRef);
    if (fileRef) return { kind: "image", fileRef };
    throw new Error("This config.zip has a <staticimage> but no file reference could be found inside it.");
  }

  const videoFrame = firstOf(display.videoFrame as unknown);
  if (videoFrame && typeof videoFrame === "object") {
    const fileRef = textOf((videoFrame as Record<string, unknown>).fileRef);
    if (fileRef) return { kind: "video", fileRef };
    throw new Error("This config.zip has a <videoFrame> but no file reference could be found inside it.");
  }

  throw new Error(
    "This config.zip doesn't contain a single full-screen image or video — that's the only layout this app can import.",
  );
}

/** Parses a config.zip built by any tool (this app's own export, or the vendor's designer software) and pulls out the one full-screen image/video asset this app knows how to display. */
export async function parseConfigZip(zipBytes: Buffer): Promise<ParsedConfigZip> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBytes);
  } catch {
    throw new Error("Couldn't open this file as a zip archive.");
  }

  const configEntry = zip.file("config.xml");
  if (!configEntry) throw new Error("Not a valid config.zip — missing config.xml.");

  const xmlBytes = await configEntry.async("nodebuffer");
  const xmlText = stripBom(xmlBytes.toString("utf8"));

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const doc = parser.parse(xmlText) as Record<string, unknown>;
  const display = doc.display as Record<string, unknown> | undefined;
  if (!display) throw new Error("Not a valid config.zip — config.xml has no <display> root element.");

  const backgroundColor = parseBackgroundColorRgb((display.background as Record<string, unknown> | undefined)?.solidColor);
  const { kind, fileRef } = extractContent(display);

  const assetEntry = zip.file(fileRef);
  if (!assetEntry) throw new Error(`config.xml references "${fileRef}" but it isn't in the zip.`);

  const fileBuffer = Buffer.from(await assetEntry.async("nodebuffer"));
  const mimeType = kind === "image" ? "image/png" : "video/mp4";

  return { kind, fileBuffer, fileName: fileRef, mimeType, backgroundColor };
}
