# Lectern Library

A centralized, dark-themed web app for building `config.zip` packages for a
Pixel Technology **Opal Plus** display (deployed here on the front of a
lectern, not a lift). It runs as one server on the venue network — every
device on that network sees the same shared preset library. Media processing
(image compositing, video transcoding) happens server-side with native
`sharp`/`ffmpeg`, not in the browser.

This README covers the file format and network protocols. See
[CLAUDE.md](CLAUDE.md) for the codebase architecture and conventions, and
[DESIGN.md](DESIGN.md) for the visual design system.

## Running it

```bash
npm install
npm run dev    # or: npm run build && npm start
```

Open the printed URL from any device on the same network. Presets and media
are stored under `./data` (override with `OPAL_DATA_DIR`) — back that
directory up if you care about the library surviving a reinstall.

## The flow

One page, one builder:

1. **+ New design** — drop a photo or video. It opens a crop editor: drag to
   reposition, zoom in to crop tighter, zoom out past full-bleed to letterbox
   with a background color you pick. Works for both images and video (the
   video preview plays live while you frame it).
2. Confirm the crop — the server processes it (composites the image, or
   transcodes the video with native ffmpeg) and shows the real result.
3. Choose **Use now** (downloads `config.zip` immediately, nothing is kept)
   or **Save as preset** (name it, and it shows up in the shared library for
   everyone on the network to grab later).

Saved presets can be **renamed**, **deleted**, or **edited** — editing
reopens the crop editor against the *original* upload (kept server-side
specifically for this), so re-cropping never loses quality or content from
an earlier crop. The library has a search box, sort menu (name/date), and
pinning once there are enough presets to want them.

### Sending a design to a screen

1. Click the gear icon → **Lecterns** tab → register a screen with a name
   and its IP address (shown on the screen's own network settings page).
2. On any preset card, click the paper-airplane menu — it has **Download
   .zip**, **Push to lectern**, and **Copy ID** (for Companion, see below).
3. **Push to lectern** opens a picker with every registered screen and a
   **Send to all** shortcut; each row shows live status (Sending… → Sent ✓
   or Retry on failure) using the real OTA protocol below.

The same push path — build the zip once, send to N devices, report
per-device results — is shared between this UI flow and the OSC command
below (`pushPresetToDevices` in
[`src/lib/server/pushPreset.ts`](src/lib/server/pushPreset.ts)), so status
is consistent no matter what triggered the send.

## What happens on upload

Every image or video is normalized regardless of source resolution or aspect
ratio, using the crop/zoom/background the crop editor produced:

- **Images**: rotated per EXIF, resized, and composited onto a 1080x1920
  canvas of the chosen background color (`sharp`). If the crop fully covers
  the canvas there's no visible background; if zoomed out, it shows as
  letterbox/pillarbox bars.
- **Videos**: transcoded with the native `ffmpeg` binary (`ffmpeg-static`) —
  scaled and either cropped or padded to exactly 1080x1920 the same way, then
  re-encoded as standard H.264/yuv420p + AAC. This is dramatically faster
  than the browser-side `ffmpeg.wasm` this replaced (sub-second vs. 20+
  seconds for a typical clip) and doesn't ship a ~30MB wasm blob to every
  client.

A representative frame (the final image, or ~10% into the video) is
downscaled into the device's own thumbnail format for `config.xml`, plus a
separate small JPEG for the library grid's own preview card.

## Architecture

- `src/lib/server/` — everything server-only: SQLite (`better-sqlite3`) for
  all persisted metadata, content-addressed media storage on disk,
  `sharp`/`ffmpeg` processing, zip assembly, the OTA and OSC protocol
  implementations.
- `src/app/api/` — the REST/route surface, see the full table below.
- `src/lib/opal/` — small isomorphic pieces shared by client and server:
  `types.ts` (every shared interface), `xml.ts` (config.xml templater),
  `color.ts` (ARGB/RGB conversion), `apiClient.ts` (every fetch call the UI
  makes).
- `src/components/opal/` — the UI: a single library page, the crop editor,
  the new-design builder modal, the edit modal, the tabbed Settings modal
  (Lecterns / OSC control / Log).

See [CLAUDE.md](CLAUDE.md) for the fuller architecture map, including which
file owns which concept.

Media is content-addressed (`<sha1>.<ext>`) and deduplicated — both the
*processed* output and the *original* upload are stored this way, so
identical uploads or identical crops never take extra disk space.

One-off "quick build" presets and abandoned in-progress edits are stored as
ephemeral rows (hidden from the library) and swept after 24 hours so they
don't accumulate.

### API reference

All routes are under `src/app/api/`, JSON in/out unless noted.

| Route | Methods | Notes |
|---|---|---|
| `/api/presets` | `GET`, `POST` | List / create (multipart upload) |
| `/api/presets/:id` | `PATCH`, `DELETE` | Rename/pin/ephemeral toggle; delete |
| `/api/presets/:id/download` | `GET` | Streams the built `config.zip` |
| `/api/presets/:id/source` | `GET` | Streams the original, unprocessed upload |
| `/api/presets/:id/recrop` | `POST` | Re-crop from the original source |
| `/api/presets/:id/send` | `POST` | `{ deviceIds: string[] }` → push over OTA |
| `/api/presets/import` | `POST` | Multipart `config.zip` upload → new preset |
| `/api/devices` | `GET`, `POST` | List / register a lectern |
| `/api/devices/:id` | `PATCH`, `DELETE` | Rename/re-address; remove |
| `/api/osc-targets` | `GET`, `POST` | List / register an OSC feedback target |
| `/api/osc-targets/:id` | `PATCH`, `DELETE` | Rename/re-address; remove |
| `/api/osc/info` | `GET` | `{ listenPort: number }` |
| `/api/osc/log` | `GET`, `DELETE` | Read / clear the OSC activity log |

Every route has a matching function in
[`src/lib/opal/apiClient.ts`](src/lib/opal/apiClient.ts) — that file is the
source of truth for exact request/response shapes.

## Configuration

Environment variables, all optional:

| Variable | Default | Purpose |
|---|---|---|
| `OPAL_DATA_DIR` | `./data` | Where the SQLite DB and media store live |
| `OSC_PORT` | `9000` | UDP port the OSC listener binds |

No `.env` file is required to run the app — both have sane defaults for a
single-machine venue deployment.

## How the format was reverse-engineered

Two sample `config.zip` exports from the vendor's own software (one image
deployment, one video deployment) were pulled apart and diffed byte-for-byte.

