import { EventEmitter } from "node:events";
import crypto from "node:crypto";

/**
 * Failure modes a connection can be forced into, to exercise the app's
 * timeout/error handling without needing a real misbehaving tablet. See
 * protocol.ts for exactly what each one does on the wire.
 */
export type SimulateMode =
  | "normal"
  | "refuse"
  | "hang-after-connect"
  | "bad-ack"
  | "hang-before-ready"
  | "slow-ready"
  | "reject-transfer";

export const SIMULATE_MODES: { value: SimulateMode; label: string; description: string }[] = [
  { value: "normal", label: "Normal", description: "Full correct handshake and transfer." },
  { value: "refuse", label: "Refuse connection", description: "Drop the socket the instant it connects — simulates a powered-off tablet." },
  {
    value: "hang-after-connect",
    label: "Hang after connect",
    description: "Accept the connection but never reply to HELLO — triggers the client's idle timeout.",
  },
  { value: "bad-ack", label: "Bad ACK byte", description: "Reply to HELLO with a garbage byte instead of ACK." },
  {
    value: "hang-before-ready",
    label: "Hang before READY",
    description: "Send ACK + status, then never send READY — triggers the client's idle timeout.",
  },
  {
    value: "slow-ready",
    label: "Slow READY",
    description: "Send ACK + status, then delay READY by the configured delay — good for probing the 5s ping / 20s push timeout boundary.",
  },
  {
    value: "reject-transfer",
    label: "Reject transfer",
    description: "Handshake normally, accept the pushed zip, then drop the connection instead of confirming — simulates a crash mid-push.",
  },
];

export type EventKind = "ping-ok" | "ping-fail" | "push-ok" | "push-fail" | "error";

export interface EmulatorEvent {
  id: string;
  time: number;
  remoteAddress: string;
  kind: EventKind;
  message: string;
  simulateMode: SimulateMode;
  statusSent: string;
  zipBytes?: number;
  backgroundColorRgb?: string;
  contentKind?: "image" | "video";
  mediaFileName?: string;
  mediaMimeType?: string;
  mediaBuffer?: Buffer;
}

const MAX_EVENTS = 30;

class EmulatorState extends EventEmitter {
  screenName = "Emulated Opal Plus";
  statusText = "Ready";
  simulateMode: SimulateMode = "normal";
  slowReadyDelayMs = 6000;
  events: EmulatorEvent[] = [];

  addEvent(event: Omit<EmulatorEvent, "id" | "time">) {
    const full: EmulatorEvent = { ...event, id: crypto.randomUUID(), time: Date.now() };
    this.events.unshift(full);
    this.events.length = Math.min(this.events.length, MAX_EVENTS);
    this.emit("event", full);
    return full;
  }

  latestMedia(): EmulatorEvent | undefined {
    return this.events.find((e) => e.mediaBuffer);
  }

  findEvent(id: string): EmulatorEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  updateConfig(patch: Partial<Pick<EmulatorState, "screenName" | "statusText" | "simulateMode" | "slowReadyDelayMs">>) {
    Object.assign(this, patch);
    this.emit("config");
  }
}

export const state = new EmulatorState();
