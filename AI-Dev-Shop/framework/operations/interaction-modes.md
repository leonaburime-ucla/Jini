# Interaction Modes

This file is the source of truth for Agent Direct consensus behavior and cross-agent consultation. `AGENTS.md` keeps only startup-critical summaries.

## Agent Consensus Variant

If Agent Direct Mode is started with `consensus` enabled, for example by saying
"talk to <agent> in consensus mode" or by using `/agent <name> consensus` when
slash-command templates are installed:

- The active direct agent may invoke Swarm Consensus for high-level debatable questions.
- Consensus mode defaults to `single-pass` unless the user requests `debate`.
- On entry, the active agent briefly explains the current consensus setting and how to switch back to normal direct mode.

## Cross-Agent Consultation (Default ON)

Cross-agent consultation is enabled by default. If consultation mode is disabled, agents stop consulting and the Coordinator uses strict single-agent routing.

- Coordinator remains the router of record when consultation is on.
- One owner agent stays accountable for final output quality and delivery.
- Consultation is advice-only unless Coordinator explicitly escalates scope.
- Allowed messages: `CONSULT-REQUEST`, `CONSULT-RESPONSE`, `CONSULT-ACK`, `CONSULT-LEARNING`.
- Maximum 2 back-and-forth rounds per consultation thread before owner decision or human escalation.
