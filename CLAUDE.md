@AGENTS.md

# Lectern Library

A centralized Next.js app that replaces the vendor's own authoring software
for a Pixel Technology **Opal Plus** display (deployed here on the front of
a lectern for Harry the Hirer / HTH Productions, not on a lift). One server
on the venue network; every device sees the same shared preset library. See
[README.md](README.md) for the reverse-engineered file format and network
protocols, and [DESIGN.md](DESIGN.md) for the visual design system.

## Architecture

- `src/lib/opal/` — shared format/domain logic, safe to import from client
  or server: `types.ts` (all shared interfaces), `xml.ts` (config.xml
  builder), `color.ts` (ARGB/RGB conversion), `apiClient.ts` (fetch wrappers
  the UI calls — every server capability has a matching function here).
- `src/lib/server/` — server-only. `db.ts` is the single `better-sqlite3`
  connection and all table schemas/migrations; `presets.ts`, `devices.ts`,
  `oscTargets.ts` are thin service layers over it. `paths.ts` resolves
  `DATA_DIR`/`MEDIA_DIR`/`DB_PATH` from `OPAL_DATA_DIR`; `mediaStore.ts` and
  `hash.ts` are the content-addressed disk store; `thumbnail.ts` builds the
  device's custom `<graphics bitmap>` format plus the library preview JPEG.
  `processImage.ts` / `processVideo.ts` do the sharp/ffmpeg normalization to
  1080×1920. `send.ts` speaks the real OTA TCP protocol; `osc.ts` +
  `oscFeedback.ts` + `oscLog.ts` are the OSC control surface;
  `pushPreset.ts` is the shared send path both the HTTP route and OSC
  command call into. `importConfigZip.ts` is the reverse direction — parses
  an uploaded config.zip (this app's own or the vendor's) back into a
  preset.
- `src/app/api/` — route handlers, kept thin: parse/validate the request,
  call into `src/lib/server/`, return JSON. Business logic doesn't belong
  here. See README "API reference" for the full route table.
- `src/components/opal/` — client components. `PresetLibrary.tsx` is the
  page root; `MediaBuilder.tsx`/`CropEditor.tsx` are the upload+crop flow;
  `SendMenu.tsx`/`SendModal.tsx` are the send-to-lectern flow;
  `DevicesModal.tsx` is the tabbed Settings modal (Lecterns / OSC control /
  Log).

### Data model

Everything lives in one SQLite file (`OPAL_DATA_DIR/presets.db`, default
`./data/presets.db`) with four tables, all defined in `db.ts`:

- **`presets`** — the library. Media/source are referenced by hash, not
  stored inline; `ephemeral` rows are quick-builds hidden from the UI and
  swept after 24h; `pinned`/`crop_*`/`background_color` drive the UI you'd
  expect.
- **`devices`** — registered lecterns (name + host), the OTA send targets.
- **`osc_targets`** — where OSC feedback gets broadcast (name + host +
  port), independent of `devices`.
- **`osc_log`** — rolling window (last 200) of every inbound OSC message.

New persisted state should be a new table here, not a new file on disk or
a module-level variable — see the in-memory-log gotcha below.

## Conventions worth knowing before changing things

- **Media is always normalized** to 1080×1920, PNG for images / MP4 for
  video, regardless of source. Don't add a code path that skips this — the
  player has a 64 MiB decode heap with no bounds checking (see README "OTA
  push protocol" → known player constraint), so an unnormalized asset is a
  real crash risk on the physical device, not just a cosmetic issue.
- **SQLite is the single source of truth** for presets, devices, OSC
  targets, and the OSC log — `/data` is gitignored, not committed. Don't add
  module-level in-memory state for anything that needs to be read back from
  a different request. The OSC log was originally a plain in-memory array
  and silently returned empty from the API even though the OSC server was
  receiving messages fine — the instrumentation-hosted server and the API
  routes don't reliably share a module instance under Turbopack's dev
  bundler. Back cross-request state with the DB, full stop.
- **instrumentation.ts starts the OSC UDP listener once per server boot.**
  Editing `osc.ts` (or anything it imports) requires a full dev server
  restart to take effect — Fast Refresh does not re-run `register()`.
- **The OTA push and OSC control APIs are intentionally unauthenticated,
  LAN-only.** This matches the vendor's own protocol and the venue's actual
  security model (closed network, no internet-facing anything). Don't add
  auth to these without discussing it first — it's a deliberate choice, not
  an oversight.
- **`getPreset`/`getDevice`-style singular lookups return `null`, not
  `undefined` or a thrown error**, when not found — API routes turn that
  into a 404. Keep that pattern for new lookups.
- Server code uses `node:` prefixed builtin imports (`node:crypto`,
  `node:child_process`, etc.) — match that in new files.

## Working in this repo

- **There is no automated test suite** (`npm run lint` exists; there's no
  `test` script). Instead: `npx tsc --noEmit`, `npx eslint .`, and
  `npm run build` all need to pass clean before calling something done,
  plus live browser verification for anything UI-facing and a real
  end-to-end exercise (curl or a small script) for anything protocol-facing
  — see git history for the pattern used to validate the OTA push and OSC
  control against real hardware.
- For any UI change, verify it live in a browser rather than trusting the
  diff — this app has a real crop editor, real drag interactions, and real
  modals that are easy to get subtly wrong.
- The dev server sometimes needs `dangerouslyDisableSandbox` to spawn
  ffmpeg or bind the OSC UDP port from a sandboxed shell — if `next dev`
  fails with a sandbox-flavored spawn/bind error, that's why.
- If OSC/network features stop working after the dev server's been running
  a long time, restart it before debugging further — long-lived Node
  processes in this environment have been observed losing outbound network
  reachability that a fresh process doesn't have.
