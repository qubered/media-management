import fs from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR } from "./paths";

function mediaPath(hash: string, extension: string): string {
  return path.join(MEDIA_DIR, `${hash}.${extension}`);
}

export async function writeMedia(hash: string, extension: string, bytes: Buffer): Promise<void> {
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  await fs.writeFile(mediaPath(hash, extension), bytes);
}

export async function readMedia(hash: string, extension: string): Promise<Buffer> {
  return fs.readFile(mediaPath(hash, extension));
}

export async function deleteMedia(hash: string, extension: string): Promise<void> {
  await fs.rm(mediaPath(hash, extension), { force: true });
}
