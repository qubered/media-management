/**
 * Sends a built config.zip to a device over the venue network.
 *
 * The real OTA wire protocol isn't reverse-engineered yet (see README "Adding OTA delivery" — it
 * needs a packet capture of the vendor's own software pushing an update). Until then this simulates
 * the round trip so the UI/UX can be built and wired up now; swap the body of this function for the
 * real transport once the protocol is known — nothing above it (the API route, the send modal) should
 * need to change.
 */
export async function sendConfigZipToDevice(host: string, zip: Buffer): Promise<{ ok: boolean; message: string }> {
  await new Promise((resolve) => setTimeout(resolve, 900 + Math.random() * 700));
  return { ok: true, message: `Simulated send of ${zip.byteLength} bytes to ${host} — OTA transport not implemented yet` };
}
