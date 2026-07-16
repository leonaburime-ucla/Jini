#!/usr/bin/env python3
from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WATCHLIST = ROOT / "harness-engineering/maintenance/doc-staleness-watchlist.md"
ROW_RE = re.compile(
    r"^\|\s*`([^`]+)`\s*\|\s*`([^`]+(?:`,\s*`[^`]+)*)`\s*\|\s*(\d+)\s*\|\s*([0-9]{4}-[0-9]{2}-[0-9]{2})\s*\|\s*(.+?)\s*\|$"
)


def parse_rows() -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    for line in WATCHLIST.read_text(encoding="utf-8").splitlines():
        match = ROW_RE.match(line)
        if not match:
            continue
        targets = [part.strip().strip("`") for part in match.group(2).split("`, `")]
        rows.append(
            {
                "doc": match.group(1),
                "targets": targets,
                "cadence_days": int(match.group(3)),
                "last_reviewed": datetime.strptime(match.group(4), "%Y-%m-%d").date(),
                "reason": match.group(5),
            }
        )
    return rows


def main() -> int:
    today = date.today()
    rows = parse_rows()
    missing_docs: list[str] = []
    missing_targets: list[tuple[str, str]] = []
    overdue_docs: list[tuple[str, int]] = []

    for row in rows:
        doc_path = ROOT / str(row["doc"])
        if not doc_path.exists():
            missing_docs.append(str(row["doc"]))

        for target in row["targets"]:
            target_path = ROOT / str(target)
            if not target_path.exists():
                missing_targets.append((str(row["doc"]), str(target)))

        age_days = (today - row["last_reviewed"]).days
        if age_days > int(row["cadence_days"]):
            overdue_docs.append((str(row["doc"]), age_days))

    print("Harness Doc Staleness Audit")
    print("---------------------------")
    print(f"Watchlist entries: {len(rows)}")

    if missing_docs:
        for doc in missing_docs:
            print(f"ADVISORY: watched doc is missing -> {doc}")

    if missing_targets:
        for doc, target in missing_targets:
            print(f"ADVISORY: watch target missing for {doc} -> {target}")

    if overdue_docs:
        for doc, age_days in overdue_docs:
            print(f"ADVISORY: watchlist review overdue -> {doc} ({age_days} days since review)")
    else:
        print("ADVISORY: watchlist review dates are within declared cadence.")

    print("ADVISORY: run this after routing/workflow changes to catch source-of-truth drift early.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