- **Container**: a plain Deflate zip holding `config.xml`,
  `[Content_Types].xml`, and the media file(s) at the root — structured like
  an OOXML package, but there's no real relationships/parts machinery.
- **`config.xml`**: UTF-8 with a BOM, root `<display>` element in the
  `http://www.designcom.com.au/schemas/DisplaySchema` namespace, with one
  content layer — `<staticimage>` or `<videoFrame>`.
- **Media filenames are content-addressed**: `<sha1-hex-of-its-own-bytes>.<ext>`.
  Confirmed by hashing the sample files and matching the names exactly.
- **`<graphics bitmap="...">`** is base64 of: 4-byte big-endian width, 4-byte
  big-endian height, then raw RGBA8888 pixels — no PNG framing, no
  compression. Height is fixed at 122px; width follows the on-screen aspect
  ratio. Confirmed by decoding it back into a real PNG and visually matching
  a downscaled copy of the source artwork.
- Background color (`<solidColor>#AARRGGBB</solidColor>`) is `.NET`-style hex.

Every generated `config.zip` was round-tripped against both real samples:
media file hashes matched exactly, and `config.xml` diffed to zero
structural differences (only fields that legitimately differ per-deployment
— like the media hash or background color — differed).

## Current scope

- One full-screen media item per config, always normalized to 1080x1920.
- Download the `config.zip` directly, or push it straight to a registered
  screen over the network (see below). No USB step required either way.
- **Import .zip** in the library header parses an existing config.zip —
  this app's own export, or one built by the vendor's own designer
  software — pulls out its background color and single full-screen
  image/video asset, and adds it as a normal editable preset. Only
  supports that single-full-screen layout; anything else (multiple
  items, `staticText`, populated `DynamicComponents`) is rejected with a
  specific error rather than silently imported wrong. See
  [`importConfigZip.ts`](src/lib/server/importConfigZip.ts).

