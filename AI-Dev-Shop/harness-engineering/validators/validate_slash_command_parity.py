#!/usr/bin/env python3
"""Detect stale installed slash commands.

The canonical slash-command sources live in `framework/slash-commands/*.md`.
The Claude Code host reads the installed copies in `.claude/commands/*.md`.
When a source is edited but the installed copy is not re-synced, the host runs a
STALE command — a real, silent behavior drift (this bit us: `plan.md` 19 vs 80
lines, `code-review.md` 28 vs 77). This guard fails on that divergence and tells
the user exactly how to fix it.

Classification (mirrors install-slash-commands.sh):
  DIVERGED  installed copy present but content differs from source  -> VIOLATION (stale)
  MISSING   no installed copy                                       -> note (opt-in install; not a failure)
  EXTRA     installed copy with no source                           -> note
  IDENTICAL byte-identical                                          -> ok

Project-scoped commands (gstack-*) are opt-in via `--include-project`, so a
MISSING project command is never a violation; a DIVERGED one still is.
"""

from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
SRC_DIR = ROOT / "framework" / "slash-commands"
DST_DIR = ROOT / ".claude" / "commands"

# Files in the source dir that are not installable commands.
NON_COMMAND = {"README.md"}


def is_project_scoped(name: str) -> bool:
    return name.startswith("gstack-")


def main() -> int:
    if not SRC_DIR.is_dir():
        print(f"VIOLATION: missing slash-command source dir: {SRC_DIR.relative_to(ROOT)}")
        return 1

    diverged: list[str] = []
    missing_core: list[str] = []
    missing_project: list[str] = []
    extra: list[str] = []

    sources = {p.name for p in SRC_DIR.glob("*.md") if p.name not in NON_COMMAND}

    for name in sorted(sources):
        src = SRC_DIR / name
        dst = DST_DIR / name
        if not dst.exists():
            (missing_project if is_project_scoped(name) else missing_core).append(name)
            continue
        if src.read_bytes() != dst.read_bytes():
            src_lines = len(src.read_text(encoding="utf-8").splitlines())
            dst_lines = len(dst.read_text(encoding="utf-8").splitlines())
            diverged.append(f"{name} (source={src_lines} lines, installed={dst_lines} lines)")

    if DST_DIR.is_dir():
        installed = {p.name for p in DST_DIR.glob("*.md")}
        extra = sorted(n for n in installed if n not in sources)

    # Informational notes never fail the run.
    if missing_core:
        print("NOTE: core commands not installed (opt-in; run install-slash-commands.sh --install):")
        for n in missing_core:
            print(f"  - {n}")
    if missing_project:
        print("NOTE: project commands not installed (need --include-project):")
        for n in missing_project:
            print(f"  - {n}")
    if extra:
        print("NOTE: installed commands with no source (host-local or removed upstream):")
        for n in extra:
            print(f"  - {n}")

    if diverged:
        print()
        print("VIOLATION: STALE slash commands — installed copy differs from source:")
        for d in diverged:
            print(f"  - {d}")
        print()
        print("FIX: re-sync the installed copies from the canonical source:")
        print("  bash framework/operations/scripts/install-slash-commands.sh --check")
        print("  bash framework/operations/scripts/install-slash-commands.sh --install --overwrite")
        print("  (add --include-project to also refresh gstack-* project commands)")
        return 1

    print("Slash-command parity validation passed (no stale installed commands).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
