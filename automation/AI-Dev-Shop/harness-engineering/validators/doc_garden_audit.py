#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def count_lines(path: Path) -> int:
    return len(path.read_text(encoding="utf-8").splitlines())


def count_skill_dirs() -> int:
    return len(list((ROOT / "skills").glob("*/SKILL.md")))


def count_agent_skill_files() -> int:
    return len(list((ROOT / "agents").glob("*/skills.md")))


def count_benchmark_samples() -> int:
    return len([path for path in (ROOT / "project-knowledge-template/reports/benchmarks").glob("*/*") if path.is_dir()])


def count_trigger_rows() -> int:
    path = ROOT / "framework/routing/file-trigger-table.md"
    count = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("| `") and "| Likely Owner |" not in line:
            count += 1
    return count


def main() -> int:
    agents_lines = count_lines(ROOT / "AGENTS.md")
    skill_count = count_skill_dirs()
    agent_count = count_agent_skill_files()
    benchmark_samples = count_benchmark_samples()
    trigger_rows = count_trigger_rows()

    print("Harness Doc-Garden Audit")
    print("------------------------")
    print(f"AGENTS.md lines: {agents_lines}")
    if agents_lines > 200:
        print("ADVISORY: AGENTS.md is over 200 lines. Continue shrinking it toward a map-first entrypoint.")
    else:
        print("ADVISORY: AGENTS.md size is in the safer range for a map-first entrypoint.")

    print(f"Canonical skill files: {skill_count}")
    print(f"Agent persona files: {agent_count}")
    print(f"Benchmark sample directories: {benchmark_samples}")
    print(f"File-trigger routes: {trigger_rows}")
    if benchmark_samples == 0:
        print("ADVISORY: no benchmark samples exist yet. Seed at least one per major agent role.")

    print("ADVISORY: run this audit after framework changes and pair it with the hard validators.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