## OTA push protocol

Reverse-engineered from a packet capture of the vendor's own software
pushing an update, plus `adb`-inspecting the player (`dct.geneva`) on a live
unit. Implemented in [`src/lib/server/send.ts`](src/lib/server/send.ts).

- The screen is a plaintext TCP **server** on port **16179**; the pushing
  app is the client. No discovery, auth, or encryption — connect straight to
  the screen's IP.
- One connection per push. Handshake, send the zip, then the connection
  closes:
  ```
  client → screen   04 + u64be(?)         HELLO (trailing value's meaning unconfirmed)
  screen → client   03                    ACK
  screen → client   u16be(len) + utf8     status string, e.g. "Cleaning..."
  screen → client   01                    READY
  client → screen   05 + u64be(zipLen)    BEGIN_TRANSFER
  client → screen   <zipLen raw bytes>    the config.zip payload
  screen → client   01                    TRANSFER_COMPLETE
  ```
- The payload is the same OPC-style zip built for the USB path — no wrapper,
  no extra framing. `buildConfigZipForPreset` is reused unchanged.

**Open questions**, not yet confirmed against a second capture: the meaning
of the 8-byte value sent with `HELLO` (currently sent as zero), and whether
the `233.252.14.x` multicast groups the unit had joined are used for
discovery/fan-out to multiple screens at once, or for something unrelated
(the device also runs lift-intercom services on the same box). Today, a
multi-screen "send to all" just opens one TCP connection per registered
device — see `sendConfigZipToDevice`.

**Known player constraint worth respecting when generating assets:** the
player decodes images with a plain, unguarded `BitmapFactory.decodeFile()`
against a 64 MiB heap — an oversized source image (large pixel dimensions,
regardless of file size on disk) causes an uncaught `OutOfMemoryError` and
an indefinite boot loop until the file is removed over `adb`. Since every
asset this app generates is normalized to 1080×1920 (~7.9 MiB decoded),
that's already well inside the safe margin.

## OSC control (Companion)

The app listens for OSC over UDP so it can be driven from Bitfocus Companion
(or anything else that speaks OSC) instead of the web UI — handy for
lectern presenters who just need one button to swap the on-screen design.
Implemented in [`src/lib/server/osc.ts`](src/lib/server/osc.ts), started
once per server boot from [`src/instrumentation.ts`](src/instrumentation.ts).
Like the OTA push itself, it's unauthenticated and local-network-only.

- **Listen port:** UDP `9000` by default, override with `OSC_PORT`. Shown
  live in the app under the gear icon → **OSC control**.
- **Commands** (Companion → this app):
  ```
  /lectern/send <preset> <lectern>   push a design to one lectern
  /lectern/send <preset>             push to every registered lectern
  /lectern/ping                      replies directly with /lectern/pong
  ```
  `<preset>` and `<lectern>` match by name or id, case-insensitive — so a
  Companion button can just use the same names shown in the app.
- **Feedback** (this app → every registered target): add Companion's own IP
  and its "Listen for OSC" port under **OSC control** in Settings, then
  every send — whether triggered from OSC or the web UI — broadcasts:
  ```
  /lectern/feedback/send <lectern> <preset> <status> <message>
    status: sending | sent | failed
  /lectern/feedback/error <address> <detail>   unresolved preset/lectern name
  ```
  Use these to drive Companion button color/text feedback. Feedback targets
  are stored the same way lecterns are (`osc_targets` table), managed from
  the same Settings modal.
- **Log:** Settings → **Log** shows every incoming OSC message — valid or
  not — with its source, arguments, and outcome, polling every 2s. Backed by
  SQLite rather than an in-memory array (see the note in `oscLog.ts` — the
  instrumentation-hosted OSC server and the API routes don't reliably share
  a module instance under Turbopack's dev bundler); keeps the last 200,
  useful for confirming Companion is actually reaching the app and sending
  what you expect before chasing anything further downstream.
- **IDs:** if you'd rather point Companion at something that survives a
  rename, every preset's paper-airplane menu and each lectern row in
  Settings has a "Copy ID" action.
