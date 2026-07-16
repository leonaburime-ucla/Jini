#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "framework/routing/skills-registry.md"
EXCEPTIONS = ROOT / "framework/routing/skills-registry-exceptions.md"
ROW_RE = re.compile(r"^\|\s*`([^`]+)`\s*\|")
EXCEPTION_RE = re.compile(r"^\s*-\s*`([^`]+)`")


def registry_entries() -> list[str]:
    entries: list[str] = []
    for line in REGISTRY.read_text(encoding="utf-8").splitlines():
        match = ROW_RE.match(line)
        if match:
            entries.append(match.group(1))
    return entries


def registry_exceptions() -> list[str]:
    if not EXCEPTIONS.exists():
        return []

    entries: list[str] = []
    for line in EXCEPTIONS.read_text(encoding="utf-8").splitlines():
        match = EXCEPTION_RE.match(line)
        if match:
            entries.append(match.group(1))
    return entries


def main() -> int:
    entries = registry_entries()
    hard_failures: list[str] = []
    duplicate_entries = sorted(
        entry for entry, count in Counter(entries).items() if count > 1 and entry.startswith("skills/")
    )

    for entry in entries:
        if any(token in entry for token in ("<", ">", "*", "...")):
            continue
        if not (ROOT / entry).exists():
            hard_failures.append(entry)

    actual_skill_files = {
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "skills").glob("*/SKILL.md")
    }
    registered_skill_files = {
        entry for entry in entries if entry.startswith("skills/") and entry.endswith("/SKILL.md")
    }
    exception_skill_files = {
        entry for entry in registry_exceptions() if entry.startswith("skills/") and entry.endswith("/SKILL.md")
    }
    unregistered_skills = sorted(actual_skill_files - registered_skill_files - exception_skill_files)
    stale_exceptions = sorted(exception_skill_files - actual_skill_files)

    if hard_failures:
        for entry in hard_failures:
            print(f"VIOLATION: skills-registry references a missing path -> {entry}")
            print("FIX: update framework/routing/skills-registry.md or restore the missing file.")
        print(f"FAIL: {len(hard_failures)} stale path(s) found in skills-registry.")
        return 1

    if duplicate_entries:
        for entry in duplicate_entries:
            print(f"VIOLATION: duplicate skills-registry entry -> {entry}")
            print("FIX: keep exactly one canonical registry row for each shared skill.")
        print(f"FAIL: {len(duplicate_entries)} duplicate skill-registry entry(s) found.")
        return 1

    if stale_exceptions:
        for entry in stale_exceptions:
            print(f"VIOLATION: skills-registry exception references a missing skill -> {entry}")
            print("FIX: remove the exception entry or restore the missing skill file.")
        print(f"FAIL: {len(stale_exceptions)} stale exception entry(s) found.")
        return 1

    if unregistered_skills:
        for entry in unregistered_skills:
            print(f"VIOLATION: canonical skill missing from skills-registry -> {entry}")
            print(
                "FIX: add it to framework/routing/skills-registry.md or record an intentional exclusion in "
                "framework/routing/skills-registry-exceptions.md."
            )
        print(f"FAIL: {len(unregistered_skills)} canonical skill file(s) missing from skills-registry.")
        return 1

    print("PASS: all paths referenced by skills-registry exist.")
    print("PASS: canonical skill coverage is complete for skills-registry.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
