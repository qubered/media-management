import crypto from "node:crypto";
import JSZip from "jszip";
import {
  countPresetsByMediaHash,
  countPresetsBySourceHash,
  deletePresetRow,
  getPresetRow,
  insertPresetRow,
  listPresetRows,
  PresetRow,
  sweepStaleEphemeralPresets,
  updatePresetMediaRow,
  updatePresetRow,
} from "./db";
import { sha1Hex } from "./hash";
import { deleteMedia, readMedia, writeMedia } from "./mediaStore";
import { processImageBuffer } from "./processImage";
import { processVideoBuffer } from "./processVideo";
import { encodeGraphicsBitmap, makeLibraryPreviewDataUrl } from "./thumbnail";
import { buildConfigXml, buildContentTypesXml } from "@/lib/opal/xml";
import { CANVAS_HEIGHT, CANVAS_WIDTH, CropRect, defaultSettings, MediaKind, PresetSummary } from "@/lib/opal/types";
import { rgbHexToArgb } from "@/lib/opal/color";

const DEFAULT_BACKGROUND = "#000000";
const EPHEMERAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function toSummary(row: PresetRow): PresetSummary {
  const crop =
    row.crop_x !== null && row.crop_y !== null && row.crop_width !== null && row.crop_height !== null
      ? { x: row.crop_x, y: row.crop_y, width: row.crop_width, height: row.crop_height }
      : undefined;

  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    extension: row.extension,
    previewDataUrl: row.preview_data_url,
    createdAt: row.created_at,
    backgroundColorRgb: "#" + row.background_color.slice(3),
    crop,
    editable: row.source_hash !== null,
    pinned: row.pinned === 1,
  };
}

function kindFromMimeType(mimeType: string): MediaKind | null {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function stripExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? fileName : fileName.slice(0, dot);
}

function extensionFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  const ext = dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "bin";
}

/** Quick-build one-offs older than a day are swept away so they don't accumulate; runs once when this module first loads. */
let sweepStarted = false;
function sweepOnce() {
  if (sweepStarted) return;
  sweepStarted = true;
  const stale = sweepStaleEphemeralPresets(EPHEMERAL_MAX_AGE_MS);
  for (const row of stale) {
    if (countPresetsByMediaHash(row.media_hash) === 0) {
      void deleteMedia(row.media_hash, row.extension);
    }
    if (row.source_hash && row.source_extension && countPresetsBySourceHash(row.source_hash) === 0) {
      void deleteMedia(row.source_hash, row.source_extension);
    }
  }
}

export function listPresets(): PresetSummary[] {
  sweepOnce();
  return listPresetRows().map(toSummary);
}

export function getPreset(id: string): PresetSummary | null {
  const row = getPresetRow(id);
  return row ? toSummary(row) : null;
}

export async function createPreset(options: {
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  name?: string;
  ephemeral?: boolean;
  crop?: CropRect;
  backgroundColor?: string;
}): Promise<PresetSummary> {
  sweepOnce();
  const kind = kindFromMimeType(options.mimeType);
  if (!kind) throw new Error("Only image or video files are supported.");

  const backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND;

  let mediaBytes: Buffer;
  let extension: "png" | "mp4";
  let posterForThumbnail: Buffer;

  if (kind === "image") {
    mediaBytes = await processImageBuffer(options.fileBuffer, CANVAS_WIDTH, CANVAS_HEIGHT, options.crop, backgroundColor);
    extension = "png";
    posterForThumbnail = mediaBytes;
  } else {
    const { mp4Bytes, posterPng } = await processVideoBuffer(
      options.fileBuffer,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      options.crop,
      backgroundColor,
    );
    mediaBytes = mp4Bytes;
    extension = "mp4";
    posterForThumbnail = posterPng;
  }

  const hash = sha1Hex(mediaBytes);
  if (countPresetsByMediaHash(hash) === 0) {
    await writeMedia(hash, extension, mediaBytes);
  }

  const sourceHash = sha1Hex(options.fileBuffer);
  const sourceExtension = extensionFromFileName(options.fileName);
  if (countPresetsBySourceHash(sourceHash) === 0) {
    await writeMedia(sourceHash, sourceExtension, options.fileBuffer);
  }

  const [thumbnailBase64, previewDataUrl] = await Promise.all([
    encodeGraphicsBitmap(posterForThumbnail, CANVAS_WIDTH, CANVAS_HEIGHT),
    makeLibraryPreviewDataUrl(posterForThumbnail, CANVAS_WIDTH, CANVAS_HEIGHT),
  ]);

  const row: PresetRow = {
    id: crypto.randomUUID(),
    name: options.name?.trim() || stripExtension(options.fileName) || "Untitled",
    kind,
    extension,
    media_hash: hash,
    thumbnail_base64: thumbnailBase64,
    preview_data_url: previewDataUrl,
    background_color: rgbHexToArgb(backgroundColor),
    source_hash: sourceHash,
    source_extension: sourceExtension,
    source_mime_type: options.mimeType,
    crop_x: options.crop?.x ?? null,
    crop_y: options.crop?.y ?? null,
    crop_width: options.crop?.width ?? null,
    crop_height: options.crop?.height ?? null,
    ephemeral: options.ephemeral ? 1 : 0,
    pinned: 0,
    created_at: Date.now(),
  };
  insertPresetRow(row);

  return toSummary(row);
}

