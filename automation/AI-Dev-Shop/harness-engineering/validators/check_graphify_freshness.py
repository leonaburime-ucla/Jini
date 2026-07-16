#!/usr/bin/env python3
"""Write or check AI Dev Shop freshness metadata for Graphify outputs."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SKIP_DIRS = {
    ".git",
    ".hg",
    ".svn",
    "graphify-out",
    "node_modules",
    "vendor",
    "dist",
    "build",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    "ADS-memory",
    "ADS-project-knowledge",
}

SKIP_PATH_PREFIXES = {
    ("integrations", "graphify", "upstream"),
}

REPO_ROOT = Path(__file__).resolve().parents[2]


def project_knowledge_root() -> Path:
    configured = os.environ.get("ADS_MEMORY_ROOT") or os.environ.get("ADS_PROJECT_KNOWLEDGE_ROOT") or os.environ.get("ADS_WORKSPACE_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return REPO_ROOT / "ADS-memory"


def graphify_output_root(args: argparse.Namespace) -> Path:
    if args.graphify_output_root:
        return Path(args.graphify_output_root).expanduser().resolve()
    configured = os.environ.get("ADS_GRAPHIFY_OUTPUT_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return project_knowledge_root() / "reports" / "graphify-out"


def sanitize_slug(value: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip(".-")
    return slug or "root"


def target_slug(root: Path) -> str:
    try:
        rel = root.relative_to(REPO_ROOT)
    except ValueError:
        digest = hashlib.sha1(str(root).encode("utf-8")).hexdigest()[:8]
        return f"{sanitize_slug(root.name)}-{digest}"
    if not rel.parts:
        return sanitize_slug(root.name)
    return sanitize_slug("-".join(rel.parts))


def report_graph_out(root: Path, output_root: Path) -> Path:
    return output_root / target_slug(root)


def graph_out_path(root: Path, output_root: Path) -> Path:
    return report_graph_out(root, output_root)


def is_empty_dir(path: Path) -> bool:
    try:
        return path.is_dir() and not any(path.iterdir())
    except OSError:
        return False


def move_existing_output(existing: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        shutil.move(str(existing), str(destination))
        return
    if not is_empty_dir(destination):
        raise RuntimeError(
            f"cannot migrate {existing}: destination already has files: {destination}"
        )
    for child in existing.iterdir():
        shutil.move(str(child), str(destination / child.name))
    existing.rmdir()


def prepare_graphify_output(root: Path, output_root: Path, migrate_existing: bool) -> tuple[Path, str]:
    destination = report_graph_out(root, output_root)
    destination.mkdir(parents=True, exist_ok=True)

    local_output = root / "graphify-out"
    if local_output.is_symlink():
        local_output.unlink()
    elif local_output.exists():
        if is_empty_dir(local_output):
            local_output.rmdir()
        elif migrate_existing and local_output.is_dir():
            move_existing_output(local_output, destination)
            return destination, "migrated"
        else:
            raise RuntimeError(
                f"{local_output} already exists. "
                "Move it under reports/graphify-out manually, remove it, or rerun with "
                "--migrate-existing-output."
            )

    return destination, "ready"


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def run_git(root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def graphify_version() -> str | None:
    candidates: list[str] = []
    env_bin = os.environ.get("GRAPHIFY_BIN")
    if env_bin:
        candidates.append(env_bin)
    candidates.append("graphify")
    candidates.append(str(REPO_ROOT / "integrations" / "graphify" / ".venv" / "bin" / "graphify"))
    seen: set[str] = set()
    unique_candidates = []
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        unique_candidates.append(candidate)
    for candidate in unique_candidates:
        version = graphify_version_for(candidate)
        if version:
            return version
    return None


def graphify_version_for(command: str) -> str | None:
    try:
        result = subprocess.run(
            [command, "--version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def newest_source_mtime(root: Path) -> str | None:
    newest = 0.0
    for dirpath, dirnames, filenames in os.walk(root):
        current_dir = Path(dirpath)
        rel_parts = current_dir.relative_to(root).parts
        if any(rel_parts[: len(prefix)] == prefix for prefix in SKIP_PATH_PREFIXES):
            dirnames.clear()
            continue
        dirnames[:] = [name for name in dirnames if name not in SKIP_DIRS]
        for name in filenames:
            path = current_dir / name
            try:
                newest = max(newest, path.stat().st_mtime)
            except OSError:
                continue
    if newest <= 0:
        return None
    return datetime.fromtimestamp(newest, timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def build_status(root: Path, args: argparse.Namespace, output_root: Path) -> dict:
    graph_out = graph_out_path(root, output_root)
    graph_json = graph_out / "graph.json"
    git_head = run_git(root, "rev-parse", "HEAD")
    git_dirty = run_git(root, "status", "--porcelain")
    now = iso_now()
    return {
        "generated_at": now,
        "target_root": str(root),
        "graph_output_dir": str(graph_out.resolve() if graph_out.exists() else graph_out),
        "target_git_head": git_head,
        "target_dirty": bool(git_dirty),
        "latest_source_mtime": newest_source_mtime(root),
        "graph_json_mtime": (
            datetime.fromtimestamp(graph_json.stat().st_mtime, timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
            if graph_json.exists()
            else None
        ),
        "graphify_version": graphify_version(),
        "mode": args.mode,
        "semantic_enabled": args.semantic_enabled,
        "human_approved_semantic": args.human_approved_semantic,
    }


def load_status(status_path: Path) -> dict | None:
    try:
        return json.loads(status_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def freshness(root: Path, status: dict | None, semantic_required: bool, output_root: Path) -> tuple[str, str]:
    graph_out = graph_out_path(root, output_root)
    graph_json = graph_out / "graph.json"
    if not graph_json.exists():
        return "missing", f"{graph_json} is missing"
    if not status:
        return "stale", ".ads-graphify-status.json is missing or unreadable"

    current_head = run_git(root, "rev-parse", "HEAD")
    recorded_head = status.get("target_git_head")
    if current_head and recorded_head and current_head != recorded_head:
        return "stale", "target git HEAD differs from recorded graph HEAD"

    graph_mtime = datetime.fromtimestamp(graph_json.stat().st_mtime, timezone.utc)
    latest_source = parse_iso(newest_source_mtime(root))
    if latest_source and latest_source > graph_mtime:
        return "stale", f"source files are newer than {graph_json}"

    if semantic_required and not status.get("semantic_enabled"):
        return "stale", "semantic graph coverage is required but metadata says semantic_enabled=false"

    return "fresh", "graph metadata matches current freshness checks"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", nargs="?", default=".", help="target repo root")
    parser.add_argument(
        "--prepare-output",
        action="store_true",
        help="create reports/graphify-out/<target>/ for use with GRAPHIFY_OUT",
    )
    parser.add_argument(
        "--migrate-existing-output",
        action="store_true",
        help="move an existing non-empty <target>/graphify-out directory into the reports location",
    )
    parser.add_argument(
        "--graphify-output-root",
        help="override the default Graphify reports root; defaults to <ADS_MEMORY_ROOT>/reports/graphify-out",
    )
    parser.add_argument(
        "--print-output-path",
        action="store_true",
        help="print the canonical reports-backed Graphify output directory and exit after any prepare/migrate work",
    )
    parser.add_argument("--write", action="store_true", help="write/update .ads-graphify-status.json")
    parser.add_argument("--strict", action="store_true", help="exit non-zero when stale or missing")
    parser.add_argument("--semantic-required", action="store_true", help="treat semantic coverage as required")
    parser.add_argument("--semantic-enabled", action="store_true", help="record semantic_enabled=true when writing")
    parser.add_argument(
        "--human-approved-semantic",
        action="store_true",
        help="record human_approved_semantic=true when writing",
    )
    parser.add_argument("--mode", default="code_update", help="mode to record when writing")
    args = parser.parse_args()

    root = Path(args.target).expanduser().resolve()
    if not root.exists():
        print(f"error: target does not exist: {root}", file=sys.stderr)
        return 2

    output_root = graphify_output_root(args)
    if args.prepare_output:
        try:
            prepared_path, action = prepare_graphify_output(root, output_root, args.migrate_existing_output)
        except RuntimeError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        if not args.print_output_path:
            print(f"Graphify output {action}: {prepared_path}")

    graph_out = graph_out_path(root, output_root)
    if args.print_output_path and not args.write:
        print(graph_out)
        return 0

    status_path = graph_out / ".ads-graphify-status.json"
    if args.write:
        status_path.parent.mkdir(parents=True, exist_ok=True)
        status = build_status(root, args, output_root)
        status_path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")
    else:
        status = load_status(status_path)

    state, reason = freshness(root, status, args.semantic_required, output_root)
    print("Graphify Freshness Check")
    print("------------------------")
    print(f"Target: {root}")
    print(f"Graph output: {graph_out.resolve() if graph_out.exists() else graph_out}")
    print(f"Status: {state}")
    print(f"Reason: {reason}")
    print(f"Metadata: {status_path}")
    if status:
        print(f"Generated: {status.get('generated_at')}")
        print(f"Mode: {status.get('mode')}")
        print(f"Semantic enabled: {status.get('semantic_enabled')}")

    if args.strict and state != "fresh":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
