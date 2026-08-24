import { Server } from "node-osc";
import { listDevices } from "./devices";
import { broadcastOscFeedback, replyOsc } from "./oscFeedback";
import { listPresets } from "./presets";
import { pushPresetToDevices } from "./pushPreset";

const OSC_PORT = Number(process.env.OSC_PORT) || 9000;

function asString(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

/** Matches a Companion-supplied id or name (case-insensitive) against a preset. */
function resolvePreset(idOrName: string): { id: string; name: string } | null {
  const match = listPresets().find((p) => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase());
  return match ? { id: match.id, name: match.name } : null;
}

/** Matches a Companion-supplied id or name against a device; empty or "all" means every registered device. */
function resolveDeviceIds(idOrName: string): string[] {
  const devices = listDevices();
  if (!idOrName || idOrName.toLowerCase() === "all") return devices.map((d) => d.id);
  const match = devices.find((d) => d.id === idOrName || d.name.toLowerCase() === idOrName.toLowerCase());
  return match ? [match.id] : [];
}

let started = false;

/**
 * Starts the inbound OSC listener that lets Companion (or anything else that speaks OSC)
 * trigger a push, and replies with feedback so button state can track real send status.
 * See README "OSC control (Companion)" for the address/argument reference.
 */
export function startOscServer(): void {
  if (started) return;
  started = true;

  const server = new Server(OSC_PORT, "0.0.0.0", () => {
    console.log(`[osc] listening on udp:${OSC_PORT}`);
  });

  server.on("error", (err) => {
    console.error("[osc] server error:", err.message);
  });

  server.on("message", (msg, rinfo) => {
    const [address, ...args] = msg;

    if (address === "/lectern/ping") {
      replyOsc(rinfo.address, rinfo.port, "/lectern/pong", ["ok"]);
      return;
    }

    if (address === "/lectern/send") {
      const presetArg = asString(args[0]);
      const deviceArg = asString(args[1]);

      const preset = resolvePreset(presetArg);
      if (!preset) {
        broadcastOscFeedback("/lectern/feedback/error", [address, `unknown preset: ${presetArg}`]);
        return;
      }

      const deviceIds = resolveDeviceIds(deviceArg);
      if (deviceIds.length === 0) {
        broadcastOscFeedback("/lectern/feedback/error", [address, `unknown device: ${deviceArg || "(none registered)"}`]);
        return;
      }

      void pushPresetToDevices(preset.id, deviceIds);
    }
  });
}
