import { Client } from "node-osc";
import { listOscTargets } from "./oscTargets";

type OscArg = string | number;

/** Fans an OSC message out to every registered feedback target (e.g. Companion's "Listen for OSC" port), so button state can track real send status. */
export function broadcastOscFeedback(address: string, args: OscArg[]): void {
  for (const target of listOscTargets()) {
    const client = new Client(target.host, target.port);
    client.send(address, ...args, () => client.close());
  }
}

/** Replies directly to whoever sent a message, bypassing the registered target list — used for connectivity checks that shouldn't require pre-registration. */
export function replyOsc(host: string, port: number, address: string, args: OscArg[]): void {
  const client = new Client(host, port);
  client.send(address, ...args, () => client.close());
}
