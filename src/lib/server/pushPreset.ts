import { getDevice } from "./devices";
import { broadcastOscFeedback } from "./oscFeedback";
import { getPreset, buildConfigZipForPreset } from "./presets";
import { sendConfigZipToDevice } from "./send";
import { SendResult } from "@/lib/opal/types";

/**
 * Builds the zip once and pushes it to every listed device, broadcasting OSC feedback for each attempt
 * so Companion buttons stay in sync. `feedbackHost`, when given, scopes that feedback to the registered
 * target(s) matching that IP — used when the send was triggered by an OSC command, so only the sender
 * hears back rather than every registered feedback target. Omit it (as the web UI's send route does) to
 * broadcast to every registered target, since an HTTP-triggered send has no equivalent "sender" to scope to.
 */
export async function pushPresetToDevices(
  presetId: string,
  deviceIds: string[],
  feedbackHost?: string,
): Promise<SendResult[] | null> {
  const preset = getPreset(presetId);
  const zip = await buildConfigZipForPreset(presetId);
  if (!preset || !zip) return null;

  return Promise.all(
    deviceIds.map(async (deviceId): Promise<SendResult> => {
      const device = getDevice(deviceId);
      if (!device) return { deviceId, ok: false, message: "Device not found" };

      broadcastOscFeedback("/lectern/feedback/send", [device.name, preset.name, "sending", ""], feedbackHost);
      const result = await sendConfigZipToDevice(device.host, zip);
      broadcastOscFeedback(
        "/lectern/feedback/send",
        [device.name, preset.name, result.ok ? "sent" : "failed", result.message],
        feedbackHost,
      );

      return { deviceId, ...result };
    }),
  );
}
