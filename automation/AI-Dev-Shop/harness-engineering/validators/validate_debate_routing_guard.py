#!/usr/bin/env python3
"""Validate that debate requests default to external Swarm Consensus peers."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]

REQUIRED_MARKERS = {
    "AGENTS.md": [
        "### Debate Routing Guard (Blocking)",
        "default to **Swarm Consensus debate with external peer LLM CLIs**",
        "Platform subagents, current-LLM helper agents, repo-persona consultations",
        "Do not silently fall back to platform subagents",
    ],
    "skills/coordination/SKILL.md": [
        "## Debate Routing Guard (Blocking)",
        "Check this guard before cross-agent consultation, delegated agent resolution, or any platform subagent spawn.",
        "Use `<AI_DEV_SHOP_ROOT>/skills/swarm-consensus/SKILL.md` in `debate` mode.",
        "Do not silently replace the debate with platform subagents.",
    ],
    "framework/slash-commands/debate.md": [
        "## Debate Routing Guard",
        "`/debate` always means Swarm Consensus debate with external peer LLM CLIs.",
        "Apply the Debate Routing Guard before any subagent or consultation action.",
    ],
    "skills/swarm-consensus/SKILL.md": [
        "## Debate Routing Guard (Blocking)",
        "Debate requests must use external peer LLM CLIs by default.",
        "Do not silently replace Swarm Consensus debate with platform subagents.",
    ],
}


def main() -> int:
    violations: list[str] = []

    for relative_path, markers in REQUIRED_MARKERS.items():
        path = ROOT / relative_path
        if not path.exists():
            violations.append(
                f"VIOLATION: Missing required debate-routing file: {relative_path}\n"
                f"FIX: Restore {relative_path} or update validate_debate_routing_guard.py with the new canonical file."
            )
            continue

        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                violations.append(
                    f"VIOLATION: {relative_path} is missing debate-routing marker: {marker!r}\n"
                    f"FIX: Reinstate the Debate Routing Guard language so debate requests default to external Swarm Consensus peers and never silently fall back to platform subagents."
                )

    if violations:
        print("\n\n".join(violations))
        return 1

    print("Debate routing guard validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
