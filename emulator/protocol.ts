import net from "node:net";
import { parseConfigZip } from "@/lib/server/importConfigZip";
import { state, SimulateMode } from "./state";

/**
 * Mirrors the command bytes in src/lib/server/send.ts — that file is the
 * spec (reverse-engineered from a real capture, see README "OTA push
 * protocol"). Keep these in sync if that ever changes.
 */
const CMD_READY = 0x01;
const CMD_ACK = 0x03;
const CMD_HELLO = 0x04;
const CMD_BEGIN_TRANSFER = 0x05;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeReader(socket: net.Socket) {
  const iterator = socket[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  let buffered = Buffer.alloc(0);

  async function fill(byteCount: number) {
    while (buffered.length < byteCount) {
      const { value, done } = await iterator.next();
      if (done) throw new Error("connection closed early");
      buffered = Buffer.concat([buffered, value]);
    }
  }

  async function readBytes(byteCount: number): Promise<Buffer> {
    await fill(byteCount);
    const out = buffered.subarray(0, byteCount);
    buffered = buffered.subarray(byteCount);
    return out;
  }

  return {
    async readByte(): Promise<number> {
      return (await readBytes(1))[0];
    },
    async readBytesExact(n: number): Promise<Buffer> {
      return readBytes(n);
    },
  };
}

export function handleConnection(socket: net.Socket) {
  const remoteAddress = socket.remoteAddress ?? "unknown";
  const mode: SimulateMode = state.simulateMode;
  const statusText = state.statusText;

  run(socket, remoteAddress, mode, statusText).catch((err) => {
    state.addEvent({
      remoteAddress,
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
      simulateMode: mode,
      statusSent: statusText,
    });
  });
}

async function run(socket: net.Socket, remoteAddress: string, mode: SimulateMode, statusText: string) {
  if (mode === "refuse") {
    socket.destroy();
    state.addEvent({ remoteAddress, kind: "ping-fail", message: "Refused connection (simulated offline)", simulateMode: mode, statusSent: statusText });
    return;
  }

  const reader = makeReader(socket);

  if (mode === "hang-after-connect") {
    state.addEvent({ remoteAddress, kind: "ping-fail", message: "Connected, then went silent (simulated hang) — waiting for client to time out", simulateMode: mode, statusSent: statusText });
    return;
  }

  const helloCmd = await reader.readByte();
  if (helloCmd !== CMD_HELLO) {
    socket.destroy();
    state.addEvent({ remoteAddress, kind: "error", message: `Expected HELLO (0x04), got 0x${helloCmd.toString(16).padStart(2, "0")}`, simulateMode: mode, statusSent: statusText });
    return;
  }
  await reader.readBytesExact(8); // trailing value, meaning unconfirmed — see README

  if (mode === "bad-ack") {
    socket.write(Buffer.from([0x00]));
    socket.destroy();
    state.addEvent({ remoteAddress, kind: "ping-fail", message: "Sent a garbage ACK byte (simulated bad handshake)", simulateMode: mode, statusSent: statusText });
    return;
  }
  socket.write(Buffer.from([CMD_ACK]));

  const statusBytes = Buffer.from(statusText, "utf8");
  const statusHeader = Buffer.alloc(2);
  statusHeader.writeUInt16BE(statusBytes.length, 0);
  socket.write(Buffer.concat([statusHeader, statusBytes]));

  if (mode === "hang-before-ready") {
    state.addEvent({ remoteAddress, kind: "ping-fail", message: `Sent status "${statusText}", then never sent READY (simulated hang) — waiting for client to time out`, simulateMode: mode, statusSent: statusText });
    return;
  }

  if (mode === "slow-ready") {
    await sleep(state.slowReadyDelayMs);
  }
  socket.write(Buffer.from([CMD_READY]));

  // A health check disconnects right here without ever sending BEGIN_TRANSFER,
  // which surfaces as the connection closing while we wait for the next byte.
  let nextByte: number;
  try {
    nextByte = await reader.readByte();
  } catch {
    state.addEvent({ remoteAddress, kind: "ping-ok", message: `Health check — replied status "${statusText}"`, simulateMode: mode, statusSent: statusText });
    return;
  }

  if (nextByte !== CMD_BEGIN_TRANSFER) {
    socket.destroy();
    state.addEvent({ remoteAddress, kind: "error", message: `Expected BEGIN_TRANSFER (0x05), got 0x${nextByte.toString(16).padStart(2, "0")}`, simulateMode: mode, statusSent: statusText });
    return;
  }

  const lengthBytes = await reader.readBytesExact(8);
  const zipLength = Number(lengthBytes.readBigUInt64BE(0));
  const zip = await reader.readBytesExact(zipLength);

  let parsed: Awaited<ReturnType<typeof parseConfigZip>> | undefined;
  let parseError: string | undefined;
  try {
    parsed = await parseConfigZip(zip);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }

  if (mode === "reject-transfer") {
    socket.destroy();
    state.addEvent({
      remoteAddress,
      kind: "push-fail",
      message: `Received ${zipLength.toLocaleString()} bytes, then dropped the connection instead of confirming (simulated crash mid-push)`,
      simulateMode: mode,
      statusSent: statusText,
      zipBytes: zipLength,
      contentKind: parsed?.kind,
      backgroundColorRgb: parsed?.backgroundColor,
      mediaFileName: parsed?.fileName,
      mediaMimeType: parsed?.mimeType,
      mediaBuffer: parsed?.fileBuffer,
    });
    return;
  }

  socket.write(Buffer.from([CMD_READY]));
  socket.destroy();
  state.addEvent({
    remoteAddress,
    kind: parsed ? "push-ok" : "push-fail",
    message: parsed
      ? `Received and confirmed ${zipLength.toLocaleString()} bytes (${parsed.kind}, background ${parsed.backgroundColor})`
      : `Received ${zipLength.toLocaleString()} bytes and confirmed, but couldn't parse the zip: ${parseError}`,
    simulateMode: mode,
    statusSent: statusText,
    zipBytes: zipLength,
    contentKind: parsed?.kind,
    backgroundColorRgb: parsed?.backgroundColor,
    mediaFileName: parsed?.fileName,
    mediaMimeType: parsed?.mimeType,
    mediaBuffer: parsed?.fileBuffer,
  });
}
