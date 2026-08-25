import net from "node:net";

const OPAL_PORT = 16179;
const IDLE_TIMEOUT_MS = 20_000;
const PING_TIMEOUT_MS = 5_000;

const CMD_READY = 0x01;
const CMD_ACK = 0x03;
const CMD_HELLO = 0x04;
const CMD_BEGIN_TRANSFER = 0x05;

/**
 * Sends a built config.zip to a screen over the venue LAN, replaying the
 * dct.geneva push protocol reverse-engineered from a real capture (see
 * README "OTA push protocol"): connect, HELLO, wait for ACK + status +
 * READY, BEGIN_TRANSFER with the payload length, then the raw zip bytes,
 * then wait for the completion ACK.
 */
export async function sendConfigZipToDevice(host: string, zip: Buffer): Promise<{ ok: boolean; message: string }> {
  const socket = net.createConnection({ host, port: OPAL_PORT });
  socket.setTimeout(IDLE_TIMEOUT_MS);
  socket.on("timeout", () => socket.destroy(new Error(`Connection to ${host}:${OPAL_PORT} timed out`)));

  const failed = new Promise<never>((_, reject) => socket.once("error", reject));

  try {
    const message = await Promise.race([push(socket, host, zip), failed]);
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  } finally {
    socket.destroy();
  }
}

/**
 * Connects and runs the handshake through READY, then disconnects without
 * ever sending BEGIN_TRANSFER — confirms the player app on the tablet is up
 * and responding (and surfaces its status string) without pushing a design
 * or triggering a reload.
 */
export async function pingDeviceApp(host: string): Promise<{ ok: boolean; status?: string; message: string }> {
  const socket = net.createConnection({ host, port: OPAL_PORT });
  socket.setTimeout(PING_TIMEOUT_MS);
  socket.on("timeout", () => socket.destroy(new Error(`Connection to ${host}:${OPAL_PORT} timed out`)));

  const failed = new Promise<never>((_, reject) => socket.once("error", reject));

  try {
    const status = await Promise.race([handshake(socket, makeReader(socket), host), failed]);
    return { ok: true, status, message: status ? `App responded: "${status}"` : "App responded" };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  } finally {
    socket.destroy();
  }
}

async function push(socket: net.Socket, host: string, zip: Buffer): Promise<string> {
  const reader = makeReader(socket);
  const status = await handshake(socket, reader, host);

  const beginTransfer = Buffer.alloc(9);
  beginTransfer.writeUInt8(CMD_BEGIN_TRANSFER, 0);
  beginTransfer.writeBigUInt64BE(BigInt(zip.byteLength), 1);
  socket.write(beginTransfer);
  socket.write(zip);

  const complete = await reader.readByte();
  if (complete !== CMD_READY) {
    throw new Error(`${host} did not confirm the transfer completed (0x${complete.toString(16).padStart(2, "0")})`);
  }

  return `Sent ${zip.byteLength.toLocaleString()} bytes to ${host}${status ? ` (${status})` : ""}`;
}

/** HELLO through READY — the half of the protocol shared by a real push and a no-op app ping. */
async function handshake(socket: net.Socket, reader: ReturnType<typeof makeReader>, host: string): Promise<string> {
  await new Promise<void>((resolve) => socket.once("connect", resolve));

  // HELLO: cmd byte + 8-byte value. The value's meaning isn't confirmed
  // against a second capture yet (spec §3.2) — zero is accepted by the
  // reference capture's screen, so send that until proven otherwise.
  const hello = Buffer.alloc(9);
  hello.writeUInt8(CMD_HELLO, 0);
  hello.writeBigUInt64BE(BigInt(0), 1);
  socket.write(hello);

  const ack = await reader.readByte();
  if (ack !== CMD_ACK) {
    throw new Error(`${host} sent an unexpected reply to HELLO (0x${ack.toString(16).padStart(2, "0")})`);
  }

  const statusLength = await reader.readUInt16BE();
  const status = (await reader.readBytes(statusLength)).toString("utf8");

  const ready = await reader.readByte();
  if (ready !== CMD_READY) {
    throw new Error(`${host} did not signal ready after "${status}" (0x${ready.toString(16).padStart(2, "0")})`);
  }

  return status;
}

function makeReader(socket: net.Socket) {
  const iterator = socket[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
  let buffered = Buffer.alloc(0);

  async function fill(byteCount: number) {
    while (buffered.length < byteCount) {
      const { value, done } = await iterator.next();
      if (done) throw new Error("Connection closed before the screen finished responding");
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
    readBytes,
    async readByte(): Promise<number> {
      return (await readBytes(1))[0];
    },
    async readUInt16BE(): Promise<number> {
      return (await readBytes(2)).readUInt16BE(0);
    },
  };
}
