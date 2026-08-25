import { DeviceHealth } from "@/lib/opal/types";
import { pingHost } from "./ping";
import { pingDeviceApp } from "./send";

/**
 * Two-layer health check for a registered lectern: is the tablet reachable
 * on the network at all, and separately, is the player app on it actually
 * responding — without pushing a design or triggering a reload. Skips the
 * app check when the network layer is already down, since a TCP connect to
 * an unreachable host adds nothing beyond what the ping already showed.
 */
export async function checkDeviceHealth(host: string): Promise<DeviceHealth> {
  const network = await pingHost(host);
  if (!network.ok) {
    return { network, app: { ok: false, message: "Skipped — tablet unreachable" } };
  }

  const app = await pingDeviceApp(host);
  return { network, app };
}
