#!/usr/bin/env python3
"""Validate that Swarm Consensus reports model identity, not CLI version, to users."""

from __future__ import annotations

from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[2]

REQUIRED_MARKERS = {
    "skills/swarm-consensus/SKILL.md": [
        "## Model Identity Disclosure Guard (Blocking)",
        "always show the peer model identity first",
        "Do not present CLI version strings",
        "CLI versions belong only in diagnostics",
        "If the exact model cannot be proven, say `model unresolved` or `local default, exact model unknown`",
        "Preflight copy must distinguish `Planned peer models` from `CLI diagnostics`.",
    ],
    "framework/slash-commands/consensus.md": [
        "capture CLI version strings as diagnostics",
        "print preflight with planned model names first and CLI versions only under diagnostics",
        "Never present CLI version strings as model names or model versions.",
    ],
    "framework/slash-commands/cowork.md": [
        "Apply the `Model Memory Map`",
        "do not rely on CLI version output alone",
        "For Gemini, inspect the saved local preference in `~/.gemini/settings.json` at `model.name`",
        "For Claude, inspect `<ADS_MEMORY_ROOT>/reports/swarm-consensus/smoke-tests/last-known-good.json`",
        "CLI version strings are diagnostics only. Do not present CLI versions as model identities.",
    ],
    "skills/llm-operations/references/peer-llm-dispatch.md": [
        "### Model Memory Map",
        "Before declaring a peer model unresolved, run the Model Memory Map below.",
        "Project knowledge root evidence",
        "AI Dev Shop repo evidence",
        "repo `.local-artifacts/`, repo `reports/`, and bounded peer-dispatch packets under `tmp/peer-dispatch/`",
        "Home CLI config files",
        "project knowledge and repo-local evidence as higher priority than home CLI defaults",
        "`~/.gemini/settings.json` and the model name is at `model.name`",
        "--model-plan-only",
        "Never print `model unresolved` until every source in this map has been checked or is unavailable.",
    ],
    "skills/swarm-consensus/references/cli-smoke-test.md": [
        "--model-plan-only",
        "--output-format json",
        "Model-plan-only lookup order",
        "AI Dev Shop repo-local evidence",
        "Home CLI defaults",
    ],
    "skills/swarm-consensus/scripts/cli_smoke_test.py": [
        "--model-plan-only",
        "model_memory_roots",
        "load_saved_peer_model_from_memory_map",
        "load_saved_claude_model_from_memory_map",
        "DEFAULT_SMOKE_TEST_DIR / \"last-known-good.json\"",
        "LEGACY_SMOKE_TEST_DIR / \"last-known-good.json\"",
        "root / \"tmp\" / \"peer-dispatch\"",
        "Saved Claude model:",
        "~/.gemini/settings.json",
        "is_exact_model_identifier(saved_claude_model)",
        "local_default_alias",
    ],
    "AGENTS.md": [
        "show the resolved or planned **model name/version** first",
        "CLI version strings are diagnostics only",
    ],
}

FORBIDDEN_MARKERS = {
    "skills/swarm-consensus/SKILL.md": [
        "Asking question to Gemini <version>, Codex <version>, Claude <version>",
    ],
}


def main() -> int:
    violations: list[str] = []

    for relative_path, markers in REQUIRED_MARKERS.items():
        path = ROOT / relative_path
        if not path.exists():
            violations.append(
                f"VIOLATION: Missing required model-identity file: {relative_path}\n"
                f"FIX: Restore {relative_path} or update validate_swarm_model_identity_guard.py with the new canonical file."
            )
            continue

        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker not in text:
                violations.append(
                    f"VIOLATION: {relative_path} is missing model-identity marker: {marker!r}\n"
                    f"FIX: Reinstate the Model Identity Disclosure Guard so model names/IDs are shown first and CLI versions stay diagnostics-only."
                )

    for relative_path, markers in FORBIDDEN_MARKERS.items():
        path = ROOT / relative_path
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for marker in markers:
            if marker in text:
                violations.append(
                    f"VIOLATION: {relative_path} still contains forbidden ambiguous model/CLI wording: {marker!r}\n"
                    f"FIX: Replace it with planned model names plus separate CLI diagnostics."
                )

    if violations:
        print("\n\n".join(violations))
        return 1

    print("Swarm model identity guard validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
