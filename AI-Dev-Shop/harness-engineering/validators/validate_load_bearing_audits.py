#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR = ROOT / "project-knowledge-template/reports/maintenance"
META_RE = re.compile(r"^- ([A-Za-z][A-Za-z0-9 /_-]*):\s*(.+)$")
SEPARATOR_RE = re.compile(r"^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$")
REQUIRED_HEADINGS = [
    "## Benchmark Tasks",
    "## Harness Variants Compared",
    "## Results",
    "## Component Decisions",
    "## Follow-Through",
]
ALLOWED_DECISIONS = {"essential", "conditional", "stale"}


@dataclass(frozen=True)
class Violation:
    path: Path
    message: str
    fix: str


def repo_relative(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def normalized_key(raw_key: str) -> str:
    return raw_key.strip().lower().replace(" ", "_").replace("-", "_").replace("/", "_")


def parse_metadata(path: Path) -> tuple[dict[str, str], set[str]]:
    metadata: dict[str, str] = {}
    duplicates: set[str] = set()
    text = path.read_text(encoding="utf-8")
    started = False
    for line in text.splitlines():
        if line.startswith("# "):
            started = True
            continue
        if not started:
            continue
        if line.startswith("## "):
            break
        match = META_RE.match(line)
        if not match:
            continue
        key = normalized_key(match.group(1))
        if key in metadata:
            duplicates.add(key)
        metadata[key] = match.group(2).strip()
    return metadata, duplicates


def has_heading(text: str, heading: str) -> bool:
    return re.search(rf"^{re.escape(heading)}\s*$", text, flags=re.MULTILINE) is not None


def section_lines(text: str, heading: str) -> list[str]:
    lines = text.splitlines()
    in_section = False
    captured: list[str] = []
    for line in lines:
        if line.strip() == heading:
            in_section = True
            continue
        if in_section and line.startswith("## "):
            break
        if in_section:
            captured.append(line)
    return captured


def data_rows(lines: list[str]) -> list[list[str]]:
    rows: list[list[str]] = []
    header_skipped = False
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        if SEPARATOR_RE.match(stripped):
            continue
        if not header_skipped:
            header_skipped = True
            continue
        columns = [column.strip() for column in stripped.strip("|").split("|")]
        if not columns:
            continue
        rows.append(columns)
    return rows


def validate_report(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    text = path.read_text(encoding="utf-8")
    metadata, duplicates = parse_metadata(path)

    if not path.name.startswith("harness-load-bearing-"):
        violations.append(
            Violation(
                path,
                "load-bearing audit report does not use the canonical filename prefix",
                "rename it to harness-load-bearing-<YYYY-MM-DD>.md under project-knowledge-template/reports/maintenance/",
            )
        )

    for duplicate in sorted(duplicates):
        violations.append(
            Violation(
                path,
                f"load-bearing audit report has duplicate metadata after normalization for key '{duplicate}'",
                "use each metadata field once and avoid alternate spellings that normalize to the same key",
            )
        )

    for key in ("audit_date", "trigger", "reviewer", "benchmark_source", "scope"):
        if key not in metadata:
            violations.append(
                Violation(
                    path,
                    f"load-bearing audit report is missing metadata field '{key}'",
                    "fill in the missing metadata using framework/templates/load-bearing-harness-audit-template.md",
                )
            )

    for heading in REQUIRED_HEADINGS:
        if not has_heading(text, heading):
            violations.append(
                Violation(
                    path,
                    f"load-bearing audit report is missing section '{heading}'",
                    "add the missing section using framework/templates/load-bearing-harness-audit-template.md",
                )
            )

    benchmark_rows = data_rows(section_lines(text, "## Benchmark Tasks"))
    if not benchmark_rows:
        violations.append(
            Violation(
                path,
                "load-bearing audit report has no benchmark task rows",
                "add at least one benchmark task row under ## Benchmark Tasks",
            )
        )

    variant_rows = data_rows(section_lines(text, "## Harness Variants Compared"))
    if not variant_rows:
        violations.append(
            Violation(
                path,
                "load-bearing audit report has no variant rows",
                "add at least one variant row under ## Harness Variants Compared",
            )
        )

    result_rows = data_rows(section_lines(text, "## Results"))
    if not result_rows:
        violations.append(
            Violation(
                path,
                "load-bearing audit report has no result rows",
                "add at least one result row under ## Results",
            )
        )

    decision_rows = data_rows(section_lines(text, "## Component Decisions"))
    if not decision_rows:
        violations.append(
            Violation(
                path,
                "load-bearing audit report has no component decision rows",
                "add at least one component decision row under ## Component Decisions",
            )
        )
    else:
        for row in decision_rows:
            if len(row) < 4:
                violations.append(
                    Violation(
                        path,
                        "load-bearing audit report has malformed component decision rows",
                        "use the four-column table from framework/templates/load-bearing-harness-audit-template.md",
                    )
                )
                break
            decision = row[2].lower()
            if decision not in ALLOWED_DECISIONS:
                violations.append(
                    Violation(
                        path,
                        f"load-bearing audit report uses invalid decision '{row[2]}'",
                        "use only essential, conditional, or stale in the Decision column",
                    )
                )

    return violations


def main() -> int:
    reports = sorted(REPORT_DIR.glob("harness-load-bearing-*.md"))
    violations: list[Violation] = []

    for report in reports:
        violations.extend(validate_report(report))

    if violations:
        for violation in violations:
            print(f"VIOLATION: {repo_relative(violation.path)} -> {violation.message}")
            print(f"FIX: {violation.fix}")
        print(f"FAIL: {len(violations)} load-bearing audit violation(s) found.")
        return 1

    print(f"PASS: load-bearing audit report requirements satisfied ({len(reports)} report(s) scanned).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
