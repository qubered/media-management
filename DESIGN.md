# Design system

Visual identity for Lectern Library, built on the **Harry the Hirer / HTH
Productions** brand guide. Tokens live in
[`src/app/globals.css`](src/app/globals.css); this document is the
rationale and the component patterns built on top of them.

## Brand

Harry's Blue (Pantone 2175C, `#006AC6`) is HTH's one brand color — "bold and
energetic... used for all hero statements and to be contrasted with white."
Montserrat is the guide's designated web font (Museo Sans and The Seasons
are print-only, so they don't apply here). The rest of the palette is
adapted to a dark theme using the brand's own near-black "Productions"
panel color, with the brand's "Power" red (from the Productions category
swatches) as the destructive/danger tone — not a generic red picked to
match the accent.

## Color tokens

| Token | Value | Use |
|---|---|---|
| `--background` | `#2b2a2c` | Page background (HTH "Productions" panel color) |
| `--surface` | `#343337` | Cards, modals |
| `--surface-hover` | `#3d3c41` | Hover state on surfaces and icon buttons |
| `--border` | `#4c4b50` | Input/card borders |
| `--border-hairline` | `#3a393d` | Subtle dividers, list-row borders |
| `--foreground` | `#ffffff` | Primary text |
| `--foreground-secondary` | `#c9cbce` | Secondary text (e.g. inline `config.zip`) |
| `--muted` | `#8b8d92` | Placeholder text, inactive icons, captions |
| `--accent` | `#006ac6` | Harry's Blue — primary actions, links, focus |
| `--accent-hover` | `#1f80d6` | Accent hover state |
| `--accent-pressed` | `#00549c` | Accent active/pressed state |
| `--accent-foreground` | `#ffffff` | Text/icons on accent-filled surfaces |
| `--danger` | `#d22730` | HTH "Power" red — destructive actions only |

All consumed through Tailwind's `@theme inline` block as `bg-accent`,
`text-danger`, `border-border-hairline`, etc. — never hardcode a hex value
in a component; add a token if one doesn't exist yet.

## Typography

- **Montserrat** (`--font-sans`), weights 400/500/600/700 — every UI
  surface, body and display alike. `.font-display` (weight 700,
  `letter-spacing: -0.01em`) marks headings and card titles; there's no
  separate display typeface, restraint over decoration.
- **Geist Mono** (`--font-mono`) — reserved for literal data: file names,
  `config.zip`, IDs, OSC addresses. If it's something a user would copy,
  paste, or type verbatim, set it in mono.

## Component patterns

- **Icon-only circular action buttons** (`h-7 w-7 rounded-full`, `text-muted`
  → `hover:text-accent` or `hover:text-danger`) are the standard for
  secondary actions on a card (pin, edit, delete). This replaced an earlier
  text+icon button row that overflowed card bounds at narrow widths —
  icon-only with a `title` for the tooltip is the fix, not a bigger card.
- **Pill buttons** (`rounded-full`) for every primary action — `+ New
  design`, `+ Add lectern`, submit buttons. Accent-filled for the primary
  action in a given context, bordered/transparent for secondary (e.g.
  `Import .zip` next to `+ New design`).
- **Dropdown menus** (`SendMenu.tsx`, `SortMenu.tsx`) share one shape: a
  trigger button, `useState` for open/closed, a `useRef` container with a
  `mousedown` document listener that closes on outside click, and an
  absolutely-positioned panel (`top-[calc(100%+6px)]`, rounded, bordered,
  `shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]`). Reuse this shape for any new
  menu rather than inventing another pattern.
- **Modals** share one shell: `fixed inset-0 bg-black/70` backdrop with
  `onClick={onClose}`, an inner panel with `onClick={(e) =>
  e.stopPropagation()}`, `rounded-3xl border border-border bg-surface`,
  header row with a title and a bare `✕` close button. `DevicesModal.tsx`
  extends this into a tabbed settings surface (Lecterns / OSC control /
  Log) rather than spawning separate modals per concern — one entry point
  (the gear icon) for everything that isn't preset content.
- **Empty states** are actionable, not just a caption — "No lecterns
  registered yet" pairs with the add form right below it in the same view;
  the library's empty state is itself a `+` button that opens the builder.
- **Icons are hand-drawn inline SVG**, not an icon library — every icon in
  this app is a small local `function FooIcon()` returning raw `<svg>`.
  Keep new icons in that style (16×16 viewBox, `currentColor`, 1.3–1.5px
  stroke) rather than pulling in a dependency for one glyph. The lectern
  logo mark specifically was redesigned after research into what makes a
  lectern read as a lectern rather than a plain box: a **sloped reading
  surface with a lip**, not a flat top — keep that detail if it's ever
  touched again.

## Layout

- Single centered column, `max-w-6xl`, consistent `px-6 sm:px-10` applied
  at exactly one level (the page root) — header and body must share the
  same horizontal padding source, not each add their own, or they drift out
  of alignment (this happened once; see git history).
- Preset grid: `[grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]`
  rather than viewport breakpoints, so it responds correctly to the
  available container width even next to a sidebar or in a narrower panel.
