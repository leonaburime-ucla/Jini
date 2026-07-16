#!/usr/bin/env python3
"""Generate the repo's maintenance summary from validator outputs.

By default the script refreshes the tracked maintenance report in
`project-knowledge-template/reports/maintenance/`. The CLI also supports
stdout/check modes so callers can inspect the generated content without
silently mutating tracked files.
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPORT = ROOT / "project-knowledge-template/reports/maintenance/harness-maintenance.md"
EXPECTED_BENCHMARK_DIRS = [
    "spec-agent",
    "architect-agent",
    "tdd-agent",
    "programmer-agent",
    "testrunner-agent",
    "code-review-agent",
    "security-agent",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        help=(
            "Write the generated report to this path. Relative paths are resolved "
            "from the repo root. Defaults to the tracked maintenance report."
        ),
    )
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument(
        "--stdout",
        action="store_true",
        help="Print the generated report to stdout instead of writing a file.",
    )
    mode_group.add_argument(
        "--check",
        action="store_true",
        help="Exit non-zero if the target report is stale instead of rewriting it.",
    )
    return parser.parse_args()


def resolve_output_path(raw_output: str | None) -> Path:
    if not raw_output:
        return DEFAULT_REPORT
    candidate = Path(raw_output)
    if candidate.is_absolute():
        return candidate
    return ROOT / candidate


def display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def run_script(path: str) -> tuple[int, str]:
    """Execute one validator and return its combined textual output."""
    result = subprocess.run(
        ["python3", str(ROOT / path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    output = (result.stdout + result.stderr).strip()
    return result.returncode, output


def count_lines(path: Path) -> int:
    return len(path.read_text(encoding="utf-8").splitlines())


def count_benchmark_samples(agent_dir: str) -> int:
    path = ROOT / "project-knowledge-template/reports/benchmarks" / agent_dir
    if not path.exists():
        return 0
    return len([child for child in path.iterdir() if child.is_dir()])


def registry_exception_count() -> int:
    path = ROOT / "framework/routing/skills-registry-exceptions.md"
    count = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip().startswith("- `skills/"):
            count += 1
    return count


def build_report() -> str:
    """Assemble the human-readable maintenance report body."""
    path_rc, path_output = run_script("harness-engineering/validators/validate_path_references.py")
    registry_rc, registry_output = run_script("harness-engineering/validators/validate_registry_integrity.py")
    audit_rc, audit_output = run_script("harness-engineering/validators/doc_garden_audit.py")
    staleness_rc, staleness_output = run_script("harness-engineering/validators/doc_staleness_audit.py")

    agents_lines = count_lines(ROOT / "AGENTS.md")
    benchmark_rows = [
        f"| `{agent_dir}` | {count_benchmark_samples(agent_dir)} |"
        for agent_dir in EXPECTED_BENCHMARK_DIRS
    ]
    missing_benchmark_dirs = [
        agent_dir for agent_dir in EXPECTED_BENCHMARK_DIRS if count_benchmark_samples(agent_dir) == 0
    ]
    recommendations: list[str] = []

    if path_rc != 0 or registry_rc != 0:
        recommendations.append("Fix hard-validator failures before merging further harness changes.")
    if agents_lines > 200:
        recommendations.append("Keep shrinking `AGENTS.md` or move new detail into linked source docs.")
    if missing_benchmark_dirs:
        recommendations.append(
            "Seed benchmark coverage for: " + ", ".join(f"`{entry}`" for entry in missing_benchmark_dirs) + "."
        )
    if registry_exception_count() > 0:
        recommendations.append("Review whether every registry exception is still intentional and temporary.")
    if not recommendations:
        recommendations.append("No immediate repair recommendation. Keep weekly maintenance cadence running.")

    report_lines = [
        "# Harness Maintenance Report",
        "",
        "Generated from current repo state. Refresh with `python3 harness-engineering/validators/generate_maintenance_report.py`.",
        "",
        "## Hard Validator Summary",
        "",
        f"- Path references: {'PASS' if path_rc == 0 else 'FAIL'}",
        f"- Registry integrity: {'PASS' if registry_rc == 0 else 'FAIL'}",
        "",
        "```text",
        path_output,
        "",
        registry_output,
        "```",
        "",
        "## Advisory Audit",
        "",
        f"- Doc-garden audit: {'PASS' if audit_rc == 0 else 'CHECK'}",
        f"- Doc staleness audit: {'PASS' if staleness_rc == 0 else 'CHECK'}",
        "",
        "```text",
        audit_output,
        "",
        staleness_output,
        "```",
        "",
        "## Benchmark Coverage",
        "",
        "| Agent Dir | Sample Count |",
        "|---|---:|",
        *benchmark_rows,
        "",
        "## Repo Signals",
        "",
        f"- `AGENTS.md` line count: {agents_lines}",
        f"- Registry exceptions in use: {registry_exception_count()}",
        "",
        "## Maintenance Recommendations",
        "",
        *[f"- {entry}" for entry in recommendations],
        "",
    ]
    return "\n".join(report_lines)


def main() -> int:
    args = parse_args()
    report = build_report()

    if args.stdout:
        print(report)
        return 0

    output_path = resolve_output_path(args.output)
    if args.check:
        current = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
        if current != report:
            print(f"STALE: {display_path(output_path)}")
            return 1
        print(f"OK: {display_path(output_path)}")
        return 0

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(report, encoding="utf-8")
    print(f"WROTE: {display_path(output_path)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
