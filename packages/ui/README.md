# `@jini/ui` — generic, product-neutral UI primitives

Renamed from `@jini/components` in this session (2026-07-16) once it became clear
one "components" bucket undersold the scope: this package is meant to hold more
than flat presentational components — pure business logic, hooks, and injectable
providers for whatever generic (non-chat, non-OD-branded) UI domains fall out of
extracting OD's ~217-file `apps/web/src/components/` zone.

## Scope boundary (hard rule, decided 2026-07-16)

Only genuinely **cross-product-reusable** UI lands here — buttons, dialogs, form
controls, layout primitives, icons, and any small feature-shaped domain (e.g. a
generic toast/notification system) that isn't tied to Open Design's product
vocabulary.

**Not here:** anything OD-product-specific — `FileViewer`, `ProjectView`,
`SettingsDialog`, `DesignSystemFlow`, memory-extraction config UI, automations,
handoff, brand/plugin/figma-specific components. Those stay in
`integrations/open-design/` as OD's own UI if/when that adapter needs them.
Also not here: chat/artifact UI — that's `@jini/chat-core` (already built),
`@jini/chat-react`, and `@jini/renderers-react` (separate packages, kept
separate deliberately — see the chat-core/chat-react split discussion in
`docs/jini-port/` session notes).

## Internal structure

- `src/components/` — flat, presentational-only atoms. Props in, JSX out, no
  state/logic/fetch (same discipline as OD's own ADR 0002 slice rule).
- `src/features/<domain>/` — anything that needs its own hooks + ports +
  dumb-components + barrel because it's a cohesive concern, not a single atom
  (mirrors the ports+dependencies+barrel discipline already proven by OD's
  `features/memory`, `features/chat-pane`, `features/chat-composer` slices —
  see `docs/jini-port/od-reference-branches.md`).
- `src/providers/` — the *only* place allowed to import a concrete
  transport/DOM adapter and bind it to a `features/<domain>/ports.ts`
  interface. Everything else in this package depends on the port, never a
  concrete implementation.
- `src/hooks/` — generic hooks that don't belong to one feature domain
  specifically (feature-local hooks live inside their own `features/<domain>/`
  instead).

## Status

Empty stub as of 2026-07-16. Real content is blocked on a cbm-mcp/graphify
import-coupling sweep of OD's `apps/web/src/components/` (217 files) to
classify generic vs. OD-product vs. mixed — the same kind of analysis
`recon/r1-daemon.md` did for the daemon and `recon/r4-webui.md` did for the
chat/artifact surface, not yet done for the broader component zone.
