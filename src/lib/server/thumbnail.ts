import sharp from "sharp";

const THUMBNAIL_HEIGHT = 122;
const PREVIEW_WIDTH = 240;

/**
 * The `<graphics bitmap="...">` element in config.xml holds a base64 blob
 * shaped like: 4-byte big-endian width, 4-byte big-endian height, then raw
 * RGBA8888 pixels — see README for how this was reverse-engineered. `source`
 * is expected to already be at the exact target aspect ratio (post cover-fit
 * crop), so this is a plain resize, not another crop.
 */
export async function encodeGraphicsBitmap(source: Buffer, targetWidth: number, targetHeight: number): Promise<string> {
  const width = Math.max(1, Math.round((targetWidth * THUMBNAIL_HEIGHT) / targetHeight));
  const { data, info } = await sharp(source)
    .resize(width, THUMBNAIL_HEIGHT, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buffer = Buffer.alloc(8 + data.length);
  buffer.writeUInt32BE(info.width, 0);
  buffer.writeUInt32BE(info.height, 4);
  data.copy(buffer, 8);
  return buffer.toString("base64");
}

/** Small JPEG data URL for the library grid — independent of the tiny device thumbnail format. */
export async function makeLibraryPreviewDataUrl(source: Buffer, targetWidth: number, targetHeight: number): Promise<string> {
  const height = Math.round((PREVIEW_WIDTH * targetHeight) / targetWidth);
  const jpeg = await sharp(source)
    .resize(PREVIEW_WIDTH, height, { fit: "fill" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}
