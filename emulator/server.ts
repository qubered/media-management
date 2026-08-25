import net from "node:net";
import { handleConnection } from "./protocol";
import { createUiServer } from "./ui";
import { state } from "./state";

/**
 * Standalone software stand-in for a real Pixel Technology Opal Plus
 * display: speaks the same OTA TCP protocol (see README "OTA push
 * protocol", src/lib/server/send.ts) so the app's device health check and
 * "Push to lectern" flow can be exercised without physical hardware.
 *
 * Run with: npm run emulator
 * Then register a lectern in the app pointing at this machine's IP (or
 * 127.0.0.1 if running on the same machine as the app).
 */
const OTA_PORT = Number(process.env.EMULATOR_PORT ?? 16179);
const UI_PORT = Number(process.env.EMULATOR_UI_PORT ?? 8787);
const HOST = process.env.EMULATOR_HOST ?? "0.0.0.0";

const otaServer = net.createServer((socket) => handleConnection(socket));
otaServer.on("error", (err) => {
  console.error(`[emulator] OTA server error: ${err.message}`);
  process.exit(1);
});

otaServer.listen(OTA_PORT, HOST, () => {
  console.log(`[emulator] "${state.screenName}" listening for OTA pushes on ${HOST}:${OTA_PORT}`);
});

const uiServer = createUiServer(OTA_PORT);
uiServer.listen(UI_PORT, HOST, () => {
  const displayHost = HOST === "0.0.0.0" ? "localhost" : HOST;
  console.log(`[emulator] UI: http://${displayHost}:${UI_PORT}`);
  console.log(`[emulator] Register a lectern in the app with host = this machine's IP, port is always ${OTA_PORT}.`);
});

function shutdown() {
  console.log("\n[emulator] shutting down");
  otaServer.close();
  uiServer.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
