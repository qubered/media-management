import http from "node:http";
import { state, SIMULATE_MODES, SimulateMode, EmulatorEvent } from "./state";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function eventJson(event: EmulatorEvent) {
  const { mediaBuffer, ...rest } = event;
  return { ...rest, hasMedia: Boolean(mediaBuffer) };
}

function renderPage(otaPort: number): string {
  const modeOptions = SIMULATE_MODES.map(
    (m) => `<option value="${m.value}"${m.value === state.simulateMode ? " selected" : ""}>${escapeHtml(m.label)}</option>`,
  ).join("");
  const modeDescriptions = JSON.stringify(Object.fromEntries(SIMULATE_MODES.map((m) => [m.value, m.description])));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Lectern Emulator</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0b0d10; color: #e6e8eb; }
  header { padding: 16px 24px; border-bottom: 1px solid #22262b; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  header .meta { font-size: 13px; color: #8b929b; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  main { display: grid; grid-template-columns: 300px 1fr 380px; gap: 0; min-height: calc(100vh - 53px); }
  section { padding: 20px; border-right: 1px solid #22262b; overflow-y: auto; }
  section:last-child { border-right: none; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #8b929b; margin: 0 0 14px; }
  label { display: block; font-size: 13px; margin-bottom: 6px; color: #c3c8ce; }
  input[type=text], input[type=number], select {
    width: 100%; padding: 8px 10px; margin-bottom: 14px; background: #16191d; border: 1px solid #2b3036;
    border-radius: 6px; color: #e6e8eb; font-size: 13px;
  }
  .desc { font-size: 12px; color: #8b929b; margin: -8px 0 14px; line-height: 1.4; }
  button { width: 100%; padding: 9px; background: #3b82f6; border: none; border-radius: 6px; color: white; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:hover { background: #2563eb; }
  .screen-wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 8px; }
  .screen { width: 240px; aspect-ratio: 1080 / 1920; background: #000; border-radius: 14px; border: 3px solid #2b3036; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }
  .screen img, .screen video { width: 100%; height: 100%; object-fit: contain; }
  .screen .placeholder { color: #4b5157; font-size: 13px; text-align: center; padding: 20px; }
  .screen-info { margin-top: 14px; font-size: 12px; color: #8b929b; text-align: center; line-height: 1.6; }
  .events { list-style: none; margin: 0; padding: 0; font-size: 12px; }
  .events li { padding: 10px 0; border-bottom: 1px solid #1a1d21; }
  .events .row1 { display: flex; justify-content: space-between; gap: 8px; }
  .events .kind { font-weight: 600; padding: 1px 7px; border-radius: 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.02em; }
  .kind-ping-ok, .kind-push-ok { background: #113a24; color: #4ade80; }
  .kind-ping-fail, .kind-push-fail, .kind-error { background: #3a1414; color: #f87171; }
  .events .time { color: #6b7280; }
  .events .msg { color: #c3c8ce; margin-top: 4px; }
  .events .addr { color: #6b7280; font-family: ui-monospace, monospace; }
  .badge { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #16191d; border: 1px solid #2b3036; color: #8b929b; margin-left: 8px; }
</style>
</head>
<body>
<header>
  <h1>&#128337; Lectern Emulator</h1>
  <span class="meta">OTA TCP :${otaPort}</span>
  <span class="badge" id="mode-badge"></span>
</header>
<main>
  <section>
    <h2>Behavior</h2>
    <form id="config-form">
      <label>Screen name</label>
      <input type="text" name="screenName" value="${escapeHtml(state.screenName)}" />

      <label>Status string (sent after ACK)</label>
      <input type="text" name="statusText" value="${escapeHtml(state.statusText)}" />

      <label>Simulate</label>
      <select name="simulateMode" id="simulateMode">${modeOptions}</select>
      <div class="desc" id="simulateDesc"></div>

      <label>Slow READY delay (ms)</label>
      <input type="number" name="slowReadyDelayMs" min="0" step="500" value="${state.slowReadyDelayMs}" />

      <button type="submit">Apply</button>
    </form>
  </section>
  <section class="screen-wrap">
    <h2 style="align-self: flex-start;">Screen</h2>
    <div class="screen" id="screen">
      <div class="placeholder">No design received yet</div>
    </div>
    <div class="screen-info" id="screen-info"></div>
  </section>
  <section>
    <h2>Activity</h2>
    <ul class="events" id="events"></ul>
  </section>
</main>
<script>
const descriptions = ${modeDescriptions};
const screenEl = document.getElementById('screen');
const screenInfo = document.getElementById('screen-info');
const eventsEl = document.getElementById('events');
const modeBadge = document.getElementById('mode-badge');
const simulateSelect = document.getElementById('simulateMode');
const simulateDesc = document.getElementById('simulateDesc');

function updateDesc() { simulateDesc.textContent = descriptions[simulateSelect.value] || ''; }
simulateSelect.addEventListener('change', updateDesc);
updateDesc();

function fmtTime(ms) { return new Date(ms).toLocaleTimeString(); }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderEvent(e) {
  const li = document.createElement('li');
  const row1 = el('div', 'row1');
  row1.appendChild(el('span', 'kind kind-' + e.kind, e.kind));
  row1.appendChild(el('span', 'time', fmtTime(e.time)));
  li.appendChild(row1);
  li.appendChild(el('div', 'msg', e.message));
  const addrText = e.remoteAddress + (e.zipBytes ? ' · ' + e.zipBytes.toLocaleString() + ' bytes' : '');
  li.appendChild(el('div', 'addr', addrText));
  return li;
}

function prependEvent(e) {
  eventsEl.insertBefore(renderEvent(e), eventsEl.firstChild);
  while (eventsEl.children.length > 30) eventsEl.removeChild(eventsEl.lastChild);
}

function showMedia(e) {
  if (!e || !e.hasMedia) return;
  screenEl.replaceChildren();
  const mediaEl = document.createElement(e.contentKind === 'video' ? 'video' : 'img');
  mediaEl.src = '/media/' + e.id + '?t=' + e.time;
  if (e.contentKind === 'video') { mediaEl.autoplay = true; mediaEl.loop = true; mediaEl.muted = true; mediaEl.playsInline = true; }
  screenEl.appendChild(mediaEl);
  const dot = String.fromCharCode(0xB7);
  screenInfo.textContent = [e.contentKind, e.mediaFileName, 'background ' + e.backgroundColorRgb].join(' ' + dot + ' ');
}

async function refresh() {
  const res = await fetch('/state.json');
  const data = await res.json();
  modeBadge.textContent = data.simulateMode;
  eventsEl.innerHTML = '';
  data.events.forEach(prependEvent);
  const latestMedia = data.events.find(e => e.hasMedia);
  if (latestMedia) showMedia(latestMedia);
}

const es = new EventSource('/events');
es.addEventListener('event', (ev) => {
  const e = JSON.parse(ev.data);
  prependEvent(e);
  if (e.hasMedia) showMedia(e);
});
es.addEventListener('config', (ev) => {
  const cfg = JSON.parse(ev.data);
  modeBadge.textContent = cfg.simulateMode;
});

document.getElementById('config-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = new FormData(ev.target);
  await fetch('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      screenName: form.get('screenName'),
      statusText: form.get('statusText'),
      simulateMode: form.get('simulateMode'),
      slowReadyDelayMs: Number(form.get('slowReadyDelayMs')),
    }),
  });
});

refresh();
</script>
</body>
</html>`;
}

const SSE_CLIENTS = new Set<http.ServerResponse>();

function broadcastSse(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of SSE_CLIENTS) res.write(payload);
}

state.on("event", (e: EmulatorEvent) => broadcastSse("event", eventJson(e)));
state.on("config", () => broadcastSse("config", { simulateMode: state.simulateMode, statusText: state.statusText }));

export function createUiServer(otaPort: number): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(renderPage(otaPort));
      return;
    }

    if (url.pathname === "/state.json" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          screenName: state.screenName,
          statusText: state.statusText,
          simulateMode: state.simulateMode,
          slowReadyDelayMs: state.slowReadyDelayMs,
          events: state.events.map(eventJson),
        }),
      );
      return;
    }

    if (url.pathname === "/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      res.write(": connected\n\n");
      SSE_CLIENTS.add(res);
      req.on("close", () => SSE_CLIENTS.delete(res));
      return;
    }

    if (url.pathname === "/api/config" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const patch = JSON.parse(body) as {
            screenName?: string;
            statusText?: string;
            simulateMode?: SimulateMode;
            slowReadyDelayMs?: number;
          };
          const validModes = new Set(SIMULATE_MODES.map((m) => m.value));
          const next: Parameters<typeof state.updateConfig>[0] = {};
          if (typeof patch.screenName === "string" && patch.screenName.trim()) next.screenName = patch.screenName.trim();
          if (typeof patch.statusText === "string") next.statusText = patch.statusText;
          if (typeof patch.simulateMode === "string" && validModes.has(patch.simulateMode)) next.simulateMode = patch.simulateMode;
          if (typeof patch.slowReadyDelayMs === "number" && Number.isFinite(patch.slowReadyDelayMs) && patch.slowReadyDelayMs >= 0) {
            next.slowReadyDelayMs = patch.slowReadyDelayMs;
          }
          state.updateConfig(next);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) }));
        }
      });
      return;
    }

    const mediaMatch = url.pathname.match(/^\/media\/([\w-]+)$/);
    if (mediaMatch && req.method === "GET") {
      const event = state.findEvent(mediaMatch[1]);
      if (!event?.mediaBuffer) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, { "Content-Type": event.mediaMimeType ?? "application/octet-stream", "Content-Length": event.mediaBuffer.length });
      res.end(event.mediaBuffer);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });
}
