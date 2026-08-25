import { spawn } from "node:child_process";

const PING_TIMEOUT_MS = 2_000;

/**
 * Checks whether the tablet itself is reachable on the network, independent
 * of whether the player app on it is running — shells out to the system
 * `ping` binary since Node has no unprivileged ICMP support.
 */
export async function pingHost(host: string): Promise<{ ok: boolean; message: string }> {
  return new Promise((resolve) => {
    const args = process.platform === "win32" ? ["-n", "1", host] : ["-c", "1", host];
    const child = spawn("ping", args);

    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, message: `${host} did not respond to ping within ${PING_TIMEOUT_MS}ms` });
    }, PING_TIMEOUT_MS);

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ ok: false, message: err.message });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(
        code === 0
          ? { ok: true, message: `${host} responded to ping` }
          : { ok: false, message: `${host} did not respond to ping` },
      );
    });
  });
}
