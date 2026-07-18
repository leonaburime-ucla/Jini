# `@jini/agent-runtime`

Runtime-side content and (eventually) execution code for agent-driven
artifact generation. Mostly a content package (brand-agnostic craft
knowledge and portable skill packages, both product-neutral per root
`AGENTS.md`), plus one real TypeScript surface: `src/registry.ts`.

## `src/registry.ts`

The provider/model/agent vocabulary (`ModelProvider`, `ModelOption`,
`AgentDefinition`, `AgentDiagnostic`, `CredentialStatus`, ...) and a handful
of pure helpers (credential-status resolution, model-list merging, a stable
model-catalogue cache key, model-choice normalization against a live
catalogue) for any consumer building a "pick a model/agent" UI — e.g.
`@jini/chat-react`'s `features/model-picker/` slice. See `source-map.md` for
full provenance.

## `src/craft/`

Universal UI-craft rulebooks (typography, color, motion, accessibility,
forms, RTL, anti-AI-slop, …) that a skill can opt into via a
`craft.requires` front-matter array. See `src/craft/README.md` for the
full mechanism and `source-map.md` for provenance.

## `src/skills/`

160 portable Skill packages ported from OD's 162-skill catalog (2 excluded
as OD-internal — see `source-map.md`), each a `SKILL.md` + optional
`assets/`/`scripts/`/`references/`. Frontmatter uses the same flat
`craft.requires`/`design_system.requires`/`mode`/etc. key convention as
`src/craft/`, not OD's original nested `od:` block. No TypeScript
registry/execution code lives here yet — that's separate future work.
