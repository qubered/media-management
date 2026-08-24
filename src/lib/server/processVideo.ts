import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPathImport from "ffmpeg-static";
import sharp from "sharp";
import { CropRect } from "@/lib/opal/types";

const ffmpegPath = ffmpegPathImport as unknown as string;

function run(args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args);
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code, stderr }));
  });
}

async function runOrThrow(args: string[]): Promise<string> {
  const { code, stderr } = await run(args);
  if (code !== 0) throw new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`);
  return stderr;
}

/** Parses "Duration: 00:00:13.70" out of ffmpeg's own stderr — avoids depending on ffprobe as a second native binary. */
async function getDurationSeconds(filePath: string): Promise<number> {
  const { stderr } = await run(["-i", filePath]);
  const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const [, hours, minutes, seconds] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

/**
 * Extracts frame 0 through the same ffmpeg decode path used for the real transcode, then reads its
 * dimensions with sharp. This sidesteps relying on ffprobe (a second native binary — see README for
 * why that bit us) and avoids ambiguity around rotation-metadata handling: whatever ffmpeg decides
 * frame 0 looks like is exactly what the crop filter below will operate on.
 */
async function probeFrameSize(filePath: string, tmpDir: string): Promise<{ width: number; height: number }> {
  const probeFramePath = path.join(tmpDir, "probe.png");
  await runOrThrow(["-y", "-i", filePath, "-frames:v", "1", probeFramePath]);
  const { width, height } = await sharp(await fs.readFile(probeFramePath)).metadata();
  if (!width || !height) throw new Error("Could not read video dimensions");
  return { width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function ffmpegColor(hex: string): string {
  return "0x" + hex.replace("#", "");
}

export interface ProcessedVideo {
  mp4Bytes: Buffer;
  posterPng: Buffer;
}

/** Transcodes to a standard H.264/AAC mp4 using the native ffmpeg binary — dramatically faster than
 * the browser-side wasm build this replaced. Places the source at exactly targetWidth x targetHeight:
 * either an auto-centered cover-fit by default, or a user-chosen placement (fractions of the source,
 * can extend outside [0,1] to mean "zoomed out past full-bleed") with `backgroundColor` filling
 * whatever letterbox/pillarbox margin results.
 */
export async function processVideoBuffer(
  input: Buffer,
  targetWidth: number,
  targetHeight: number,
  crop?: CropRect,
  backgroundColor = "#000000",
): Promise<ProcessedVideo> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "opal-video-"));
  try {
    const inputPath = path.join(tmpDir, "input");
    const outputPath = path.join(tmpDir, "output.mp4");
    const framePath = path.join(tmpDir, "frame.png");

    await fs.writeFile(inputPath, input);

    let videoFilter: string;
    if (crop) {
      const { width, height } = await probeFrameSize(inputPath, tmpDir);
      const scale = targetWidth / (crop.width * width);
      const scaledWidth = Math.max(2, Math.round(width * scale));
      const scaledHeight = Math.max(2, Math.round(height * scale));
      const centerX = crop.x + crop.width / 2;
      const centerY = crop.y + crop.height / 2;

      // Pad onto a generously oversized canvas (source centered within it) so the pad filter never
      // has to shrink, then crop the exact target window out of that canvas — this one filter chain
      // handles both "zoomed in past cover" (crop does the real work) and "zoomed out past cover"
      // (pad fills the margin with backgroundColor) without needing to branch between the two.
      const bigWidth = scaledWidth + 2 * targetWidth;
      const bigHeight = scaledHeight + 2 * targetHeight;
      const padX = targetWidth;
      const padY = targetHeight;
      const cropX = clamp(Math.round(padX + centerX * scaledWidth - targetWidth / 2), 0, bigWidth - targetWidth);
      const cropY = clamp(Math.round(padY + centerY * scaledHeight - targetHeight / 2), 0, bigHeight - targetHeight);

      videoFilter =
        `scale=${scaledWidth}:${scaledHeight},` +
        `pad=${bigWidth}:${bigHeight}:${padX}:${padY}:color=${ffmpegColor(backgroundColor)},` +
        `crop=${targetWidth}:${targetHeight}:${cropX}:${cropY}`;
    } else {
      videoFilter = `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight}`;
    }

    await runOrThrow([
      "-y",
      "-i",
      inputPath,
      "-vf",
      videoFilter,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputPath,
    ]);

    const mp4Bytes = await fs.readFile(outputPath);

    const duration = await getDurationSeconds(outputPath);
    const seekTime = Math.min(duration * 0.1 || 0, Math.max(duration - 0.05, 0));
    await runOrThrow(["-y", "-ss", seekTime.toFixed(3), "-i", outputPath, "-frames:v", "1", framePath]);
    const posterPng = await fs.readFile(framePath);

    return { mp4Bytes, posterPng };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
