# Lectern Library

A centralized, dark-themed web app for building `config.zip` packages for a
Pixel Technology **Opal Plus** display (deployed here on the front of a
lectern, not a lift). It runs as one server on the venue network — every
device on that network sees the same shared preset library. Media processing
(image compositing, video transcoding) happens server-side with native
`sharp`/`ffmpeg`, not in the browser.

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
an earlier crop. The library has a search box once there are enough presets
to want one.

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
  preset metadata, content-addressed media storage on disk, `sharp`/`ffmpeg`
  processing, zip assembly.
- `src/app/api/presets/` — the REST surface (`GET`/`POST /api/presets`,
  `PATCH`/`DELETE /api/presets/:id`, `GET /api/presets/:id/download`,
  `GET /api/presets/:id/source`, `POST /api/presets/:id/recrop`).
- `src/lib/opal/` — small isomorphic pieces shared by client and server
  (types, the config.xml templater, color conversion).
- `src/components/opal/` — the UI: a single library page, the crop editor,
  the new-design builder modal, the edit modal.

Media is content-addressed (`<sha1>.<ext>`) and deduplicated — both the
*processed* output and the *original* upload are stored this way, so
identical uploads or identical crops never take extra disk space.

One-off "quick build" presets and abandoned in-progress edits are stored as
ephemeral rows (hidden from the library) and swept after 24 hours so they
don't accumulate.

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
- USB export only. OTA delivery isn't implemented.

## Adding OTA delivery (needs a packet capture)

The OTA push is local and unauthenticated — the vendor's software pushes
directly to the screen over the LAN, no cloud, no login. That's good news,
but there's currently no sample of that traffic to reverse-engineer the wire
protocol from. To add it:

1. Run the vendor's software and the display on the same network.
2. Capture traffic between them while pushing an update:
   ```bash
   sudo tcpdump -i <interface> host <display-ip> -w ota-capture.pcap
   ```
   (or run Wireshark on the machine running the vendor's software, filtered
   to the display's IP).
3. Share the resulting `.pcap` so the request/response shape can be decoded
   the same way `config.xml` was.

Once that's available, an OTA sender can be added as another route alongside
the existing USB export, reusing `buildConfigZipForPreset` unchanged.
