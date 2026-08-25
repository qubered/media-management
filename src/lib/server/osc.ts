import { Server } from "node-osc";
import { listDevices } from "./devices";
import { broadcastOscFeedback, replyOsc } from "./oscFeedback";
import { pushOscLog } from "./oscLog";
import { listPresets } from "./presets";
import { pushPresetToDevices } from "./pushPreset";
import { listSchedules, updateSchedule } from "./schedules";
import { latestStatusForSchedule } from "./scheduledDeliveries";
import { triggerSchedule } from "./scheduler";

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

/** Matches a Companion-supplied id or name (case-insensitive) against a schedule. */
function resolveSchedule(idOrName: string): { id: string; name: string } | null {
  const match = listSchedules().find((s) => s.id === idOrName || s.name.toLowerCase() === idOrName.toLowerCase());
  return match ? { id: match.id, name: match.name } : null;
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
    const from = `${rinfo.address}:${rinfo.port}`;
    const argStrings = args.map((a: unknown) => String(a));

    if (address === "/lectern/ping") {
      replyOsc(rinfo.address, rinfo.port, "/lectern/pong", ["ok"]);
      pushOscLog({ from, address, args: argStrings, ok: true, detail: "replied /lectern/pong" });
      return;
    }

    if (address === "/lectern/send") {
      const presetArg = asString(args[0]);
      const deviceArg = asString(args[1]);

      const preset = resolvePreset(presetArg);
      if (!preset) {
        const detail = `unknown preset: "${presetArg}"`;
        broadcastOscFeedback("/lectern/feedback/error", [address, detail], rinfo.address);
        pushOscLog({ from, address, args: argStrings, ok: false, detail });
        return;
      }

      const deviceIds = resolveDeviceIds(deviceArg);
      if (deviceIds.length === 0) {
        const detail = `unknown lectern: "${deviceArg || "(none registered)"}"`;
        broadcastOscFeedback("/lectern/feedback/error", [address, detail], rinfo.address);
        pushOscLog({ from, address, args: argStrings, ok: false, detail });
        return;
      }

      const detail = `pushing "${preset.name}" to ${deviceIds.length} lectern${deviceIds.length === 1 ? "" : "s"}`;
      pushOscLog({ from, address, args: argStrings, ok: true, detail });
      void pushPresetToDevices(preset.id, deviceIds, rinfo.address);
      return;
    }

    if (address === "/lectern/schedule/trigger") {
      const nameArg = asString(args[0]);
      const schedule = resolveSchedule(nameArg);
      if (!schedule) {
        const detail = `unknown schedule: "${nameArg}"`;
        broadcastOscFeedback("/lectern/feedback/error", [address, detail], rinfo.address);
        pushOscLog({ from, address, args: argStrings, ok: false, detail });
        return;
      }

      const detail = `manually triggering "${schedule.name}"`;
      pushOscLog({ from, address, args: argStrings, ok: true, detail });
      // pushPresetToDevices (inside triggerSchedule) already broadcasts /lectern/feedback/send per device.
      void triggerSchedule(schedule.id);
      return;
    }

    if (address === "/lectern/schedule/enable" || address === "/lectern/schedule/disable") {
      const nameArg = asString(args[0]);
      const schedule = resolveSchedule(nameArg);
      if (!schedule) {
        const detail = `unknown schedule: "${nameArg}"`;
        broadcastOscFeedback("/lectern/feedback/error", [address, detail], rinfo.address);
        pushOscLog({ from, address, args: argStrings, ok: false, detail });
        return;
      }

      const enabled = address === "/lectern/schedule/enable";
      updateSchedule(schedule.id, { enabled });
      const detail = `${enabled ? "enabled" : "disabled"} "${schedule.name}"`;
      broadcastOscFeedback(
        "/lectern/feedback/schedule",
        [schedule.name, enabled ? "enabled" : "disabled", latestStatusForSchedule(schedule.id)],
        rinfo.address,
      );
      pushOscLog({ from, address, args: argStrings, ok: true, detail });
      return;
    }

    if (address === "/lectern/schedule/poll") {
      const schedules = listSchedules();
      for (const schedule of schedules) {
        replyOsc(rinfo.address, rinfo.port, "/lectern/feedback/schedule", [
          schedule.name,
          schedule.enabled ? "enabled" : "disabled",
          latestStatusForSchedule(schedule.id),
        ]);
      }
      pushOscLog({
        from,
        address,
        args: argStrings,
        ok: true,
        detail: `replied with ${schedules.length} schedule${schedules.length === 1 ? "" : "s"}`,
      });
      return;
    }

    const detail = "unrecognized address";
    broadcastOscFeedback("/lectern/feedback/error", [address, detail], rinfo.address);
    pushOscLog({ from, address, args: argStrings, ok: false, detail });
  });
}
