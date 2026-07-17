# `@jini/agent-runtime`

Runtime-side content and (eventually) execution code for agent-driven
artifact generation. Currently a content package: brand-agnostic craft
knowledge and portable skill packages, both product-neutral per root
`AGENTS.md`.

## `src/craft/`

Universal UI-craft rulebooks (typography, color, motion, accessibility,
forms, RTL, anti-AI-slop, …) that a skill can opt into via a
`craft.requires` front-matter array. See `src/craft/README.md` for the
full mechanism and `source-map.md` for provenance.

## `src/skills/`

Portable Skill packages (see `source-map.md` for provenance once
populated). No TypeScript registry/execution code lives here yet — that's
separate future work.
