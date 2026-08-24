import crypto from "node:crypto";

/** Media files are named by the SHA1 hex digest of their own bytes — content-addressed storage, matching the vendor's own convention (see README). */
export function sha1Hex(buffer: Buffer): string {
  return crypto.createHash("sha1").update(buffer).digest("hex");
}
