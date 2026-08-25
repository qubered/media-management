# Lectern Library — Companion module

A [Bitfocus Companion](https://bitfocus.io/companion) module for the
[Lectern Library](../README.md) server, built on `@companion-module/base`.
Unlike the [OSC control surface](../README.md#osc-control-companion) this
app also exposes, this module talks straight to the server's REST API —
so instead of typing a preset/lectern/schedule name into a text field and
hoping it matches, every action and feedback below lists the real thing in
a dropdown, pulled live from the server.

This is a separate package from the Next.js app (its own `package.json`,
`node_modules`, and build), because Companion modules have their own
runtime and packaging conventions (see
[the manifest](companion/manifest.json)). It is intentionally excluded
from the root app's `tsconfig.json`/`eslint.config.mjs` and from its
`npm run typecheck`/`lint`/`build` — this folder has its own equivalents
below.

## Developing

```bash
cd companion-module
npm install
npm run build       # tsc -> dist/
npm run dev          # tsc --watch
npm run lint
```

To load it into a running Companion instance for testing, use Companion's
**Developer modules** path (Settings → Advanced) pointed at this
`companion-module/` directory — it picks up `companion/manifest.json` and
`dist/main.js` after each `npm run build`.

## How it stays in sync with the server

`ModuleInstance.refreshLibrary()` ([src/main.ts](src/main.ts)) fetches
`/api/presets`, `/api/devices`, and `/api/schedules` and rebuilds every
action/feedback definition with the results — on connection init, on every
config change, on a timer (the **Library refresh interval** config field,
default 20s), and immediately via the **Refresh library** action. Because
choices are keyed by the server's real ids, a rename on the server doesn't
break an already-configured button; only a delete does.

Sends and schedule triggers go straight to
[`/api/presets/:id/send`](../src/app/api/presets/%5Bid%5D/send/route.ts)
and
[`/api/schedules/:id/trigger`](../src/app/api/schedules/%5Bid%5D/trigger/route.ts),
both of which return the per-lectern result synchronously — there's no
need to also listen for the app's OSC feedback broadcasts, so this module
doesn't register itself as an OSC target. [`src/state.ts`](src/state.ts)
caches the last result per preset+lectern in memory (reset on connection
restart) for the **Last send result** feedback to read.

## What's here

| File | Purpose |
|---|---|
| [`src/main.ts`](src/main.ts) | `ModuleInstance` — lifecycle (`init`/`configUpdated`/`destroy`), polling, `refreshLibrary()` |
| [`src/api.ts`](src/api.ts) | Minimal typed REST client for the server (mirrors `src/lib/opal/apiClient.ts` in the main app) |
| [`src/state.ts`](src/state.ts) | Cached presets/lecterns/schedules, dropdown-choice builders, last-send-result and device-health caches |
| [`src/config.ts`](src/config.ts) | Connection config fields (host, port, HTTPS, refresh interval) |
| [`src/actions.ts`](src/actions.ts) | Send preset, trigger/enable/disable/toggle schedule, check lectern health, refresh library |
| [`src/feedbacks.ts`](src/feedbacks.ts) | Schedule enabled, last send result, lectern online (last check) |
| [`src/variables.ts`](src/variables.ts) | Connection/library status and last-send/last-schedule variables |
| [`src/upgrades.ts`](src/upgrades.ts) | Companion upgrade scripts (empty for now — see its comment before adding one) |

The unauthenticated, LAN-only nature of the server's API applies here too
— this module assumes it's running on the same trusted venue network as
the Lectern Library server and the lecterns themselves.
