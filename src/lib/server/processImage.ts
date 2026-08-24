import sharp from "sharp";
import { CropRect } from "@/lib/opal/types";
import { hexToRgb } from "@/lib/opal/color";

/**
 * Cover-fit crop (scale to fill, crop overflow, no distortion) onto the target canvas by default, or
 * a user-chosen placement (fractions of the source, post EXIF-rotation) when provided. The crop
 * fractions can extend outside [0,1] or exceed a total of 1 — that represents zooming out past a full
 * crop, in which case the source doesn't fully cover the canvas and `backgroundColor` shows through
 * as letterbox/pillarbox bars, matching what the crop editor previewed.
 */
export async function processImageBuffer(
  input: Buffer,
  targetWidth: number,
  targetHeight: number,
  crop?: CropRect,
  backgroundColor = "#000000",
): Promise<Buffer> {
  // Applied first and materialized so the pixel data — and any crop math against it — reflects
  // the orientation a browser would actually display, matching what the user saw while cropping.
  const rotated = await sharp(input).rotate().toBuffer();

  if (!crop) {
    return sharp(rotated).resize(targetWidth, targetHeight, { fit: "cover", position: "centre" }).png().toBuffer();
  }

  const { width, height } = await sharp(rotated).metadata();
  if (!width || !height) throw new Error("Could not read image dimensions");

  const scale = targetWidth / (crop.width * width);
  const scaledWidth = Math.max(1, Math.round(width * scale));
  const scaledHeight = Math.max(1, Math.round(height * scale));
  const resized = await sharp(rotated).resize(scaledWidth, scaledHeight).toBuffer();

  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const left = Math.round(targetWidth / 2 - centerX * width * scale);
  const top = Math.round(targetHeight / 2 - centerY * height * scale);

  // sharp's composite() requires the overlay to fit within the base canvas — it won't clip an
  // oversized one itself — so when the resized source is bigger than the canvas (the ordinary crop
  // case, as opposed to zoomed-out padding) we extract just the visible sub-region first.
  const extractLeft = Math.max(0, -left);
  const extractTop = Math.max(0, -top);
  const extractWidth = Math.min(scaledWidth, targetWidth - left) - extractLeft;
  const extractHeight = Math.min(scaledHeight, targetHeight - top) - extractTop;

  const { r, g, b } = hexToRgb(backgroundColor);
  const canvas = sharp({
    create: { width: targetWidth, height: targetHeight, channels: 4, background: { r, g, b, alpha: 1 } },
  });

  if (extractWidth <= 0 || extractHeight <= 0) {
    return canvas.png().toBuffer();
  }

  const visible = await sharp(resized)
    .extract({ left: extractLeft, top: extractTop, width: extractWidth, height: extractHeight })
    .toBuffer();

  return canvas
    .composite([{ input: visible, left: Math.max(left, 0), top: Math.max(top, 0) }])
    .png()
    .toBuffer();
}
