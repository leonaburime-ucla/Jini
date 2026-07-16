# Startup Info

This file is the source of truth for the user-facing startup block.

Keep it readable:

- separate major sections with blank lines
- render standalone startup notices as `-` bullets instead of one wrapped paragraph

## Startup Block

Open with:

```text
------------Startup Info------------
```

Close with:

```text
------------End of Startup Info------------
```

## Coordinator Modes

- **Review Mode** (default): Converses, reviews, and answers meta/general questions. Specialist questions or execution work auto-dispatch unless the user explicitly asks to remain in Review Mode.
- **Pipeline Mode**: Dispatches specialist agents stage by stage. Produces specs, ADRs, tasks, code.
- **Agent Direct Mode**: Named agent takes over. Coordinator observes silently — tracks state, remembers context, but does not route or block. Agent operates at full capability. Output is pipeline-valid.
- **Direct Mode**: Coordinator fully suspended. No pipeline rules, routing, or roles active.

## Pipeline

Copy this section verbatim:

Agents are specialized roles, each with a `skills.md`. By default, all routing flows through the **Coordinator** and bounded cross-agent consultation is enabled under Coordinator control.

```text
[VibeCoder] → [CodeBase Analyzer] → [System Design] → Spec → [Red-Team] → Software Architect → [Database] → TDD → Programmer → [QA/E2E] → TestRunner → Code Review → [Refactor] → Security → [DevOps] → [Docs] → Done
```

- `[VibeCoder]` is an optional starting point — say "switch to vibecoder" to prototype fast, then promote to the full pipeline when ready. If slash-command templates are installed, `/agent vibecoder` may also be available.
- `[Observer]` is passive and active across all stages when enabled
- `[...]` stages are optional; dispatched by Coordinator when spec/ADR triggers them or when you specifically ask for them

## Startup Notices

Render each of these as its own `-` bullet with a blank line between bullets:

- `Consultation Mode (default ON) enables agent-to-agent communication via the Coordinator for difficult decisions while keeping one owner agent accountable for final output.`

- `By default, AI Dev Shop creates and writes project-specific specs, memory, reports, and local artifacts in a sibling \`ADS-memory/\` folder so they can be committed with the host project while \`AI-Dev-Shop/\` stays updateable.`

- `Agent Consensus Mode is available for high-level debatable questions among several AI models; enter with "talk to <agent> in consensus mode" and exit back to normal direct with "talk to <agent> directly". If slash-command templates are installed, /agent <name> consensus and /agent <name> may also be available.`

- Use the `Startup copy:` line emitted by `bash harness-engineering/validators/resolve_subagent_mode.sh --host <detected-host>` for the sub-agent assistance bullet.

## Startup Reminders

Render each active reminder from `framework/operations/reminders.md` as its own `-` bullet inside the startup block after Startup Notices and before `------------End of Startup Info------------`.
