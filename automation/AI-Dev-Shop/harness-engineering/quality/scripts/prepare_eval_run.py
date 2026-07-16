#!/usr/bin/env python3
"""Prepare isolated workdirs for seeded eval runs.

The script copies each eval's seed-state plus optional prompt/brief artifacts into
an eval-local `runs/<run_id>/` directory. Run IDs are validated up front so a
forced refresh can only delete directories inside the intended `runs/` subtree.
"""

from __future__ import annotations

import argparse
import csv
import shutil
import sys
from pathlib import Path


def discover_eval_dirs(suite_dir: Path) -> list[Path]:
    return sorted(
        child
        for child in suite_dir.iterdir()
        if child.is_dir() and (child / "seed-state").is_dir()
    )


def normalize_run_id(run_id: str) -> str:
    """Accept only single-segment run IDs like `run-001`."""
    normalized = run_id.strip()
    if not normalized:
        raise ValueError("Run identifier must not be empty.")
    if normalized in {".", ".."} or "/" in normalized or "\\" in normalized:
        raise ValueError(
            "Run identifier must be a single path segment like 'run-001'; "
            "slashes and relative segments are not allowed."
        )
    if Path(normalized).is_absolute():
        raise ValueError("Run identifier must be relative, not absolute.")
    return normalized


def copy_optional(src: Path, dest: Path) -> None:
    if src.is_dir():
        shutil.copytree(src, dest)
    elif src.is_file():
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def resolve_run_dir(eval_dir: Path, run_id: str) -> Path:
    runs_root = (eval_dir / "runs").resolve()
    run_dir = (runs_root / run_id).resolve()
    if run_dir.parent != runs_root:
        raise ValueError(
            f"Resolved run directory escapes the eval-local runs/ root: {run_dir}"
        )
    return run_dir


def prepare_run(eval_dir: Path, run_id: str, force: bool) -> Path:
    """Create or refresh one eval-local run directory."""
    seed_state = eval_dir / "seed-state"
    runs_root = eval_dir / "runs"
    runs_root.mkdir(parents=True, exist_ok=True)
    run_dir = resolve_run_dir(eval_dir, run_id)

    if run_dir.exists():
        if not run_dir.is_dir():
            raise NotADirectoryError(f"Run path exists but is not a directory: {run_dir}")
        if not force:
            raise FileExistsError(f"Run directory already exists: {run_dir}")
        # `run_dir` has already been proven to live directly under this eval's runs/ root.
        shutil.rmtree(run_dir)

    shutil.copytree(seed_state, run_dir)

    copy_optional(eval_dir / "project-brief.md", run_dir / "project-brief.md")
    copy_optional(eval_dir / "prompts", run_dir / "prompts")
    (run_dir / "eval-results").mkdir(parents=True, exist_ok=True)

    return run_dir


def count_selected_seeds(suite_dir: Path, eval_names: set[str]) -> int | None:
    seed_catalog = suite_dir / "seed-catalog.tsv"
    if not seed_catalog.exists():
        return None
    with seed_catalog.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        return sum(
            1
            for row in reader
            if (row.get("eval_name") or "").strip() in eval_names
        )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Prepare fresh run workdirs for a seeded eval suite.",
    )
    parser.add_argument("suite_dir", help="Path to the suite root")
    parser.add_argument("run_id", help="Run identifier, for example run-001")
    parser.add_argument(
        "--eval",
        dest="eval_names",
        action="append",
        default=[],
        help="Specific eval directory name to prepare. Repeatable.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing runs/<run_id>/ directories if they already exist.",
    )
    args = parser.parse_args()

    suite_dir = Path(args.suite_dir).resolve()
    if not suite_dir.exists():
        print(f"Suite directory does not exist: {suite_dir}", file=sys.stderr)
        return 1
    try:
        run_id = normalize_run_id(args.run_id)
    except ValueError as exc:
        print(f"Invalid run_id: {exc}", file=sys.stderr)
        return 1

    eval_dirs = discover_eval_dirs(suite_dir)
    if args.eval_names:
        wanted = set(args.eval_names)
        eval_dirs = [item for item in eval_dirs if item.name in wanted]
        missing = wanted.difference({item.name for item in eval_dirs})
        if missing:
            print(
                f"Unknown eval name(s): {', '.join(sorted(missing))}",
                file=sys.stderr,
            )
            return 1

    if not eval_dirs:
        print(f"No eval directories with seed-state found under {suite_dir}", file=sys.stderr)
        return 1

    for eval_dir in eval_dirs:
        run_dir = prepare_run(eval_dir, run_id, args.force)
        print(f"{eval_dir.name}\t{run_dir}")

    selected_eval_names = {eval_dir.name for eval_dir in eval_dirs}
    seed_count = count_selected_seeds(suite_dir, selected_eval_names)
    threshold_hit = len(selected_eval_names) > 1 or (seed_count is not None and seed_count > 10)
    if threshold_hit:
        scope_fragment = (
            f"{seed_count} seeds across {len(selected_eval_names)} evals"
            if seed_count is not None
            else f"{len(selected_eval_names)} evals"
        )
        print(
            "SCOPE CONFIRMATION REQUIRED: preparing "
            f"{scope_fragment}. Before dispatch, confirm with the user that "
            "they want the full scope instead of a smaller subset. Persist the "
            "answer later in run-manifest.tsv as scope_confirmation=confirmed.",
            file=sys.stderr,
        )

    print(
        "NEXT STEP: default execution mode for seeded agent evals is "
        "'repo_persona_subagent'. Use 'repo_persona_host' only when subagents "
        "are unavailable or disabled. Use external peers only for explicit "
        "comparison runs.",
        file=sys.stderr,
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