export function updatePreset(
  id: string,
  updates: { name?: string; ephemeral?: boolean; pinned?: boolean },
): PresetSummary | null {
  const row = getPresetRow(id);
  if (!row) return null;
  updatePresetRow(id, updates);
  return toSummary({
    ...row,
    ...updates,
    ephemeral: updates.ephemeral !== undefined ? (updates.ephemeral ? 1 : 0) : row.ephemeral,
    pinned: updates.pinned !== undefined ? (updates.pinned ? 1 : 0) : row.pinned,
  });
}

export async function getPresetSource(id: string): Promise<{ bytes: Buffer; mimeType: string; extension: string } | null> {
  const row = getPresetRow(id);
  if (!row || !row.source_hash || !row.source_extension) return null;
  const bytes = await readMedia(row.source_hash, row.source_extension);
  return { bytes, mimeType: row.source_mime_type ?? "application/octet-stream", extension: row.source_extension };
}

/** Re-processes a preset's ORIGINAL upload with a new crop/background — the whole point of keeping the source around is that this never loses quality or content from an earlier crop. */
export async function recropPreset(id: string, crop: CropRect, backgroundColor: string): Promise<PresetSummary | null> {
  const row = getPresetRow(id);
  if (!row || !row.source_hash || !row.source_extension) return null;

  const sourceBytes = await readMedia(row.source_hash, row.source_extension);

  let mediaBytes: Buffer;
  let posterForThumbnail: Buffer;
  if (row.kind === "image") {
    mediaBytes = await processImageBuffer(sourceBytes, CANVAS_WIDTH, CANVAS_HEIGHT, crop, backgroundColor);
    posterForThumbnail = mediaBytes;
  } else {
    const { mp4Bytes, posterPng } = await processVideoBuffer(sourceBytes, CANVAS_WIDTH, CANVAS_HEIGHT, crop, backgroundColor);
    mediaBytes = mp4Bytes;
    posterForThumbnail = posterPng;
  }

  const newHash = sha1Hex(mediaBytes);
  const oldHash = row.media_hash;
  if (countPresetsByMediaHash(newHash) === 0) {
    await writeMedia(newHash, row.extension, mediaBytes);
  }

  const [thumbnailBase64, previewDataUrl] = await Promise.all([
    encodeGraphicsBitmap(posterForThumbnail, CANVAS_WIDTH, CANVAS_HEIGHT),
    makeLibraryPreviewDataUrl(posterForThumbnail, CANVAS_WIDTH, CANVAS_HEIGHT),
  ]);

  const updates = {
    media_hash: newHash,
    thumbnail_base64: thumbnailBase64,
    preview_data_url: previewDataUrl,
    background_color: rgbHexToArgb(backgroundColor),
    crop_x: crop.x,
    crop_y: crop.y,
    crop_width: crop.width,
    crop_height: crop.height,
  };
  updatePresetMediaRow(id, updates);

  if (newHash !== oldHash && countPresetsByMediaHash(oldHash) === 0) {
    await deleteMedia(oldHash, row.extension);
  }

  return toSummary({ ...row, ...updates });
}

export async function deletePreset(id: string): Promise<boolean> {
  const row = getPresetRow(id);
  if (!row) return false;
  deletePresetRow(id);
  if (countPresetsByMediaHash(row.media_hash) === 0) {
    await deleteMedia(row.media_hash, row.extension);
  }
  if (row.source_hash && row.source_extension && countPresetsBySourceHash(row.source_hash) === 0) {
    await deleteMedia(row.source_hash, row.source_extension);
  }
  return true;
}

export async function buildConfigZipForPreset(id: string): Promise<Buffer | null> {
  const row = getPresetRow(id);
  if (!row) return null;

  const mediaBytes = await readMedia(row.media_hash, row.extension);
  const settings = { ...defaultSettings(), backgroundColorArgb: row.background_color };

  const configXml = buildConfigXml(
    settings,
    { kind: row.kind, hash: row.media_hash, extension: row.extension },
    row.kind === "image" ? row.media_hash : undefined,
    row.thumbnail_base64,
  );

  const zip = new JSZip();
  zip.file(`${row.media_hash}.${row.extension}`, mediaBytes);
  zip.file("[Content_Types].xml", buildContentTypesXml(row.extension));
  zip.file("config.xml", withBom(configXml));

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function withBom(text: string): Buffer {
  return Buffer.concat([UTF8_BOM, Buffer.from(text, "utf8")]);
}
