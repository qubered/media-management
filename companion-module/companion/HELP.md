## Lectern Library

Drives a [Lectern Library](../README.md) server over its REST API — no OSC,
no IDs to copy in by hand. Point this connection at the server's host/port
and every action and feedback below lists your actual presets, lecterns,
and schedules by name in a dropdown.

**Setup**

1. Set **Lectern server host** to the IP or hostname of the machine running
   the Lectern Library app, and **Port** to the port it's listening on
   (`3000` by default).
2. The connection turns green once it can reach the server. If it doesn't,
   double check the host/port and that both machines are on the same
   network.

**Actions**

- Send preset to lectern(s) — pick a preset and one or more lecterns (or
  "All lecterns")
- Trigger schedule now / Enable schedule / Disable schedule / Toggle
  schedule enabled
- Check lectern health — pings a lectern's network and player app without
  pushing a design
- Refresh library — re-fetch presets/lecterns/schedules immediately,
  instead of waiting for the next automatic refresh

**Feedbacks**

- Schedule is enabled
- Last send result — tracks the outcome of the last "Send preset" or
  "Trigger schedule" for a given preset (and optionally a specific
  lectern)
- Lectern online (last check) — reflects the most recent "Check lectern
  health" result for that lectern

New presets, lecterns, or schedules created on the server show up in these
dropdowns automatically (on the refresh interval set in the connection's
config, or immediately via "Refresh library") — nothing to copy or retype.
