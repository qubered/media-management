import { Client } from "node-osc";
import { listOscTargets } from "./oscTargets";

type OscArg = string | number;

/**
 * Fans an OSC message out to registered feedback targets (e.g. Companion's "Listen for OSC" port),
 * so button state can track real send status. When `sourceHost` is given, only targets registered
 * under that IP receive it — used to scope feedback to whichever OSC sender triggered the send,
 * rather than notifying every registered target for a command only one of them issued.
 */
export function broadcastOscFeedback(address: string, args: OscArg[], sourceHost?: string): void {
  const targets = sourceHost ? listOscTargets().filter((t) => t.host === sourceHost) : listOscTargets();
  for (const target of targets) {
    const client = new Client(target.host, target.port);
    client.send(address, ...args, () => client.close());
  }
}

/** Replies directly to whoever sent a message, bypassing the registered target list — used for connectivity checks that shouldn't require pre-registration. */
export function replyOsc(host: string, port: number, address: string, args: OscArg[]): void {
  const client = new Client(host, port);
  client.send(address, ...args, () => client.close());
}
